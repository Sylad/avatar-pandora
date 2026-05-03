import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { WIKI_USER_AGENT } from './wiki-image.constants';

/**
 * Resolves Wikipedia image URLs for codex covers.
 *
 * Strategy: try EN Wikipedia first (much better coverage of Avatar lore),
 * fall back to FR for European-French topics that Anglophone Wikipedia might
 * miss. If both direct page lookups fail, do a search query and return the
 * top result's image — turns "Hometree" or "Tipani" (no dedicated wiki page)
 * into "the closest related Avatar page that has a poster/image".
 */
@Injectable()
export class WikiImageService {
  async resolveImageUrl(query: string): Promise<string | null> {
    // 1. Try direct page lookup on EN
    const direct = await this.fetchOriginal('en', query);
    if (direct) return direct;

    // 2. Try direct page lookup on FR (some FR-only articles e.g. local trans.)
    const frDirect = await this.fetchOriginal('fr', query);
    if (frDirect) return frDirect;

    // 3. Last resort: full-text search on EN, take the first result's image.
    //    This salvages queries like "Hometree" or "Tipani" that have no
    //    dedicated page but appear on other Avatar pages with images.
    const searched = await this.searchAndFetchOriginal(query);
    if (searched) return searched;

    return null;
  }

  private async fetchOriginal(
    lang: 'en' | 'fr',
    query: string,
  ): Promise<string | null> {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?` +
      'action=query&format=json&prop=pageimages&piprop=original&redirects=1&titles=' +
      encodeURIComponent(query).replace(/'/g, '%27');
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
      });
      const pages = res.data?.query?.pages ?? {};
      for (const k of Object.keys(pages)) {
        const original = pages[k]?.original?.source;
        if (typeof original === 'string') return original;
      }
    } catch {
      // network/timeout — fall through to next strategy
    }
    return null;
  }

  private async searchAndFetchOriginal(query: string): Promise<string | null> {
    const searchUrl =
      'https://en.wikipedia.org/w/api.php?' +
      'action=query&format=json&list=search&srlimit=1&srsearch=' +
      encodeURIComponent(query + ' Avatar Pandora').replace(/'/g, '%27');
    try {
      const sres = await axios.get(searchUrl, {
        headers: { 'User-Agent': WIKI_USER_AGENT },
        timeout: 5000,
      });
      const top = sres.data?.query?.search?.[0]?.title;
      if (typeof top === 'string') return await this.fetchOriginal('en', top);
    } catch {
      // search failed — surface as null
    }
    return null;
  }
}
