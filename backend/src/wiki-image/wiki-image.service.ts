import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { resolveWikiImage, type HttpFetch } from '../_shared/wiki-image-strategy';

/**
 * NestJS thin adapter around the shared wiki-image strategy.
 *
 * The actual 4-step resolution lives in `shared/wiki-image-strategy.ts`
 * (mirrored into `src/_shared/` by `scripts/sync-shared.cjs`). This file
 * only :
 *   - wraps axios in the shared `HttpFetch` adapter signature
 *   - pipes debug output to NestJS's Logger
 *   - keeps `WikiImageService.resolveImageUrl()` as the public API used
 *     by `WikiImageController` and the existing tests.
 */
@Injectable()
export class WikiImageService {
  private readonly logger = new Logger(WikiImageService.name);

  async resolveImageUrl(query: string): Promise<string | null> {
    return resolveWikiImage(query, this.httpFetch, (msg) => this.logger.debug(msg));
  }

  /** axios → shared HttpFetch adapter. */
  private readonly httpFetch: HttpFetch = async (url, opts) => {
    const res = await axios.get(url, {
      headers: opts?.headers,
      timeout: opts?.timeoutMs,
      validateStatus: (s) => s < 500,
    });
    return { status: res.status, data: res.data };
  };
}
