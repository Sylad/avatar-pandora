// L14 — page /nouveautes/ : contenu généré au build depuis nouveautes.json, lien du menu
// (barre latérale au bureau, tiroir au téléphone), contraste, clavier, visionneuse des
// captures et reflow à 320 px.
//
// Lit le site CONSTRUIT (frontend/dist) : lancer `npx astro build` avant. Les tests
// statiques échouent si dist est absent ou périmé ; les tests navigateur se mettent en
// « skip » sans playwright-core ni Chromium.
// EYWA_E2E_SHOTS=<dossier> enregistre une capture de la page à 1440, 390 et 320 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const DATA = JSON.parse(readFileSync(new URL('../frontend/public/nouveautes-data/nouveautes.json', import.meta.url), 'utf8'));
const PAGE = join(DIST, 'nouveautes', 'index.html');
const html = () => readFileSync(PAGE, 'utf8');
// Balise <a> qui mène à /nouveautes/ dans la barre latérale d'une page construite.
const sidebarLink = (page) => {
  const aside = page.slice(page.indexOf('<aside id="eywa-sidebar"'), page.indexOf('</aside>'));
  return aside.match(/<a [^>]*href="\/nouveautes\/"[^>]*>/)?.[0];
};

test('dist/nouveautes/index.html est construit, titré « Nouveautés »', () => {
  assert.ok(existsSync(PAGE), 'page absente : lancer `npx astro build`');
  assert.match(html(), /<title>Nouveautés — Eywa<\/title>/);
  assert.match(html(), /<h1[^>]*>[^<]*<\/h1>/);
});

test('une entrée par nouveauté, dans l’ordre du JSON (la plus récente en haut), titre + date + texte', () => {
  const page = html();
  const ids = [...page.matchAll(/<article[^>]*class="news-entry[^"]*"[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, DATA.entries.map((e) => e.slug));
  for (const e of DATA.entries) {
    const start = page.indexOf(`id="${e.slug}"`);
    const block = page.slice(start, page.indexOf('</article>', start));
    assert.ok(block.includes(`<time datetime="${e.date}"`), `${e.slug} : date absente`);
    assert.ok(block.includes(e.title), `${e.slug} : titre absent`);
    assert.ok(block.includes(e.html.slice(0, 60)), `${e.slug} : texte absent`);
    for (const c of e.captures) {
      assert.ok(block.includes(`src="/nouveautes-data/${c}"`), `${e.slug} : capture ${c} absente`);
      assert.ok(existsSync(join(DIST, 'nouveautes-data', c)), `${c} non servie`);
    }
    assert.match(block, /<img [^>]*width="\d+"[^>]*height="\d+"/, `${e.slug} : dimensions des captures absentes`);
  }
});

test('date affichée en français (« 1 octobre 2026 »)', () => {
  assert.match(html(), /<time datetime="2026-10-01"[^>]*>1 octobre 2026<\/time>/);
});

test('pas de page cadence brute servie sous /nouveautes-data/', () => {
  assert.ok(!existsSync(join(DIST, 'nouveautes-data', 'index.html')));
});

test('la barre latérale de toutes les pages du codex mène à /nouveautes/, active sur la page', () => {
  for (const p of ['pandora', 'pandora/eywa', 'bestiaire', 'langue', 'videos']) {
    assert.ok(sidebarLink(readFileSync(join(DIST, p, 'index.html'), 'utf8')), `${p} : lien Nouveautés absent`);
  }
  assert.match(sidebarLink(html()) ?? '', /aria-current="page"/);
  assert.doesNotMatch(sidebarLink(readFileSync(join(DIST, 'pandora', 'index.html'), 'utf8')), /aria-current/);
});

// ── Navigateur ──────────────────────────────────────────────────────────────

// Contraste WCAG du texte des entrées sur le fond de la carte, composé dans le PIRE cas
// (fond blanc sous la carte translucide : les particules et halos peuvent l'éclaircir).
const worstContrast = (page) => page.evaluate(() => {
  // rgb()/rgba() en 0–255, ou color(srgb r g b / a) en 0–1 (couleurs color-mix des termes du lore).
  const rgba = (s) => {
    const m = s.match(/[\d.]+/g).map(Number);
    if (s.startsWith('color(srgb')) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1];
    return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
  const out = [];
  for (const card of document.querySelectorAll('.news-entry')) {
    const bg = over(rgba(getComputedStyle(card).backgroundColor), [255, 255, 255]);
    for (const el of card.querySelectorAll('h2, time, p, li, strong, a, span')) {
      const fg = over(rgba(getComputedStyle(el).color), bg);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      out.push({ sel: `${card.id} ${el.tagName}`, ratio: (a + 0.05) / (b + 0.05) });
    }
  }
  return out;
});

test('reflow 320/390/1440 px : aucun défilement horizontal, captures dans la largeur, contraste ≥ 4,5:1', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const shots = process.env.EYWA_E2E_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  for (const width of [320, 390, 1440]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
    assert.equal(await page.locator('.news-entry').count(), DATA.entries.length, `${width}px : entrées absentes`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 0, `${width}px : débordement horizontal de ${overflow}px`);
    const wide = await page.evaluate(() => [...document.querySelectorAll('.news-entry img')]
      .filter((i) => i.getBoundingClientRect().right > innerWidth + 0.5).length);
    assert.equal(wide, 0, `${width}px : capture plus large que l'écran`);
    // Captures en loading="lazy" : forcer leur chargement, puis vérifier qu'elles s'affichent.
    await page.evaluate(() => document.querySelectorAll('.news-entry img').forEach((i) => { i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.querySelectorAll('.news-entry img')].every((i) => i.complete));
    const broken = await page.evaluate(() => [...document.querySelectorAll('.news-entry img')].filter((i) => !i.naturalWidth).map((i) => i.src));
    assert.deepEqual(broken, [], `${width}px : captures non chargées`);
    for (const { sel, ratio } of await worstContrast(page)) assert.ok(ratio >= 4.5, `${width}px ${sel} : ${ratio.toFixed(2)}:1`);
    if (shots) await page.screenshot({ path: join(shots, `nouveautes-${width}.png`), fullPage: true });
    await context.close();
  }
});

test('téléphone 390 px : le tiroir propose « Nouveautés » et y mène', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  await page.click('#eywa-burger');
  const link = page.locator('#eywa-sidebar a[href="/nouveautes/"]');
  await link.scrollIntoViewIfNeeded();
  await Promise.all([page.waitForURL((u) => u.pathname === '/nouveautes/'), link.click()]);
  await page.waitForSelector('.news-entry');
  await context.close();
});

test('bureau 1440 px, au clavier : Tab atteint « Nouveautés » dans la barre latérale, Entrée y mène', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.getAttribute('href') === '/nouveautes/');
  }
  assert.ok(reached, 'lien Nouveautés hors de l’ordre de tabulation');
  assert.ok(await page.evaluate(() => document.activeElement.getBoundingClientRect().width > 0), 'lien Nouveautés invisible au bureau');
  await Promise.all([page.waitForURL((u) => u.pathname === '/nouveautes/'), page.keyboard.press('Enter')]);
  await page.waitForSelector('.news-entry');
  await context.close();
});

// Entrée sur le lien d'une capture ouvre la visionneuse comme le clic, pas le PNG brut
// (leçon de la revue UX L13 d'evatosorus) — aussi après une navigation par le menu
// (ClientRouter : la page arrive sans rechargement complet).
test('visionneuse : Entrée et clic sur une capture l’ouvrent, Échap la ferme, liens du menu non interceptés', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const isOpen = () => page.evaluate(() => document.getElementById('eywa-lightbox')?.hasAttribute('open'));
  const check = async (label) => {
    await page.locator('.news-capture').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.equal(new URL(page.url()).pathname, '/nouveautes/', `${label} : Entrée a ouvert le PNG brut`);
    assert.ok(await isOpen(), `${label} : visionneuse fermée après Entrée`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('eywa-lightbox').hasAttribute('open'));
    await page.locator('.news-capture img').first().click();
    assert.ok(await isOpen(), `${label} : visionneuse fermée après clic`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('eywa-lightbox').hasAttribute('open'));
  };

  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  await check('chargement direct');

  // Lien ordinaire de la barre latérale : navigation normale, pas de visionneuse.
  await Promise.all([page.waitForURL((u) => u.pathname === '/pandora/'), page.locator('#eywa-sidebar a[href="/pandora/"]').click()]);
  assert.ok(!(await isOpen()));
  // Retour par le menu (navigation ClientRouter), puis même contrôle.
  await Promise.all([page.waitForURL((u) => u.pathname === '/nouveautes/'), page.locator('#eywa-sidebar a[href="/nouveautes/"]').click()]);
  await page.waitForSelector('.news-capture');
  await check('après navigation par le menu');
  await context.close();
});

// Avant leur chargement, les captures occupent déjà leur place aux bonnes proportions
// (pas de saut de mise en page à 320 px).
test('320 px, captures pas encore chargées : la place est réservée aux bonnes proportions', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 320, height: 700 } });
  const page = await context.newPage();
  await page.route('**/nouveautes-data/captures/**', (route) => route.abort());
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'domcontentloaded' });
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.news-capture img')].map((i) => {
    const r = i.getBoundingClientRect();
    return { src: i.getAttribute('src'), w: r.width, h: r.height, ratio: +i.getAttribute('width') / +i.getAttribute('height') };
  }));
  assert.ok(boxes.length > 0);
  for (const b of boxes) {
    assert.ok(b.w > 50, `${b.src} : largeur ${b.w}px`);
    assert.ok(Math.abs(b.w / b.h - b.ratio) < 0.05 * b.ratio, `${b.src} : ${b.w}×${b.h} au lieu du ratio ${b.ratio.toFixed(2)}`);
  }
  await context.close();
});
