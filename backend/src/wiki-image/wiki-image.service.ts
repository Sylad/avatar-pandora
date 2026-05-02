import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WikiImageService {
  async resolveImageUrl(query: string): Promise<string | null> {
    const url =
      'https://fr.wikipedia.org/w/api.php?' +
      'action=query&format=json&prop=pageimages&piprop=original&titles=' +
      encodeURIComponent(query).replace(/'/g, '%27');
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'eywa-codex/1.0 (sylvain.ladoire@gmail.com)' },
      timeout: 5000,
    });
    const pages = res.data?.query?.pages ?? {};
    for (const k of Object.keys(pages)) {
      const original = pages[k]?.original?.source;
      if (typeof original === 'string') return original;
    }
    return null;
  }
}
