/**
 * Cloudflare Pages Function — replaces the NestJS backend wiki-image
 * proxy when the site is deployed on Cloudflare Pages.
 *
 * Same strategy as backend/src/wiki-image/wiki-image.service.ts :
 *   1. Avatar Fandom direct page lookup (best Avatar lore coverage).
 *   2. Avatar Fandom search with first-word relevance filter.
 *   3. Wikipedia EN REST summary (actor portraits + film posters).
 *   4. Wikipedia FR REST summary.
 * Returns 404 if no image found — the frontend EntryCard then falls
 * back to the cyan EYWA gradient placeholder via its <img onerror>.
 *
 * Routes : GET /api/wiki-image?q=<title>
 */

const WIKI_USER_AGENT = 'eywa-codex/1.0 (sylvain.ladoire@gmail.com)';

interface PageImageResponse {
  query?: {
    pages?: Record<string, { original?: { source?: string } }>;
    search?: { title?: string }[];
  };
}

interface RestSummaryResponse {
  originalimage?: { source?: string };
}

const FRANCHISE_HUB_BLACKLIST = new Set([
  'avatar (2009 film)',
  'avatar: the way of water',
  'avatar: fire and ash',
  'pandora (avatar)',
  'avatar (franchise)',
  'fictional universe of avatar',
  'list of avatar characters',
]);

async function fetchFandomImage(title: string): Promise<string | null> {
  const url =
    'https://james-camerons-avatar.fandom.com/api.php?' +
    'action=query&format=json&prop=pageimages&piprop=original&redirects=1&titles=' +
    encodeURIComponent(title).replace(/'/g, '%27');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PageImageResponse;
    const pages = data.query?.pages ?? {};
    for (const k of Object.keys(pages)) {
      const original = pages[k]?.original?.source;
      if (typeof original === 'string') return original;
    }
  } catch {
    // network/timeout — fall through
  }
  return null;
}

async function fandomSearchAndFetch(query: string): Promise<string | null> {
  const url =
    'https://james-camerons-avatar.fandom.com/api.php?' +
    'action=query&format=json&list=search&srlimit=3&srsearch=' +
    encodeURIComponent(query).replace(/'/g, '%27');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PageImageResponse;
    const search = data.query?.search;
    if (!Array.isArray(search)) return null;
    const firstWord = query.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    for (const result of search) {
      const title = result?.title;
      if (typeof title !== 'string') continue;
      if (firstWord && !title.toLowerCase().includes(firstWord)) continue;
      const img = await fetchFandomImage(title);
      if (img) return img;
    }
  } catch {
    // search failed
  }
  return null;
}

async function fetchWikipediaSummary(
  lang: 'en' | 'fr',
  query: string,
): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
    encodeURIComponent(query).replace(/'/g, '%27');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKI_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RestSummaryResponse;
    const original = data.originalimage?.source;
    if (typeof original === 'string' && !FRANCHISE_HUB_BLACKLIST.has(query.toLowerCase())) {
      return original;
    }
    if (typeof original === 'string') return original;
  } catch {
    // fall through
  }
  return null;
}

async function resolveImageUrl(query: string): Promise<string | null> {
  return (
    (await fetchFandomImage(query)) ??
    (await fandomSearchAndFetch(query)) ??
    (await fetchWikipediaSummary('en', query)) ??
    (await fetchWikipediaSummary('fr', query))
  );
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  if (!q) {
    return new Response('q query required', { status: 400 });
  }

  const imageUrl = await resolveImageUrl(q);
  if (!imageUrl) {
    return new Response('not found', { status: 404 });
  }

  // Stream the upstream image back, preserving its content-type, with
  // a 30-day public cache so the Cloudflare CDN edge stores it.
  const upstream = await fetch(imageUrl, {
    headers: { 'User-Agent': WIKI_USER_AGENT },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response('upstream error', { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=2592000',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
