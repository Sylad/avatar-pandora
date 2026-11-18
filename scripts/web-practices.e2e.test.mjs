// L61 — revue « bonnes pratiques d'une appli web standard » : page 404 (Nielsen 9), texte jamais
// sous 12 px et toujours en rem (WCAG 1.4.4), cibles ≥ 24 px ou assez espacées (WCAG 2.5.8).
// Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const SRC = fileURLToPath(new URL('../frontend/src/', import.meta.url));
// Un modèle de chaque écran : accueil, pages méta, sections, une fiche par section, 404.
const PAGES = ['/', '/about/', '/pandora/', '/pandora/eywa/', '/clans/', '/clans/anurai/', '/bestiaire/',
  '/bestiaire/ikran/', '/flore/', '/flore/hometree/', '/personnages/', '/personnages/neytiri/', '/films/',
  '/engins/', '/engins/amp-suit/', '/langue/', '/videos/', '/nouveautes/', '/plan-de-travail/', '/404.html'];

test('R1 — dist/404.html existe : Cloudflare Pages sert une vraie page introuvable (statut 404) au lieu de l’accueil', () => {
  const file = join(DIST, '404.html');
  assert.ok(existsSync(file), 'dist/404.html absent : une adresse fausse rendrait l’accueil avec un statut 200');
  const html = readFileSync(file, 'utf8');
  assert.match(html, /<title>Page introuvable — Eywa<\/title>/);
  assert.match(html, /<h1[^>]*>Cette page n'existe pas<\/h1>/);
});

test('R1 — la page introuvable propose de repartir : accueil, codex, et la navigation complète', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${env.base}/404.html`, { waitUntil: 'load' });
  const repartir = page.getByRole('navigation', { name: 'Repartir' });
  assert.equal(await repartir.getByRole('link', { name: "← Retour à l'accueil" }).getAttribute('href'), '/');
  assert.equal(await repartir.getByRole('link', { name: 'Ouvrir le codex' }).getAttribute('href'), '/pandora/');
  assert.ok(await page.locator('#eywa-sidebar a[href="/nouveautes/"]').count() >= 1, 'barre latérale absente');
});

test('R2 — aucune taille de police en px dans les sources (le texte suit le réglage du navigateur)', () => {
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'content') walk(p); continue; }
      if (!/\.(astro|css|tsx?)$/.test(e.name)) continue;
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/font-size:\s*[\d.]+px|text-\[[\d.]+px\]/.test(line)) found.push(`${p.slice(SRC.length)}:${i + 1}`);
      });
    }
  };
  walk(SRC);
  assert.deepEqual(found, []);
});

for (const width of [1440, 390]) {
  test(`R2/R3 @${width}px — aucun texte visible sous 12 px, aucune cible sous 24 px sans espacement suffisant`, { timeout: 180_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width, height: width > 1000 ? 900 : 844 } });
    const failures = [];
    for (const path of PAGES) {
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      const r = await page.evaluate(() => {
        const shown = (el) => {
          const s = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return s.visibility !== 'hidden' && b.width > 0 && b.height > 0 && !el.closest('[hidden], [inert], [aria-hidden="true"], .sr-only, .eywa-skip-link');
        };
        const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/)[0]} « ${el.textContent.trim().slice(0, 30)} »`;
        const small = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!n.textContent.trim() || el.closest('script, style') || !shown(el)) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 12) small.push(`${size}px ${name(el)}`);
        }
        // WCAG 2.5.8 : une cible < 24 px passe si un cercle de 24 px centré sur elle ne touche aucune autre
        // cible. Les liens au fil d'une phrase sont exemptés (exception « en ligne »).
        const targets = [...document.querySelectorAll('a[href], button, input, select, textarea, summary')].filter(shown);
        const boxes = targets.map((el) => el.getBoundingClientRect());
        const tiny = [];
        targets.forEach((el, i) => {
          const b = boxes[i];
          if (b.width >= 24 && b.height >= 24) return;
          const block = el.parentElement.closest('p, li, dd, figcaption');
          if (getComputedStyle(el).display === 'inline' && block && block.textContent.trim().length > el.textContent.trim().length + 10) return;
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          const clash = boxes.some((o, j) => j !== i && !el.contains(targets[j]) && !targets[j].contains(el)
            && Math.hypot(cx - Math.max(o.left, Math.min(cx, o.right)), cy - Math.max(o.top, Math.min(cy, o.bottom))) < 12);
          if (clash) tiny.push(`${Math.round(b.width)}×${Math.round(b.height)} ${name(el)}`);
        });
        return { small, tiny };
      });
      for (const s of r.small) failures.push(`${path} : texte ${s}`);
      for (const s of r.tiny) failures.push(`${path} : cible ${s}`);
    }
    assert.deepEqual(failures, []);
  });
}

test('R3 — fiche Personnages : le retour à la liste est nommé comme les six autres sections et mesure ≥ 24 px', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${env.base}/personnages/neytiri/`, { waitUntil: 'load' });
  const link = page.getByRole('navigation', { name: 'Retour à la liste' }).getByRole('link', { name: '← Tous les personnages' });
  assert.equal(await link.getAttribute('href'), '/personnages/');
  const box = await link.boundingBox();
  assert.ok(box.height >= 24, `hauteur ${box.height}px`);
});
