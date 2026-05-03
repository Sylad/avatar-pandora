import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { WIKI_USER_AGENT } from './wiki-image.constants';

/**
 * Resolves Wikipedia image URLs for codex covers.
 *
 * Uses Wikipedia's REST `/page/summary/` endpoint (NOT the action API's
 * `prop=pageimages`, which returns nothing for many film/franchise pages
 * because the Wikipedia "page image" property isn't set even when the
 * infobox has a poster). The REST summary returns `originalimage.source`
 * for any page that has an infobox image — much higher hit rate for
 * Avatar lore.
 *
 * Strategy:
 *   1. EN summary direct (best Avatar coverage)
 *   2. FR summary direct (some FR-only articles)
 *   3. Action API search on EN, then summary of the top result
 */
@Injectable()
export class WikiImageService {
  async resolveImageUrl(query: string): Promise<string | null> {
    const en = await this.fetchSummaryImage('en', query);
    if (en) return en;

    const fr = await this.fetchSummaryImage('fr', query);
    if (fr) return fr;

    // Iterate through top 10 search results with three filters that
    // together prevent the "wildly unrelated cover" failure mode :
    //   1. Skip franchise hub pages (their posters used as default
    //      thumbnails would create dup covers across many entries).
    //   2. Require the result title to contain the FIRST word of the
    //      original query. Without this, "Banshee Avatar" returned
    //      Pandora theme-park pages, and "Tulkun Avatar" returned
    //      Neytiri's portrait. The first word is the distinctive token
    //      (e.g. Banshee, Tulkun, Bailey, Hometree) — if it's not in
    //      the result title, the result is unrelated.
    //   3. Skip results that have no infobox image (handled by
    //      fetchSummaryImage returning null).
    const firstWord = query.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const candidates = await this.searchCandidates('en', query, 10);
    for (const title of candidates) {
      if (this.isGenericFranchisePage(title)) continue;
      if (firstWord && !title.toLowerCase().includes(firstWord)) continue;
      const searched = await this.fetchSummaryImage('en', title);
      if (searched) return searched;
    }

    return null;
  }

  private isGenericFranchisePage(title: string): boolean {
    const t = title.toLowerCase();
    return (
      t === 'avatar (2009 film)' ||
      t === 'avatar: the way of water' ||
      t === 'avatar: fire and ash' ||
      t === 'pandora (avatar)' ||
      t === 'avatar (franchise)' ||
      t === 'fictional universe of avatar' ||
      t === 'list of avatar characters' ||
      t === 'avatar 4' ||
      t === 'avatar 5'
    );
  }

  private async fetchSummaryImage(
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
        validateStatus: (s) => s < 500, // 404 is a normal "not found", not an error
      });
      if (res.status >= 400) return null;
      const original = res.data?.originalimage?.source;
      if (typeof original === 'string') return original;
    } catch {
      // network/timeout — fall through
    }
    return null;
  }

  private async searchCandidates(
    lang: 'en' | 'fr',
    query: string,
    limit: number,
  ): Promise<string[]> {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?` +
      `action=query&format=json&list=search&srlimit=${limit}&srsearch=` +
      encodeURIComponent(query + ' Avatar Pandora').replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
      });
      const search = res.data?.query?.search;
      if (Array.isArray(search)) {
        return search
          .map((r: { title?: unknown }) => r?.title)
          .filter((t: unknown): t is string => typeof t === 'string');
      }
    } catch {
      // search failed
    }
    return [];
  }
}
