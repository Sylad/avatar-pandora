/**
 * Cloudflare Pages Function — replaces the NestJS backend wiki-image
 * proxy when the site is deployed on Cloudflare Pages.
 *
 * Same strategy as the NestJS service : both call into the shared
 * `resolveWikiImage` (mirrored from `shared/wiki-image-strategy.ts`).
 * This file is just a thin adapter around the native Cloudflare `fetch`
 * + the streaming response.
 *
 * Routes : GET /api/wiki-image?q=<title>
 */

import {
  resolveWikiImage,
  WIKI_USER_AGENT,
  type HttpFetch,
} from '../_shared/wiki-image-strategy';

/** native fetch → shared HttpFetch adapter. */
const httpFetch: HttpFetch = async (url, opts) => {
  const res = await fetch(url, {
    headers: opts?.headers,
    signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });
  // Match axios' `validateStatus: s => s < 500` semantics — 4xx is just
  // "no result", not an exception. Only parse JSON when status < 500 and
  // the response advertises JSON.
  let data: unknown = null;
  if (res.status < 500) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  return { status: res.status, data };
};

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  if (!q) {
    return new Response('q query required', { status: 400 });
  }

  const imageUrl = await resolveWikiImage(q, httpFetch);
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
