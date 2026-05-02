import { Controller, Get, Query, Res, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';
import { WIKI_USER_AGENT } from './wiki-image.constants';

@Controller('wiki-image')
export class WikiImageController {
  constructor(private readonly service: WikiImageService) {}

  @Get()
  async fetch(@Query('q') q: string, @Res() res: Response) {
    if (!q || typeof q !== 'string') {
      throw new HttpException('q query required', 400);
    }
    const url = await this.service.resolveImageUrl(q);
    if (!url) throw new HttpException('not found', 404);
    const stream = await axios.get(url, {
      responseType: 'stream',
      headers: { 'User-Agent': WIKI_USER_AGENT },
    });
    res.setHeader('Content-Type', stream.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    stream.data.on('error', (err: Error) => {
      console.error('[wiki-image] upstream stream error:', err.message);
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    stream.data.pipe(res);
  }
}
