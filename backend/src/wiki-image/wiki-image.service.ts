import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { WIKI_USER_AGENT } from './wiki-image.constants';

/**
 * Resolves cover images for codex entries.
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
 */
@Injectable()
export class WikiImageService {
  private readonly logger = new Logger(WikiImageService.name);

  async resolveImageUrl(query: string): Promise<string | null> {
    const fandomDirect = await this.fetchFandomImage(query);
    if (fandomDirect) return fandomDirect;

    const fandomSearched = await this.fandomSearchAndFetch(query);
    if (fandomSearched) return fandomSearched;

    const en = await this.fetchWikipediaSummary('en', query);
    if (en) return en;

    const fr = await this.fetchWikipediaSummary('fr', query);
    if (fr) return fr;

    return null;
  }

  /** Fetch the original infobox image for an Avatar Fandom page directly. */
  private async fetchFandomImage(title: string): Promise<string | null> {
    const url =
      'https://james-camerons-avatar.fandom.com/api.php?' +
      'action=query&format=json&prop=pageimages&piprop=original&redirects=1&titles=' +
      encodeURIComponent(title).replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) return null;
      const pages = res.data?.query?.pages ?? {};
      for (const k of Object.keys(pages)) {
        const original = pages[k]?.original?.source;
        if (typeof original === 'string') return original;
      }
    } catch (err: unknown) {
      this.logger.debug(`Fandom direct lookup failed for "${title}": ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  /** Search Avatar Fandom, then fetch the image of the top result. */
  private async fandomSearchAndFetch(
    query: string,
  ): Promise<string | null> {
    const url =
      'https://james-camerons-avatar.fandom.com/api.php?' +
      'action=query&format=json&list=search&srlimit=3&srsearch=' +
      encodeURIComponent(query).replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) return null;
      const search = res.data?.query?.search;
      if (!Array.isArray(search)) return null;
      // First word relevance filter — guards against absurd matches.
      const firstWord = query.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      for (const result of search) {
        const title = result?.title;
        if (typeof title !== 'string') continue;
        if (firstWord && !title.toLowerCase().includes(firstWord)) continue;
        const img = await this.fetchFandomImage(title);
        if (img) return img;
      }
    } catch (err: unknown) {
      this.logger.debug(`Fandom search failed for "${query}": ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  /** Wikipedia REST summary endpoint — best for actors and films. */
  private async fetchWikipediaSummary(
    lang: 'en' | 'fr',
    query: string,
  ): Promise<string | null> {
    const url =
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
      encodeURIComponent(query).replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
        validateStatus: (s) => s < 500,
      });
      if (res.status >= 400) return null;
      const original = res.data?.originalimage?.source;
      if (typeof original === 'string') return original;
    } catch (err: unknown) {
      this.logger.debug(`Wikipedia ${lang} lookup failed for "${query}": ${(err as Error)?.message ?? err}`);
    }
    return null;
  }
}
