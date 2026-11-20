// L63 — précaution acceptée par Sylvain : aucune page du site construit ne doit être indexée
// ni ses liens suivis par les moteurs : le bestiaire montre des images des films, avec le crédit
// « © 20th Century Studios » (décision de Sylvain du 19-11-2026, condition du noindex). Chaque page HTML de frontend/dist porte une seule balise
// <meta name="robots" content="noindex, nofollow">, dans le <head>.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIST } from './lib/e2e-dist.mjs';

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return f.endsWith('.html') ? [p] : [];
  });
}

test('R1 — chaque page construite porte meta robots « noindex, nofollow » dans son <head>', () => {
  const pages = htmlFiles(DIST);
  // 82 pages au build (cf. CLAUDE.md) : on refuse une sortie vide ou tronquée.
  assert.ok(pages.length >= 80, `${pages.length} pages HTML seulement dans dist/`);
  const fautes = [];
  for (const p of pages) {
    const html = readFileSync(p, 'utf8');
    const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    const metas = [...html.matchAll(/<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/gi)];
    const dansHead = [...head.matchAll(/<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/gi)];
    if (metas.length !== 1 || dansHead.length !== 1 || dansHead[0][1] !== 'noindex, nofollow') {
      fautes.push(`${relative(DIST, p)} : ${metas.map((m) => m[1]).join(' | ') || 'absente'}`);
    }
  }
  assert.deepEqual(fautes, []);
});
