/**
 * Shared wiki-image resolution strategy — source of truth.
 *
 * Used by BOTH :
 *   - backend/src/wiki-image/wiki-image.service.ts (NestJS, axios)
 *   - frontend/functions/api/wiki-image.ts        (Cloudflare Pages Function, fetch)
 *
 * To keep the runtime build hermetic (the backend Dockerfile only COPYs
 * `backend/`, and Cloudflare's bundler resolves relative paths from
 * `frontend/`), this file is mirrored into each app at build time via
 * `scripts/sync-shared.cjs` (wired as `prebuild` in both package.json).
 * The two copies (`backend/src/_shared/wiki-image-strategy.ts` and
 * `frontend/functions/_shared/wiki-image-strategy.ts`) are committed so
 * `tsc --noEmit` and tests pass without a build step.
 *
 * Strategy (in order) :
 *   1. **Avatar Fandom direct** — james-camerons-avatar.fandom.com has
 *      dedicated pages for nearly every creature, character, location,
 *      clan, and concept in the franchise, each with a real infobox
 *      image. This is by far the best source for Avatar lore.
 *   2. **Avatar Fandom search** — top hit for the query, then fetch its
 *      image (covers cases where the page name differs from the query,
 *      e.g. "Banshee" → "Mountain Banshee").
 *   3. **Wikipedia EN REST summary** — for actor portraits (Sam
 *      Worthington, Sigourney Weaver, etc.) and films (posters).
 *   4. **Wikipedia FR REST summary** — for FR-only articles.
 *
 * Wikipedia search fallback is intentionally NOT used : it returned
 * wildly unrelated images (Game Boys, gramophones, theme-park trees)
 * because Wikipedia search ranks by content match, not topical fit.
 * Fandom search is much more focused.
 *
 * The `FRANCHISE_HUB_BLACKLIST` skips Wikipedia summary images for
 * franchise hub pages whose lead image is the franchise logo or a
 * cropped poster — useless as a per-entry illustration.
 */

export const WIKI_USER_AGENT = 'eywa-codex/1.0 (sylvain.ladoire@gmail.com)';

/**
 * Wikipedia pages whose `originalimage` is the franchise logo / a
 * generic poster — drop them from the Wikipedia fallback so we don't
 * paste the same Avatar logo onto every codex card.
 */
export const FRANCHISE_HUB_BLACKLIST = new Set<string>([
  'avatar (2009 film)',
  'avatar: the way of water',
  'avatar: fire and ash',
  'pandora (avatar)',
  'avatar (franchise)',
  'fictional universe of avatar',
  'list of avatar characters',
]);

/** Minimal HTTP adapter — lets the strategy stay agnostic of axios vs fetch. */
export interface HttpFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface HttpFetchResult {
  status: number;
  data: unknown;
}

export type HttpFetch = (url: string, opts?: HttpFetchOptions) => Promise<HttpFetchResult>;

/** Optional debug logger — backend pipes to NestJS Logger, CF Function silences. */
export type DebugLog = (msg: string) => void;

interface PageImageResponse {
  query?: {
    pages?: Record<string, { original?: { source?: string } }>;
    search?: { title?: string }[];
  };
}

interface RestSummaryResponse {
  originalimage?: { source?: string };
}

const TIMEOUT_MS = 5000;

/** Fetch the original infobox image for an Avatar Fandom page directly. */
async function fetchFandomImage(
  title: string,
  httpFetch: HttpFetch,
  debug?: DebugLog,
): Promise<string | null> {
  const url =
    'https://james-camerons-avatar.fandom.com/api.php?' +
    'action=query&format=json&prop=pageimages&piprop=original&redirects=1&titles=' +
    encodeURIComponent(title).replace(/'/g, '%27');
  try {
    const res = await httpFetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      timeoutMs: TIMEOUT_MS,
    });
    if (res.status >= 400) return null;
    const data = res.data as PageImageResponse | undefined;
    const pages = data?.query?.pages ?? {};
    for (const k of Object.keys(pages)) {
      const original = pages[k]?.original?.source;
      if (typeof original === 'string') return original;
    }
  } catch (err: unknown) {
    debug?.(`Fandom direct lookup failed for "${title}": ${(err as Error)?.message ?? err}`);
  }
  return null;
}

/** Search Avatar Fandom, then fetch the image of the top result. */
async function fandomSearchAndFetch(
  query: string,
  httpFetch: HttpFetch,
  debug?: DebugLog,
): Promise<string | null> {
  const url =
    'https://james-camerons-avatar.fandom.com/api.php?' +
    'action=query&format=json&list=search&srlimit=3&srsearch=' +
    encodeURIComponent(query).replace(/'/g, '%27');
  try {
    const res = await httpFetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      timeoutMs: TIMEOUT_MS,
    });
    if (res.status >= 400) return null;
    const data = res.data as PageImageResponse | undefined;
    const search = data?.query?.search;
    if (!Array.isArray(search)) return null;
    // First word relevance filter — guards against absurd matches.
    const firstWord = query.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    for (const result of search) {
      const title = result?.title;
      if (typeof title !== 'string') continue;
      if (firstWord && !title.toLowerCase().includes(firstWord)) continue;
      const img = await fetchFandomImage(title, httpFetch, debug);
      if (img) return img;
    }
  } catch (err: unknown) {
    debug?.(`Fandom search failed for "${query}": ${(err as Error)?.message ?? err}`);
  }
  return null;
}

/** Wikipedia REST summary endpoint — best for actors and films. */
async function fetchWikipediaSummary(
  lang: 'en' | 'fr',
  query: string,
  httpFetch: HttpFetch,
  debug?: DebugLog,
): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
    encodeURIComponent(query).replace(/'/g, '%27');
  try {
    const res = await httpFetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      timeoutMs: TIMEOUT_MS,
    });
    if (res.status >= 400) return null;
    const data = res.data as RestSummaryResponse | undefined;
    const original = data?.originalimage?.source;
    if (typeof original !== 'string') return null;
    if (FRANCHISE_HUB_BLACKLIST.has(query.toLowerCase())) return null;
    return original;
  } catch (err: unknown) {
    debug?.(`Wikipedia ${lang} lookup failed for "${query}": ${(err as Error)?.message ?? err}`);
  }
  return null;
}

/**
 * Resolve a single image URL for a query, trying every source in order.
 * Returns null if every source has nothing.
 */
export async function resolveWikiImage(
  query: string,
  httpFetch: HttpFetch,
  debug?: DebugLog,
): Promise<string | null> {
  const fandomDirect = await fetchFandomImage(query, httpFetch, debug);
  if (fandomDirect) return fandomDirect;

  const fandomSearched = await fandomSearchAndFetch(query, httpFetch, debug);
  if (fandomSearched) return fandomSearched;

  const en = await fetchWikipediaSummary('en', query, httpFetch, debug);
  if (en) return en;

  const fr = await fetchWikipediaSummary('fr', query, httpFetch, debug);
  if (fr) return fr;

  return null;
}
