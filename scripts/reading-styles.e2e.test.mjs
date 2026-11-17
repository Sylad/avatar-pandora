// L29 — styles de lecture des fiches (la classe prose était sans effet, Tailwind 4 sans
// @tailwindcss/typography) : lignes de ~75 caractères au plus, intertitres plus grands que le
// corps et aux couleurs Eywa. Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const SECTIONS = ['pandora', 'clans', 'bestiaire', 'flore', 'personnages', 'films', 'engins'];
const BIO_PRIMARY = 'rgb(95, 255, 230)';

function fiches() {
  const out = [];
  for (const s of SECTIONS) {
    for (const d of readdirSync(join(DIST, s), { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(join(DIST, s, d.name, 'index.html'))) out.push(`/${s}/${d.name}/`);
    }
  }
  return out;
}

// Caractères de la plus longue ligne de chaque paragraphe du corps : une plage par caractère,
// regroupées par ligne (haut du rectangle).
function longestLines() {
  return [...document.querySelectorAll('article .entry-body > p')].map((p) => {
    const lines = new Map();
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (!r) continue;
        const top = Math.round(r.top);
        lines.set(top, (lines.get(top) ?? 0) + 1);
      }
    }
    return Math.max(0, ...lines.values());
  });
}

test('R1 — toutes les fiches @1440px : colonne du corps ≤ 28,5 em, intertitres ≥ 1,15× le corps et en cyan Eywa', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
  const urls = fiches();
  assert.ok(urls.length >= 60, `fiches trouvées : ${urls.length}`);
  let h2Seen = 0;
  for (const url of urls) {
    await page.goto(`${env.base}${url}`, { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const body = document.querySelector('article .entry-body');
      const p = body.querySelector(':scope > p');
      const font = parseFloat(getComputedStyle(p).fontSize);
      return {
        widthEm: p.getBoundingClientRect().width / font,
        h2: [...body.querySelectorAll(':scope > h2')].map((h) => ({
          ratio: parseFloat(getComputedStyle(h).fontSize) / font,
          color: getComputedStyle(h).color,
        })),
      };
    });
    assert.ok(m.widthEm <= 28.5, `${url} : colonne de ${m.widthEm.toFixed(1)} em`);
    for (const h of m.h2) {
      h2Seen++;
      assert.ok(h.ratio >= 1.15, `${url} : intertitre à ${h.ratio.toFixed(2)}× le corps`);
      assert.equal(h.color, BIO_PRIMARY, `${url} : couleur d'intertitre`);
    }
  }
  assert.ok(h2Seen > 100, `intertitres vus : ${h2Seen}`);
});

for (const width of [1440, 390]) {
  test(`R2 — fiches Ikran, Eywa, Hometree @${width}px : aucune ligne du corps au-delà de 80 caractères (WCAG 1.4.8), pas de défilement horizontal`, { timeout: 120_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    for (const url of ['/bestiaire/ikran/', '/pandora/eywa/', '/flore/hometree/']) {
      await page.goto(`${env.base}${url}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const longest = await page.evaluate(longestLines);
      assert.ok(longest.length > 0, `${url} : aucun paragraphe`);
      const max = Math.max(...longest);
      assert.ok(max <= 80, `${url} @${width}px : ligne de ${max} caractères`);
      if (width === 1440) assert.ok(max >= 60, `${url} : colonne trop étroite (${max} caractères)`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 0, `${url} @${width}px : débordement de ${overflow}px`);
    }
  });
}
