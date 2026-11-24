// L72 — coupures des titres du codex, vues du lecteur (revue UX r2 de L70, constats m2 et m3).
// m2 : les U+00AD posés par titleBreaks restaient dans le texte copié (Ctrl+C sur le h1 : « Les peu­ples de Pan­dora »,
// HTML compris) et dans le nom accessible brut de Chromium. Attendu : presse-papier (texte et HTML) et noms accessibles
// (arbre de Chromium par CDP, titres et liens des cartes) sans aucun U+00AD.
// m3 : mots anglais coupés à la française, « Ts-kaha » coupé par le dictionnaire, 2 lettres en fin de ligne, jusqu'à
// 3 lignes à trait de suite. Attendu, de 320 à 1440 px, texte 125 à 200 % : le navigateur ne coupe qu'aux U+00AD de
// titleBreaks (jamais à son dictionnaire), 3 lettres de chaque côté (2 avant pour le repli des bandeaux, sur les seuls
// mots qui n'ont rien d'autre), au plus 2 lignes de suite finies par une coupure — sauf l'exception mesurée ci-dessous.
// Texte agrandi joué comme la revue : taille de police de <html>. Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';
import { titleLines } from './lib/title-lines.mjs';
import { syllableBreaks } from '../frontend/src/lib/title-breaks.ts';

const SHY = '­';
const SECTIONS = ['/bestiaire/', '/pandora/', '/clans/', '/flore/', '/personnages/', '/films/', '/engins/'];

async function setText(page, factor) {
  await page.evaluate((f) => { document.documentElement.style.fontSize = `calc(109.375% * ${f})`; }, factor);
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page, 2);
}

// Sélectionne tout le texte de l'élément, Ctrl+C, puis lit le presse-papier (texte et HTML).
async function copyOf(page, selector) {
  await page.evaluate((sel) => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(sel));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
  await page.keyboard.press('ControlOrMeta+C');
  return page.evaluate(async () => {
    const out = {};
    for (const item of await navigator.clipboard.read()) {
      for (const type of item.types) out[type] = await (await item.getType(type)).text();
    }
    return out;
  });
}

test('C1 — titre copié (bandeau et carte) : ni le texte ni le HTML du presse-papier ne portent de U+00AD', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  // 390 px texte 200 % : titres en césure (coupures actives) ; 1440 px texte 100 % : coupures inertes, mais présentes.
  for (const [width, factor] of [[390, 2], [1440, 1]]) {
    const context = await env.browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(env.base + '/clans/', { waitUntil: 'load' });
    await setText(page, factor);
    const hero = await copyOf(page, '.section-hero__title');
    const where = `@${width}px texte ${factor * 100} %`;
    if (hero['text/plain'] !== 'Les peuples de Pandora') failures.push(`${where} h1 : texte copié ${JSON.stringify(hero['text/plain'])}`);
    if (!hero['text/html'] || hero['text/html'].includes(SHY) || hero['text/html'].includes('&shy;')) failures.push(`${where} h1 : HTML copié ${JSON.stringify(hero['text/html'])}`);
    // L73 (revue UX r1) : tout mot coupable du bandeau est dans sa boîte (<span class="title-word">) ; titre lu sans les balises.
    if (!hero['text/html']?.replace(/<[^>]+>/g, '').includes('Les peuples de Pandora')) failures.push(`${where} h1 : HTML copié sans le titre`);
    const card = await copyOf(page, '#contenu .entry-card__title');
    if (!card['text/plain'] || card['text/plain'].includes(SHY)) failures.push(`${where} carte : texte copié ${JSON.stringify(card['text/plain'])}`);
    if (!card['text/html'] || card['text/html'].includes(SHY)) failures.push(`${where} carte : HTML copié ${JSON.stringify(card['text/html'])}`);
    // Toute la page (Ctrl+A) : rien non plus.
    await page.evaluate(() => getSelection().selectAllChildren(document.body));
    await page.keyboard.press('ControlOrMeta+C');
    const all = await page.evaluate(() => navigator.clipboard.readText());
    if (all.includes(SHY) || !all.includes('Omatikaya')) failures.push(`${where} page entière : ${all.split(SHY).length - 1} U+00AD copiés`);
    await context.close();
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('C2 — nom accessible (arbre de Chromium) : titres et liens des cartes sans U+00AD, titres de section exacts', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  const page = await env.browser.newPage({ viewport: { width: 390, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  for (const path of SECTIONS) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await setText(page, 2);
    const titles = await page.evaluate(() => [...document.querySelectorAll('.section-hero__title, #contenu .entry-card__title')]
      .map((el) => el.textContent.replaceAll('­', '')));
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const named = nodes.filter((n) => ['heading', 'link'].includes(n.role?.value) && n.name?.value);
    for (const n of named) if (n.name.value.includes(SHY)) failures.push(`${path} ${n.role.value} « ${n.name.value.replaceAll(SHY, '·')} »`);
    const headings = new Set(named.filter((n) => n.role.value === 'heading').map((n) => n.name.value));
    for (const title of titles) if (!headings.has(title)) failures.push(`${path} : aucun titre nommé « ${title} »`);
    // Le lien d'une carte garde son titre en tête de son nom (WCAG 2.5.3, commande vocale).
    const links = named.filter((n) => n.role.value === 'link').map((n) => n.name.value);
    for (const title of titles.slice(1)) if (!links.some((l) => l.startsWith(title))) failures.push(`${path} : aucun lien nommé « ${title} … »`);
  }
  await page.close();
  assert.deepEqual(failures, [], failures.slice(0, 20).join('\n'));
});

// Plus de 2 lignes de suite finies par une coupure, inévitable : à 390 px texte 200 %, ni « techno- » ni « humaine »
// ne tiennent sur une ligne du bandeau, et le navigateur remplit chaque ligne au plus loin (« tech- / nolo- / gie hu- /
// maine ») ; aucun réglage CSS ne l'en détourne dans Chromium (text-wrap pretty et balance essayés, hyphenate-limit-lines
// non pris en charge). Toute autre occurrence fait échouer le test.
// L73 (revue UX de L72, m1) : le trait d'union d'un mot composé compte aussi. « Les ar- / bres- / ré- / seaux » ne reste
// que là où NI « arbres- » NI « réseaux » ne tient seul sur une ligne du bandeau (mesuré : 320 px texte 150 % 225 et 243 px pour 221 ; 175 % 262 et
// 281 px pour 257 ; 200 % 299 et 323 pour 248 ; 390 px 200 % pour 263 ; 768 px 200 % 567 et 611 pour 554) : les mots du
// repli sont des boîtes qui passent entières à la ligne (titleSegments), le reste du temps il n'y a plus que 2 traits.
const FLORE = 'Les arbres-réseaux et plantes sacrées';
const RUN_EXCEPTIONS = new Set([
  '/engins/ @390px texte 200 % La technologie humaine',
  `/flore/ @320px texte 150 % ${FLORE}`,
  `/flore/ @320px texte 175 % ${FLORE}`,
  `/flore/ @320px texte 200 % ${FLORE}`,
  `/flore/ @390px texte 200 % ${FLORE}`,
  `/flore/ @768px texte 200 % ${FLORE}`,
]);

test('C3 — coupures de 320 à 1440 px, texte 125 à 200 % (150 % compris, L73) : seulement aux U+00AD, 3 lettres de chaque côté, 2 lignes à trait de suite au plus', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let cuts = 0;
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    for (const path of SECTIONS) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.25, 1.5, 1.75, 2]) {
        await setText(page, factor);
        for (const r of await titleLines(page)) {
          const where = `${path} @${width}px texte ${factor * 100} % ${r.title}`;
          for (const c of r.cuts) {
            cuts++;
            if (c.kind !== 'shy') failures.push(`${where} : « ${c.word} » coupé hors des coupures de titleBreaks`);
            // Repli à 2 lettres : bandeau seulement, et pour un mot qui n'a aucune coupure à 3 lettres.
            const fallback = r.sel === '.section-hero__title' && c.before >= 2 && syllableBreaks(c.word.replace('-', '')).length === 0;
            if (c.before < 3 && !fallback) failures.push(`${where} : « ${c.word} », ${c.before} lettre(s) en fin de ligne`);
            if (c.after < 3) failures.push(`${where} : « ${c.word} », ${c.after} lettre(s) en début de ligne`);
          }
          // L73 (revue UX de L72, m1) : le trait d'union d'un mot composé compte (« arbres- / ré- / seaux »).
          if (r.dashRun > 2 && !RUN_EXCEPTIONS.has(where)) failures.push(`${where} : ${r.dashRun} lignes à trait de suite — ${r.lines.join(' / ')}`);
        }
      }
    }
    await page.close();
  }
  assert.ok(cuts > 100, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 30).join('\n')}`);
});
