// L22 — taille de base du texte en pourcentage (WCAG 1.4.4), lien d'évitement avant la barre
// latérale (2.4.1), bouton menu fixe qui ne coupe pas une fin de ligne (revue UX du Plan de travail).
// Lit frontend/dist (lancer `npm run build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupBrowser } from './lib/e2e-dist.mjs';

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
