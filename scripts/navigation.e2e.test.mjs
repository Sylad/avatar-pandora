// L20 — consigne de Sylvain : un lien vers les Nouveautés ET vers le Plan de travail partout
// où le site a une navigation, accueil compris, au bureau comme au téléphone ; la pastille
// des nouveautés non vues passe par UN composant (NewsBadge) et UN script (BaseLayout).
// Lit frontend/dist (lancer le build avant) ; tests navigateur en « skip » sans Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const DATA = JSON.parse(readFileSync(new URL('../frontend/public/nouveautes-data/nouveautes.json', import.meta.url), 'utf8'));
const KEY = 'eywa.news.seen-v1';
const OLD_VISIT = { date: '2026-09-01', slugs: [], at: '2026-09-01T10:00:00.000Z' };
const unseenText = (n) => (n === 1 ? '1 nouveauté non vue' : `${n} nouveautés non vues`);

test('accueil : seconde rangée « Suivre le codex » avec Nouveautés (pastille) puis Plan de travail', () => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf8');
  const nav = home.slice(home.indexOf('<nav class="landing-follow'), home.indexOf('</nav>', home.indexOf('<nav class="landing-follow')));
  assert.match(nav, /aria-label="Suivre le codex"/);
  const hrefs = [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ['/nouveautes/', '/plan-de-travail/']);
  assert.match(nav, /class="news-badge[^"]*"[^>]*hidden/, 'pastille absente du lien Nouveautés de l’accueil');
});

test('une seule pastille (composant NewsBadge) et un seul index des nouveautés par page', () => {
  for (const p of ['index.html', 'pandora/index.html', 'nouveautes/index.html', 'plan-de-travail/index.html']) {
    const page = readFileSync(join(DIST, p), 'utf8');
    assert.equal((page.match(/id="eywa-news-index"/g) ?? []).length, 1, `${p} : index des nouveautés`);
    const m = page.match(/<script type="application\/json" id="eywa-news-index"[^>]*>([^<]*)<\/script>/);
    assert.deepEqual(JSON.parse(m[1]), DATA.entries.map(({ slug, date }) => ({ slug, date })), `${p} : index ≠ slug + date`);
    assert.equal((page.match(/class="news-badge[ "]/g) ?? []).length, 1, `${p} : une pastille attendue`);
    assert.doesNotMatch(page, /eywa-news-badge/, `${p} : ancienne pastille dupliquée`);
  }
});

const rowOf = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((a) => {
  const b = a.getBoundingClientRect();
  return { href: a.getAttribute('href'), top: Math.round(b.top), bottom: b.bottom, left: b.left, right: b.right, h: b.height };
}), sel);

test('accueil 1440×900 et 1366×768 : boutons et liens visibles sans défiler, deux rangées complètes (aucun lien seul)', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [width, height] of [[1440, 900], [1366, 768]]) {
    const context = await env.browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const { sh, sw } = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight - innerHeight, sw: document.documentElement.scrollWidth - innerWidth }));
    assert.ok(sh <= 0 && sw <= 0, `${width}×${height} : défilement (${sw}, ${sh})`);
    const ctas = await rowOf(page, 'main > div a');
    const follow = await rowOf(page, '.landing-follow a');
    assert.equal(new Set(ctas.map((r) => r.top)).size, 1, `${width} : boutons sur plusieurs lignes`);
    assert.equal(new Set(follow.map((r) => r.top)).size, 1, `${width} : Nouveautés et Plan de travail sur deux lignes`);
    for (const r of [...ctas, ...follow]) assert.ok(r.bottom <= height, `${width}×${height} : ${r.href} sous le bord`);
    await context.close();
  }
});

test('accueil téléphone 390×844, 320×640, 320×568 : Nouveautés et Plan de travail côte à côte, cibles ≥ 44 px, sans défilement', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [width, height] of [[390, 844], [320, 640], [320, 568]]) {
    const context = await env.browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${env.base}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const follow = await rowOf(page, '.landing-follow a');
    assert.equal(follow.length, 2);
    assert.equal(new Set(follow.map((r) => r.top)).size, 1, `${width} : liens sur deux lignes`);
    for (const r of follow) {
      assert.ok(r.h >= 44, `${width} : ${r.href} haut de ${r.h}px`);
      assert.ok(r.left >= 0 && r.right <= width, `${width} : ${r.href} hors de l’écran`);
      assert.ok(r.bottom <= height, `${width}×${height} : ${r.href} sous le bord`);
    }
    const { sh, sw } = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight - innerHeight, sw: document.documentElement.scrollWidth - innerWidth }));
    assert.ok(sw <= 0, `${width} : débordement horizontal ${sw}px`);
    assert.ok(sh <= 0, `${width}×${height} : l’accueil défile de ${sh}px`);
    await context.close();
  }
});

test('accueil : pastille sur le lien Nouveautés (nom accessible compris) ; liens atteints au clavier, contour visible', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const n = DATA.entries.length;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/`, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, OLD_VISIT]);
  await page.reload({ waitUntil: 'load' });
  const link = page.locator('.landing-follow a[href="/nouveautes/"]');
  await link.locator('.news-badge').waitFor({ state: 'visible' });
  assert.equal((await link.locator('.news-badge__n').textContent()).trim(), String(n));
  assert.equal(await page.getByRole('link', { name: new RegExp(`^Nouveautés \\(${unseenText(n)}\\)$`) }).count(), 1);
  // La pastille ne grandit pas le lien.
  const [a, b] = await rowOf(page, '.landing-follow a');
  assert.ok(Math.abs(a.h - b.h) < 0.5, `hauteurs ${a.h} / ${b.h}`);
  for (const href of ['/nouveautes/', '/plan-de-travail/']) {
    await page.evaluate(() => document.activeElement?.blur());
    let reached = false;
    for (let i = 0; i < 30 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate((h) => document.activeElement?.closest('.landing-follow') && document.activeElement.getAttribute('href') === h, href);
    }
    assert.ok(reached, `${href} hors de l’ordre de tabulation`);
    const o = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
    assert.ok(o.style !== 'none' && o.w >= 2, `${href} : contour de focus invisible`);
  }
  // Plan de travail atteint depuis l'accueil.
  await Promise.all([page.waitForURL((u) => u.pathname === '/plan-de-travail/'), page.keyboard.press('Enter')]);
  await context.close();
});

test('bureau 1440×900, 1366×768, 1280×720 : les 12 liens de la barre latérale visibles sans défiler, Plan de travail juste après Nouveautés', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720]]) {
    const context = await env.browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/plan-de-travail/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const links = await rowOf(page, '#eywa-sidebar a');
    assert.equal(links.length, 13, `${width} : logo + 12 liens attendus`);
    const hidden = links.filter((l) => l.bottom > height || l.top < 0).map((l) => l.href);
    assert.deepEqual(hidden, [], `${width}×${height} : liens hors de l’écran`);
    for (const l of links.slice(1)) assert.ok(l.h >= 24, `${width} : ${l.href} cible de ${l.h}px`);
    const hrefs = links.map((l) => l.href);
    assert.equal(hrefs[hrefs.indexOf('/nouveautes/') + 1], '/plan-de-travail/');
    await context.close();
  }
});

test('accueil 1440/390 px : libellés Nouveautés et Plan de travail ≥ 4,5:1 au pire pixel, particules animées', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const report = [];
  const failures = [];
  for (const width of [1440, 390]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const frame of [1, 2, 3]) {
      await page.goto(`${env.base}/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800 + 700 * frame);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      for (const href of ['/nouveautes/', '/plan-de-travail/']) {
        const sel = `.landing-follow a[href="${href}"] > span:not(.news-badge)`;
        const { worst, glyphs } = await worstPixelContrast(page, sel);
        report.push(`${href} @${width}px image ${frame} : ${worst.toFixed(2)}:1 (${glyphs} px)`);
        assert.ok(glyphs > 20, `${href} @${width} : glyphes non détectés`);
        if (worst < 4.5) failures.push(`${href} @${width}px image ${frame} : ${worst.toFixed(2)}:1`);
      }
    }
    await context.close();
  }
  for (const line of report) t.diagnostic(line);
  assert.deepEqual(failures, []);
});

// Revue UX L20 : à 320×568, le bouton de pause de l'ambiance (fixe, en bas à droite)
// recouvrait la fin de « Plan de travail » — un toucher mettait en pause au lieu d'ouvrir.
test('accueil 320×568, 360×640, 390×844, avec et sans pastille : aucun élément interactif n’en recouvre un autre, sans défilement', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [width, height] of [[320, 568], [360, 640], [390, 844]]) {
    for (const badge of [false, true]) {
      // Mouvement NON réduit : le bouton de pause n'existe qu'avec l'ambiance animée.
      const context = await env.browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto(`${env.base}/`, { waitUntil: 'load' });
      if (badge) {
        await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, OLD_VISIT]);
        await page.reload({ waitUntil: 'load' });
        await page.locator('.landing-follow .news-badge').waitFor({ state: 'visible' });
      }
      await page.evaluate(() => document.fonts.ready);
      const { boxes, overlaps, sh } = await page.evaluate(() => {
        const els = [...document.querySelectorAll('a[href], button')].filter((e) => {
          const s = getComputedStyle(e);
          const b = e.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
        });
        const boxes = els.map((e) => ({ name: (e.id || e.getAttribute('href') || e.textContent.trim()).slice(0, 30), b: e.getBoundingClientRect() }));
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const [a, c] = [boxes[i].b, boxes[j].b];
          const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
          const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          if (w > 0 && h > 0) overlaps.push(`${boxes[i].name} × ${boxes[j].name} : ${w.toFixed(0)}×${h.toFixed(0)} px`);
        }
        return { boxes: boxes.map((x) => x.name), overlaps, sh: document.documentElement.scrollHeight - innerHeight };
      });
      assert.ok(boxes.includes('eywa-atmo-toggle'), `${width}×${height} : bouton de pause non mesuré`);
      assert.deepEqual(overlaps, [], `${width}×${height}${badge ? ' avec pastille' : ''}`);
      assert.ok(sh <= 0, `${width}×${height}${badge ? ' avec pastille' : ''} : l’accueil défile de ${sh}px`);
      await context.close();
    }
  }
});
