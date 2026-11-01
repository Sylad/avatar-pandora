// L22 — taille de base du texte en pourcentage (WCAG 1.4.4), lien d'évitement avant la barre
// latérale (2.4.1), bouton menu fixe qui ne coupe pas une fin de ligne (revue UX du Plan de travail).
// Lit frontend/dist (lancer `npm run build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const CSS = readFileSync(new URL('../frontend/src/styles/global.css', import.meta.url), 'utf8');
const PAGES = ['/', '/about/', '/pandora/', '/pandora/eywa/', '/bestiaire/', '/clans/', '/flore/', '/personnages/',
  '/films/', '/engins/', '/langue/', '/videos/', '/nouveautes/', '/plan-de-travail/'];

// Page d'un Chromium dont la « taille de la police » du navigateur est réglée à `px` (réglage
// standard de Chromium, posé par le protocole DevTools : Page.setFontSizes).
async function pageWithDefaultFontSize(env, px) {
  const page = await env.browser.newPage({ viewport: { width: 1280, height: 800 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: px } });
  return page;
}

test('R1 — la taille de base est un pourcentage (109,375 %), jamais des pixels', () => {
  const html = CSS.match(/@layer base \{\s*html \{([^}]*)\}/)?.[1] ?? '';
  assert.match(html, /font-size:\s*109\.375%\s*;/, 'html doit déclarer font-size: 109.375%');
  assert.doesNotMatch(html, /font-size:\s*[\d.]+px/, 'aucune taille en px sur html');
});

test('R1 — réglage par défaut du navigateur : 17,5 px comme avant (16 × 109,375 %)', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage();
  await page.goto(env.base + '/pandora/', { waitUntil: 'load' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '17.5px');
});

test('R1 — taille de police réglée à 32 px dans le navigateur : le texte la suit (35 px) sur toutes les pages', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await pageWithDefaultFontSize(env, 32);
  for (const path of PAGES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    const size = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.equal(size, 35, `${path} : taille de base ${size}px au lieu de 35px`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${path} : débordement horizontal de ${overflow}px avec le texte agrandi`);
  }
});

// Texte coupé par son cadre : un mot dont la boîte déborde à droite d'un ancêtre qui rogne
// (overflow hidden/clip) ou du bord de la fenêtre. Les décors (éléments vides) ne comptent pas.
async function clippedText(page) {
  return page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const host = n.parentElement;
      if (host.closest('svg, script, style, .sr-only') || getComputedStyle(host).visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      const right = Math.max(...rects.map((r) => r.right));
      for (let el = host; el && el !== document.documentElement; el = el.parentElement) {
        if (!/hidden|clip/.test(getComputedStyle(el).overflowX)) continue;
        const lim = el.getBoundingClientRect().right;
        if (right > lim + 1) {
          out.push(`${Math.round(right - lim)}px coupés dans ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} : « ${n.textContent.trim().slice(0, 40)} »`);
          break;
        }
      }
    }
    return out.slice(0, 5);
  });
}

// Toutes les pages construites (les 81, fiches du codex comprises) : un mot long d'un titre
// (« bioluminescente ») ne doit déborder sur aucune d'elles — la revue de L22 a trouvé huit
// fiches en défilement horizontal, que 14 pages témoins ne voyaient pas.
const ALL_PAGES = (() => {
  const out = [];
  const walk = (dir, path) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name), `${path}${e.name}/`);
      else if (e.name === 'index.html') out.push(path);
    }
  };
  if (existsSync(DIST)) walk(DIST, '/');
  return out.sort();
})();

// Réglages de police du navigateur (16 = défaut) × largeurs de téléphone (WCAG 1.4.4 et 1.4.10).
const FONT_SIZES = [16, 18, 20, 24, 32];
const WIDTHS = [320, 375, 390, 414, 480];

test('R1 — toutes les pages, police du navigateur de 16 à 32 px, largeurs de 320 à 480 px : ni défilement horizontal ni texte coupé', { timeout: 600_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  assert.ok(ALL_PAGES.length >= 81, `${ALL_PAGES.length} pages construites trouvées dans dist/ (81 attendues)`);
  // Une page Chromium par réglage de police, trois à la fois (cinq chargeaient la machine au point de
  // faire tomber un autre fichier de la suite) : ~2 000 chargements en une minute environ.
  const queue = [...FONT_SIZES];
  const lane = async () => {
    const out = [];
    for (let px = queue.shift(); px !== undefined; px = queue.shift()) out.push(...await checkFontSize(px));
    return out;
  };
  const failures = (await Promise.all([lane(), lane(), lane()])).flat();
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.join('\n')}`);

  async function checkFontSize(px) {
    const page = await pageWithDefaultFontSize(env, px);
    const out = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ALL_PAGES) {
        await page.goto(env.base + path, { waitUntil: 'load' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) out.push(`${path} @${width}px police ${px} : défilement horizontal de ${overflow}px`);
        const clipped = await clippedText(page);
        if (clipped.length) out.push(`${path} @${width}px police ${px} : texte coupé — ${clipped.join(' ; ')}`);
      }
    }
    await page.close();
    return out;
  }
});

test('R2 — le lien d’évitement est le premier arrêt de Tab, avant la barre latérale, et mène au contenu', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const path of PAGES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({ cls: document.activeElement.className, href: document.activeElement.getAttribute('href') }));
    assert.equal(first.cls, 'eywa-skip-link', `${path} : premier arrêt de Tab = ${first.href}`);
    const before = await page.evaluate(() => {
      const skip = document.querySelector('.eywa-skip-link');
      const side = document.querySelector('#eywa-sidebar');
      return side ? !!(skip.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    });
    assert.notEqual(before, false, `${path} : le lien d'évitement suit la barre latérale`);
    const box = await page.locator('.eywa-skip-link').boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0, `${path} : lien d'évitement hors de l'écran au focus`);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'contenu', `${path} : Entrée ne donne pas le focus au contenu`);
  }
});

// Revue UX du Plan de travail : au défilement, le bouton menu fixe ne doit jamais se poser sur
// une fin de ligne — la bande du haut le contient en entier et le texte passe dessous.
async function checkBurgerOverText(page, where) {
  const geo = await page.evaluate(() => {
    const b = document.getElementById('eywa-burger').getBoundingClientRect();
    const bar = document.querySelector('.eywa-topbar').getBoundingClientRect();
    const main = document.getElementById('contenu');
    return { b: { l: b.left, t: b.top, r: b.right, bt: b.bottom }, barBottom: bar.bottom, barWidth: bar.width, vw: innerWidth,
      mainTop: main.getBoundingClientRect().top + scrollY, pad: parseFloat(getComputedStyle(main).paddingTop) };
  });
  assert.ok(geo.barBottom >= geo.b.bt, `${where} : le bouton menu dépasse sous la bande (${geo.b.bt} > ${geo.barBottom})`);
  assert.ok(geo.barWidth >= geo.vw, `${where} : la bande ne couvre pas toute la largeur`);
  assert.ok(geo.mainTop + geo.pad >= geo.barBottom, `${where} : le contenu commence sous la bande`);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= total; y += 150) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    // Sous le bouton et sous la bande, jamais un texte : le point touché est le bouton ou la bande.
    const hit = await page.evaluate(({ b }) => [[b.l + 1, b.t + 1], [b.r - 1, b.t + 1], [b.l + 1, b.bt - 1], [b.r - 1, b.bt - 1], [b.r + 8, (b.t + b.bt) / 2], [b.l - 8, (b.t + b.bt) / 2]]
      .map(([x, yy]) => { const el = document.elementFromPoint(x, yy); return !!el && !!el.closest('#eywa-burger, .eywa-topbar'); }), geo);
    assert.ok(hit.every(Boolean), `${where} y=${y} : du texte est touché autour du bouton menu (${hit})`);
  }
}

test('R3 — le bouton menu fixe ne couvre aucune fin de ligne au défilement (320 à 1023 px, texte normal et agrandi)', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1023, 700]]) {
    const page = await env.browser.newPage({ viewport: { width: w, height: h } });
    for (const path of ['/plan-de-travail/', '/pandora/', '/nouveautes/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await checkBurgerOverText(page, `${path} @${w}px`);
    }
    await page.close();
  }
  for (const [w, h] of [[390, 844], [1023, 700]]) {
    const page = await pageWithDefaultFontSize(env, 32);
    await page.setViewportSize({ width: w, height: h });
    await page.goto(env.base + '/plan-de-travail/', { waitUntil: 'load' });
    await checkBurgerOverText(page, `/plan-de-travail/ @${w}px texte à 32 px`);
    await page.close();
  }
});

// Navigation du codex avec une police de navigateur agrandie : les points de rupture (rem dans
// Tailwind) et les media queries du layout doivent suivre la même règle, sinon ni barre latérale
// ni bouton menu n'apparaissent (WCAG 2.4.5).
test('R1 — police du navigateur à 20, 24 et 32 px : une navigation reste visible (barre latérale ou bouton menu)', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const [px, w] of [[20, 1100], [24, 1440], [32, 1440], [32, 1100], [16, 1100], [16, 1000]]) {
    const page = await pageWithDefaultFontSize(env, px);
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(env.base + '/plan-de-travail/', { waitUntil: 'load' });
    const nav = await page.evaluate(() => {
      const vis = (sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.right > 0 && r.left < innerWidth; };
      return { sidebar: vis('#eywa-sidebar'), burger: vis('#eywa-burger') };
    });
    assert.ok(nav.sidebar || nav.burger, `police ${px} px @${w}px : ni barre latérale ni bouton menu (${JSON.stringify(nav)})`);
    await page.close();
  }
});

// Revue de d9f745c : « anywhere » sur les titres coupait 15 fiches en milieu de mot à 320 px au
// réglage par défaut (Prolemuris, Omatikaya, Sturmbeest…). Toutes les pages, largeurs de téléphone.
const DEFAULT_WIDTHS = [320, 360, 375, 390, 414];

test('R1 — réglage par défaut, 320 à 414 px : aucun mot coupé en son milieu sur aucune page', { timeout: 600_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  assert.ok(ALL_PAGES.length >= 81, `${ALL_PAGES.length} pages construites trouvées dans dist/ (81 attendues)`);
  const page = await env.browser.newPage({ viewport: { width: 320, height: 568 } });
  const failures = [];
  for (const width of DEFAULT_WIDTHS) {
    await page.setViewportSize({ width, height: 568 });
    for (const path of ALL_PAGES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      const split = await page.evaluate(() => {
        const out = [];
        // Résumé de carte tronqué par -webkit-line-clamp : le mot coupé par les points de
        // suspension a deux boîtes, ce n'est pas une césure. Réponse mémorisée par élément.
        const clampedMemo = new Map();
        const clamped = (el) => {
          if (!el || el === document.body) return false;
          if (!clampedMemo.has(el)) clampedMemo.set(el, getComputedStyle(el).webkitLineClamp !== 'none' || clamped(el.parentElement));
          return clampedMemo.get(el);
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent.trim() || n.parentElement.closest('script, style, svg') || clamped(n.parentElement)) continue;
          for (const m of n.textContent.matchAll(/\S+/g)) {
            const r = document.createRange();
            r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
            if (r.getClientRects().length > 1 && !/[-‑­/]/.test(m[0])) out.push(m[0]);
          }
        }
        return [...new Set(out)].slice(0, 8);
      });
      if (split.length) failures.push(`${path} @${width}px police par défaut : ${split.join(', ')}`);
    }
  }
  await page.close();
  assert.deepEqual(failures, [], `${failures.length} page(s) avec un mot coupé :\n${failures.join('\n')}`);
});
