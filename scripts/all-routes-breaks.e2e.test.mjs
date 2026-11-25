// L78 — la règle des titres des fiches (titleBreaks : coupure aux seuls U+00AD, avec un trait) sur TOUTES les pages de
// frontend/dist, pas seulement sur les listes fixes de title-breaks-pages (P1, P7). QA de L74 en prod (24-11-2026) : à
// 320 px texte 200 %, /films/avatar-2009/ coupait « Avata|r », « producti|on », « synopsi|s » sans trait et /films/ son
// bandeau lettre à lettre ; /about/ « refactorin|gui.com ». Cause reproduite : la feuille de CodexLayout, qui déclarait
// le conteneur `eywa-codex`, refusée par le serveur (500, le même QA en a vu sur /bestiaire/pali/) — toutes les règles
// de titres qui l'interrogent tombaient alors sur leur version sans coupure. Depuis L78, le conteneur est déclaré dans
// global.css, et la version sûre des titres est celle par défaut.
// Attendu (WCAG 1.4.10, 1.4.4) : à 320 px texte 175 et 200 % — 200 % compté des deux façons, 32 px comme le QA (police
// de la page à 200 %) et 35 px (navigateur réglé à 32 px, le site à 109,375 %) — aucune page ne défile de côté ; un titre
// (h1 à h4, bandeau, carte) ne se coupe qu'à un U+00AD, avec son trait, un nom de personne jamais ; aucun mot du contenu
// cassé sans trait. Même règle des titres quand seule la feuille globale charge (R2). À 1440 px texte 100 %, rien ne
// change : aucun titre coupé, titres des fiches dans leur version d'origine (R3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, nextFrames, setupBrowser } from './lib/e2e-dist.mjs';
import { titleLines } from './lib/title-lines.mjs';
import { wordBreaks } from './lib/word-breaks.mjs';
import { EXCEPTIONS, syllableBreaks } from '../frontend/src/lib/title-breaks.ts';

// Toutes les pages construites : chaque dossier de dist/ qui a un index.html, plus la 404.
function routes(dir = DIST, base = '/') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.includes('.')) continue;
    const path = join(dir, e.name);
    try {
      if (statSync(join(path, 'index.html')).isFile()) out.push(`${base}${e.name}/`);
    } catch { /* dossier de ressources */ }
    out.push(...routes(path, `${base}${e.name}/`));
  }
  return out;
}
const ROUTES = ['/', '/404.html', ...routes()];
const TITLES = ['h1', 'h2', 'h3', 'h4', '.section-hero__title', '.entry-card__title'];
const NEVER_CUT = new Set(Object.entries(EXCEPTIONS).filter(([, v]) => !v.includes('-')).map(([k]) => k));
// Tailles du texte : 175 et 200 % du réglage du navigateur (site à 109,375 %), et 200 % de la police de la page (QA).
const SIZES = [['175 %', 'calc(109.375% * 1.75)'], ['200 %', 'calc(109.375% * 2)'], ['200 % (32 px)', '200%']];

async function setFontSize(page, size) {
  await page.evaluate((s) => { document.documentElement.style.fontSize = s; }, size);
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page, 2);
  // Transitions lancées par le changement de taille (cartes d'À propos en `transition-all`) : état lu une fois finies.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))));
  await nextFrames(page, 1);
}

// Défauts de coupure des titres d'une page : coupure sans trait, moins de 2 lettres avant ou de 3 après (repli à 2 des
// titres de section, titleBreaks), nom de personne coupé.
// `cuttableOnly` (R2) : seuls comptent les mots que titleBreaks sait couper ; un mot sans aucune coupure permise (« Neteyam »,
// « n'existe ») ne tient qu'avec les marges réduites des gabarits étroits, qui vivent dans la feuille de leur composant.
async function titleFaults(page, where, { cuttableOnly = false } = {}) {
  const out = [];
  let cuts = 0;
  for (const r of await titleLines(page, TITLES)) {
    for (const c of r.cuts) {
      cuts++;
      const at = `${where} « ${c.word} » (${r.title.trim().slice(0, 40)})`;
      const plain = c.word.replace('-', '').replace(/^[ldnsjqu]+[’']/i, '').replace(/[^\p{L}'’]/gu, '');
      if (c.kind !== 'shy' && cuttableOnly && !syllableBreaks(plain).length) continue;
      if (c.kind !== 'shy') { out.push(`${at} coupé sans trait`); continue; }
      if (c.before < 2 || c.after < 3) out.push(`${at} : ${c.before}/${c.after} lettres de part et d'autre`);
      const word = c.word.replace('-', '').toLowerCase().replace(/^[ld][’']/, '').replace(/[^\p{L}'’]/gu, '');
      if (NEVER_CUT.has(word.replace(/[’']s$/, ''))) out.push(`${at} : nom de personne coupé`);
    }
  }
  return { out, cuts };
}

test('R1 — toutes les pages, 320 px texte 175 et 200 % : aucun défilement de côté, titres coupés aux seuls U+00AD, aucun mot cassé', { timeout: 1_800_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  assert.ok(ROUTES.length >= 81, `${ROUTES.length} pages seulement dans dist/`);
  const failures = [];
  let cuts = 0;
  const page = await env.browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
  for (const path of ROUTES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await page.evaluate(() => { document.body.id ||= 'eywa-body'; });
    for (const [label, size] of SIZES) {
      await setFontSize(page, size);
      const where = `${path} texte ${label}`;
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      if (sw > cw) failures.push(`${where} : la page défile de côté (${sw} px pour ${cw})`);
      const r = await titleFaults(page, where);
      cuts += r.cuts;
      failures.push(...r.out);
      const { broken } = await wordBreaks(page, await page.evaluate(() => document.body.id));
      if (broken.length) failures.push(`${where} : mots cassés ${broken.join(', ')}`);
    }
  }
  await page.close();
  assert.ok(cuts > 300, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

// Cause du QA de L74 : une feuille de style d'un composant refusée (500). Les titres ne doivent dépendre que de la feuille
// globale (celle qui porte `.title-word`) : toutes les autres sont refusées ici.
test('R2 — toutes les pages, 320 px texte 200 %, seule la feuille globale chargée : un mot qui a des coupures ne se coupe qu’à elles, avec un trait', { timeout: 1_800_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
  let refused = 0;
  let kept = 0;
  await context.route('**/_astro/*.css', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes('.title-word')) { kept++; await route.fulfill({ response, body }); } else { refused++; await route.fulfill({ status: 500, body: '' }); }
  });
  const page = await context.newPage();
  const failures = [];
  let cuts = 0;
  for (const path of ROUTES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    for (const [label, size] of SIZES.slice(1)) {
      await setFontSize(page, size);
      const r = await titleFaults(page, `${path} texte ${label}`, { cuttableOnly: true });
      cuts += r.cuts;
      failures.push(...r.out);
    }
  }
  await context.close();
  assert.ok(kept > 0 && refused > 0, `feuilles gardées ${kept}, refusées ${refused} : la feuille globale n'est plus reconnue`);
  assert.ok(cuts > 300, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

test('R3 — toutes les pages, 1440 px texte 100 % : aucun titre coupé, titres des fiches dans leur version d’origine', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let plain = 0;
  const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  for (const path of ROUTES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await nextFrames(page, 2);
    for (const r of await titleLines(page, TITLES)) {
      if (r.cuts.length) failures.push(`${path} : « ${r.lines.join(' / ')} » coupé`);
    }
    const dual = await page.evaluate(() => ({
      plain: [...document.querySelectorAll('.title-plain')].filter((e) => e.checkVisibility()).length,
      boxed: [...document.querySelectorAll('.title-boxed')].filter((e) => e.checkVisibility()).map((e) => e.textContent.replaceAll('­', '')),
      split: [...document.querySelectorAll('.title-word')].filter((w) => w.checkVisibility() && w.getClientRects().length > 1).map((w) => w.textContent),
    }));
    plain += dual.plain;
    if (dual.boxed.length) failures.push(`${path} : titres en boîtes à 1440 px ${dual.boxed.join(', ')}`);
    if (dual.split.length) failures.push(`${path} : mots en boîte sur deux lignes ${dual.split.join(', ')}`);
  }
  await page.close();
  assert.ok(plain > 100, `${plain} titres d'origine seulement : la mesure ne les voit plus`);
  assert.deepEqual(failures, [], failures.join('\n'));
});
