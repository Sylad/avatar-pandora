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

    const top = await this.searchTop('en', query);
    if (top) {
      const searched = await this.fetchSummaryImage('en', top);
      if (searched) return searched;
    }

    return null;
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

  private async searchTop(
    lang: 'en' | 'fr',
    query: string,
  ): Promise<string | null> {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?` +
      'action=query&format=json&list=search&srlimit=1&srsearch=' +
      encodeURIComponent(query + ' Avatar Pandora').replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
      });
      const top = res.data?.query?.search?.[0]?.title;
      if (typeof top === 'string') return top;
    } catch {
      // search failed
    }
    return null;
  }
}
