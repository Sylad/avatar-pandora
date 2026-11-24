// L73 — titres des pages hors des listes du codex, texte agrandi sur écran étroit. À 320 px texte 175 et 200 %, /langue/
// coupait ses titres sans trait (« lang|ue », « Na'|vi », « Alphab|et », « Gramm|aire », « Lexiqu|e ») et défilait de
// côté (363 px pour 320) ; même défaut ailleurs : À propos (« Claude », « Codex », 461 px), 404 (« n'existe »),
// Nouveautés (titres des entrées, 433 px), Plan de travail (« Récemment », 340 px), Vidéos (« recommandées »,
// « LinksTheSun »). Attendu, comme les 7 sections du codex (L71, L72) : coupures aux seuls U+00AD de titleBreaks,
// 3 lettres de chaque côté (repli à 2 avant dans un titre de section seulement), au plus 2 lignes à trait de suite,
// aucun U+00AD copié ni dans un nom accessible, aucun défilement horizontal. Rien ne change à 100 %.
// L74 : mêmes règles sur les ~70 fiches du codex (h1, intertitres, texte courant : P7), le texte courant des Nouveautés
// n'est plus exempté (P1), et le texte d'À propos ne sort plus de sa carte (P4). L74 r1 : aucun nom de personne coupé
// dans le texte courant des fiches et des Nouveautés (P8). L77 : au plus 3 lignes de suite finies par une coupure dans
// ce texte (P9, usage typographique ; « 8 4 4 » en laissait 6 de suite sur /flore/unobtainium/ à 320 px texte 200 %).
// Texte agrandi joué comme les revues : taille de police de <html>. Lit frontend/dist ; skip sans playwright-core.
import test from 'node:test';
import { readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DIST, nextFrames, setupBrowser } from './lib/e2e-dist.mjs';
import { titleLines } from './lib/title-lines.mjs';
import { wordBreaks } from './lib/word-breaks.mjs';
import { hyphenRuns } from './lib/hyphen-runs.mjs';
import { EXCEPTIONS, addressParts, syllableBreaks } from '../frontend/src/lib/title-breaks.ts';
import { PERSON_NAME_SOURCE } from '../frontend/src/lib/prose-breaks.ts';

const SHY = '­';
const PAGES = ['/langue/', '/about/', '/404.html', '/nouveautes/', '/plan-de-travail/', '/videos/', '/'];
// Titres de section (repli à 2 lettres permis) : le h1 de /langue/ (section VI) et le bandeau de /videos/.
const SECTION_TITLES = new Set(["La langue Na'vi", 'Les voix qui ont fait grandir Pandora hors écran']);
const TITLES = ['h1', 'h2', 'h3', '.about-site .block.font-display', '.channel-link__name', '.channel-card__name'];

// Les fiches des 7 sections du codex, lues dans frontend/dist.
const CODEX_SECTIONS = ['pandora', 'clans', 'bestiaire', 'flore', 'personnages', 'films', 'engins'];
const FICHES = CODEX_SECTIONS.flatMap((s) => readdirSync(DIST + s, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/${s}/${d.name}/`));
// Noms de personnes, jamais coupés (L73 m2, L74) : les entrées de EXCEPTIONS sans coupure, lues dans le texte affiché.
const NEVER_CUT = new Set(Object.entries(EXCEPTIONS).filter(([, v]) => !v.includes('-')).map(([k]) => k));

// Texte affiché d'un élément (L74 : un titre de fiche porte deux versions, l'une en `display: none`).
function visibleText(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let text = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.parentElement.checkVisibility()) text += n.data;
  return text;
}

async function setText(page, factor) {
  await page.evaluate((f) => { document.documentElement.style.fontSize = `calc(109.375% * ${f})`; }, factor);
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page, 2);
  // Transitions lancées par le changement de taille (cartes d'À propos en `transition-all` : leurs marges en rem
  // glissent de l'ancienne taille à la nouvelle) : on lit l'état une fois qu'elles ont fini, sur l'horloge de la page.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {}))));
  await nextFrames(page, 1);
}

test('P1 — 320 et 390 px, texte 125 à 200 % : aucun défilement de côté, titres coupés aux seuls U+00AD, 3 lettres, 2 traits de suite au plus', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let cuts = 0;
  for (const width of [320, 390]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.25, 1.5, 1.75, 2]) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (sw > cw) failures.push(`${where} : la page défile de côté (${sw} px pour ${cw})`);
        for (const r of await titleLines(page, TITLES)) {
          const at = `${where} ${r.title.trim()}`;
          for (const c of r.cuts) {
            cuts++;
            if (c.kind !== 'shy') { failures.push(`${at} : « ${c.word} » coupé sans trait`); continue; }
            const fallback = SECTION_TITLES.has(r.title.trim()) && c.before >= 2 && syllableBreaks(c.word.replace('-', '')).length === 0;
            if (c.before < 3 && !fallback) failures.push(`${at} : « ${c.word} », ${c.before} lettre(s) en fin de ligne`);
            if (c.after < 3) failures.push(`${at} : « ${c.word} », ${c.after} lettre(s) en début de ligne`);
          }
          if (r.dashRun > 2) failures.push(`${at} : ${r.dashRun} lignes à trait de suite — ${r.lines.join(' / ')}`);
        }
        // Aucun mot cassé sans trait, texte courant des Nouveautés compris (L74 : « bioluminescen|te » y était cassé).
        await page.evaluate(() => { document.body.id ||= 'eywa-body'; });
        const { broken } = await wordBreaks(page, await page.evaluate(() => document.body.id));
        // Une adresse (« refactoringui.com », À propos) passe à la ligne avant son point, puis se coupe sans trait si son nom
        // ne tient pas : jamais de trait ajouté dans une adresse. Même règle que la page (addressParts).
        const names = await page.evaluate(() => [...document.querySelectorAll('.about-source-name')]
          .map((e) => [...e.childNodes].filter((n) => !n.classList?.contains('sr-only')).map((n) => n.textContent).join('').trim()));
        const domains = names.filter((n) => addressParts(n)).map((n) => addressParts(n).join(''));
        const words = broken.filter((w) => !domains.some((d) => d.startsWith(w.split(' ')[0])));
        if (words.length) failures.push(`${where} : mots cassés ${words.join(', ')}`);
      }
    }
    await page.close();
  }
  assert.ok(cuts > 40, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

test('P2 — /langue/ et une fiche à 320 px texte 200 % : titres copiés sans U+00AD, noms accessibles des titres et liens sans U+00AD', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  const context = await env.browser.newContext({ viewport: { width: 320, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  // L74 : h1 et intertitre d'une fiche (deux versions dans le DOM, une seule affichée : copiée une fois).
  const COPIES = [['/langue/', 'h1', "La langue Na'vi"], ['/pandora/bioluminescent-night/', 'h1', "La nuit bioluminescente — quand Pandora s'allume"],
    ['/bestiaire/akula/', '.entry-body h2', 'Morphologie']];
  for (const [path, sel, expected] of COPIES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await setText(page, 2);
    assert.ok(await page.evaluate(([s, f]) => eval(`(${f})`)(document.querySelector(s)).includes('­'), [sel, visibleText.toString()]), `${path} ${sel} ne porte plus de coupure`);
    await page.evaluate((s) => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(s));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }, sel);
    await page.keyboard.press('ControlOrMeta+C');
    const copied = await page.evaluate(async () => {
      const out = {};
      for (const item of await navigator.clipboard.read()) for (const type of item.types) out[type] = await (await item.getType(type)).text();
      return out;
    });
    if (copied['text/plain']?.trim() !== expected) failures.push(`${path} ${sel} copié : ${JSON.stringify(copied['text/plain'])}`);
    if (!copied['text/html'] || copied['text/html'].includes(SHY)) failures.push(`${path} ${sel} copié (HTML) : ${JSON.stringify(copied['text/html'])}`);
  }
  const cdp = await context.newCDPSession(page);
  for (const path of [...PAGES, '/pandora/bioluminescent-night/', '/bestiaire/akula/', '/personnages/tsutey/', '/pandora/sites-sacres/']) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await setText(page, 2);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    for (const n of nodes) {
      if (['heading', 'link'].includes(n.role?.value) && n.name?.value?.includes(SHY)) failures.push(`${path} ${n.role.value} « ${n.name.value.replaceAll(SHY, '·')} »`);
    }
    // Chaque titre coupé garde son nom exact (texte sans U+00AD).
    const titles = await page.evaluate((f) => [...document.querySelectorAll('h1, h2, h3')].map(eval(`(${f})`)).filter((t) => t.includes('­'))
      .map((t) => t.replaceAll('­', '').replace(/[ \t\n\u00a0\u202f]+/g, ' ').trim()), visibleText.toString());
    // Espaces insécables (« : » des titres, L73 r1 ; guillemets) lues comme des espaces des deux côtés.
    const names = new Set(nodes.filter((n) => n.role?.value === 'heading').map((n) => n.name?.value?.replace(/[\u00a0\u202f]/g, ' ')));
    for (const title of titles) if (!names.has(title)) failures.push(`${path} : aucun titre nommé « ${title} »`);
  }
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('P3 — texte 100 %, 390 à 1440 px : aucun titre coupé, aucun mot en boîte passé à la ligne en deux', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const width of [390, 768, 1024, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    // L74 : des fiches aussi (rendu identique à celui d'avant L74 à 100 %, intertitre « Iknimaya » de /pandora/sites-sacres/
    // compris : il remplit sa ligne au pixel près à 1024 px).
    for (const path of [...PAGES, '/flore/', '/engins/', '/films/', '/pandora/sites-sacres/', '/pandora/bioluminescent-night/', '/bestiaire/akula/', '/personnages/grace/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await setText(page, 1);
      for (const r of await titleLines(page, [...TITLES, '#contenu .entry-card__title', '#contenu .entry-body h2', '#contenu .entry-body h3'])) {
        if (r.cuts.length) failures.push(`${path} @${width}px : « ${r.lines.join(' / ')} » coupé`);
      }
      const split = await page.evaluate(() => [...document.querySelectorAll('.title-word')].filter((w) => w.getClientRects().length > 1 || w.getBoundingClientRect().height > parseFloat(getComputedStyle(w).fontSize) * 2).map((w) => w.textContent));
      if (split.length) failures.push(`${path} @${width}px : mots en boîte sur deux lignes ${split.join(', ')}`);
    }
    await page.close();
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

// Revue UX r1 de L73, M1 : /about/ défilait encore de côté de 4 à 15 px entre 150 et 195 % de texte (320 px 150 % +11,
// 375 px 180 % +13, 390 px 185 % +11, 414 px 195 % +15 ; « refactoringui.com » sortait de sa carte), juste sous le seuil
// du gabarit étroit. Attendu (WCAG 1.4.10) : aucun défilement horizontal de 100 à 200 %, par pas de 5 %, aux largeurs
// citées ; les autres pages sont balayées aussi.
// Revue UX r2 de L73, m3 : sur /about/, « refactoringui », « Finance » et « COMMUNAUTÉ » sortaient de leur carte de 1 à
// 31 px entre 145 et 200 % de texte, de 320 à 430 px, sans que la page défile (le contenu de la carte débordait dans la
// marge). Mesuré ici : le bord droit de chaque ligne de texte contre le bord intérieur de sa carte.
test('P4 — 320 à 768 px, texte 100 à 200 % par pas de 5 : aucune page ne défile de côté, texte d’À propos dans sa carte', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let measured = 0;
  for (const width of [320, 375, 385, 390, 414, 430, 768, 1024]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (let pct = 100; pct <= 200; pct += path === '/about/' ? 5 : 25) {
        await setText(page, pct / 100);
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (sw > cw) failures.push(`${path} @${width}px texte ${pct} % : la page défile de côté (${sw} px pour ${cw})`);
        if (path !== '/about/') continue;
        const out = await page.evaluate(() => {
          const res = [];
          let n = 0;
          for (const card of document.querySelectorAll('.about-card, .about-site, .about-box, .about-stack > div')) {
            const cs = getComputedStyle(card);
            const box = card.getBoundingClientRect();
            const right = box.right - parseFloat(cs.borderRightWidth);
            const left = box.left + parseFloat(cs.borderLeftWidth);
            const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
            for (let t = walker.nextNode(); t; t = walker.nextNode()) {
              if (!t.data.trim() || t.parentElement.closest('.sr-only, svg') || !t.parentElement.checkVisibility()) continue;
              const r = document.createRange();
              r.selectNodeContents(t);
              for (const rect of r.getClientRects()) {
                if (rect.width < 0.5) continue;
                n++;
                const over = Math.max(rect.right - right, left - rect.left);
                if (over > 0.5) res.push(`« ${t.data.trim().slice(0, 30)} » sort de sa carte (${card.className.split(' ')[0]}) de ${over.toFixed(1)} px`);
              }
            }
          }
          return { res, n };
        });
        measured += out.n;
        for (const o of out.res) failures.push(`${path} @${width}px texte ${pct} % : ${o}`);
      }
    }
    await page.close();
  }
  assert.ok(measured > 1000, `${measured} lignes de texte mesurées dans les cartes d'À propos seulement`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

// Revue UX r1 de L73, m1 : le h1 de /flore/ coupait « plan-/tes » et « sa-/crées » alors que le mot tenait entier sur la
// ligne (768 px 200 % : « sacrées » 560 px pour une ligne de 563). Attendu : un mot ne se coupe que s'il est plus large
// que la ligne. Mesuré sur le rendu : chaque mot coupé, à sa largeur naturelle dans la police du titre, comparé à la
// largeur de la ligne ; et nulle part une coupure de titre hors de sa boîte de mot (elle se ferait sans que le mot ait
// d'abord essayé la ligne suivante). Sur les sections du codex, le bandeau seul : les titres des cartes et des fiches
// sont l'objet d'un autre lot. Note de la même revue (/nouveautes/) : jamais « : », « ; », « ! » ou « ? » seul en
// début de ligne.
const CODEX = ['/flore/', '/bestiaire/', '/personnages/', '/clans/', '/engins/', '/pandora/', '/films/'];
test('P5 — 320 à 1440 px, texte 125 à 200 % : un mot de titre ne se coupe que s’il ne tient pas sur la ligne, ponctuation haute jamais en tête de ligne', { timeout: 1_200_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let split = 0;
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of [...PAGES, ...CODEX]) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.25, 1.5, 1.75, 2]) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const sel = CODEX.includes(path) ? '.section-hero__title' : 'h1, h2, h3';
        const r = await page.evaluate(([shy, sel]) => {
          const titles = [...document.querySelectorAll(sel)];
          const loose = [];
          for (const h of titles) {
            const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (n.data.includes(shy) && !n.parentElement.closest('.title-word')) loose.push(n.data.replaceAll(shy, '·'));
            }
          }
          const fits = [];
          let count = 0;
          for (const w of titles.flatMap((h) => [...h.querySelectorAll('.title-word')])) {
            const lineHeight = parseFloat(getComputedStyle(w).lineHeight) || parseFloat(getComputedStyle(w).fontSize) * 1.2;
            if (w.getBoundingClientRect().height < lineHeight * 1.5) continue;
            count++;
            const line = w.getBoundingClientRect().width;
            const before = w.style.width;
            w.style.width = 'max-content';
            const natural = w.getBoundingClientRect().width;
            w.style.width = before;
            // Arrondis du sous-pixel : un mot n'est compté « tenant » qu'avec une demi-unité de marge.
            if (natural <= line - 0.5) fits.push(`« ${w.textContent.replaceAll(shy, '')} » (${natural.toFixed(0)} px, ligne ${line.toFixed(0)})`);
          }
          return { loose, fits, count };
        }, [SHY, sel]);
        split += r.count;
        for (const l of r.loose) failures.push(`${where} : coupure hors boîte « ${l} »`);
        for (const f of r.fits) failures.push(`${where} : ${f} coupé alors qu'il tient sur la ligne`);
        for (const tl of await titleLines(page, CODEX.includes(path) ? ['.section-hero__title'] : TITLES)) {
          if (tl.lines.slice(1).some((l) => /^[:;!?]/.test(l))) failures.push(`${where} : ponctuation en tête de ligne — ${tl.lines.join(' / ')}`);
        }
      }
    }
    await page.close();
  }
  assert.ok(split > 10, `${split} mots coupés seulement : la mesure ne voit plus les mots coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

// Revue UX r1 de L73, m2 : les titres anglais de /videos/ (lang="en") étaient coupés à la française (« Unders-tands »,
// « Filmma-kers ») et portaient des U+00AD faux (« Minu·tes », « Came·ron »). Attendu : une coupure d'un titre anglais
// tombe à une frontière de syllabe anglaise (dictionnaire, ci-dessous, écrit d'après la césure anglaise et non d'après
// le code) ; un mot absent de cette liste ne porte aucune coupure.
const EN_SYLLABLES = ['un-der-stands', 'film-mak-ers', 'min-utes', 'cam-er-on', 'en-cy-clo-pae-di-a', 'ev-ery-thing',
  'bi-ol-o-gy', 'of-fi-cial', 'sig-our-ney', 'pan-do-ra', 'av-a-tar', 'win-ning', 'trail-er', 'noth-ings', 'art-ists', 'tedx-usc'];
test('P6 — /videos/ : titres anglais coupés aux seules syllabes anglaises', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const allowed = new Map(EN_SYLLABLES.map((w) => [w.replaceAll('-', ''), new Set([...w].reduce((acc, c, i) => (c === '-' ? [...acc, i - acc.length] : acc), []))]));
  const failures = [];
  const page = await env.browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(env.base + '/videos/', { waitUntil: 'load' });
  const words = await page.evaluate((shy) => [...document.querySelectorAll('[lang="en"]')].filter((e) => e.closest('h1, h2, h3'))
    .flatMap((e) => e.textContent.split(/[^\p{L}'’­]+/u)).filter((w) => w.includes(shy)), SHY);
  assert.ok(words.length >= 5, `${words.length} mots anglais coupables seulement : la mesure ne voit plus les titres anglais`);
  for (const word of words) {
    const plain = word.replaceAll(SHY, '');
    const ok = allowed.get(plain.toLowerCase().replace(/['’]s$/, '')); // possessif : « Cam-eron's »
    let at = 0;
    for (const part of word.split(SHY).slice(0, -1)) {
      at += part.length;
      if (!ok?.has(at)) failures.push(`« ${word.replaceAll(SHY, '-')} » : coupure ${plain.slice(0, at)}-${plain.slice(at)} hors des syllabes anglaises`);
    }
  }
  for (const factor of [1.75, 2]) {
    await setText(page, factor);
    for (const r of await titleLines(page, ['.video-card__title'])) {
      for (const c of r.cuts) if (c.kind !== 'shy') failures.push(`texte ${factor * 100} % : « ${c.word} » coupé sans trait`);
    }
  }
  await page.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

// L74 — les ~70 fiches du codex à 320 et 390 px, texte 125 à 200 % : le h1 et les intertitres se coupaient sans trait
// (« Morpholog|ie », « propulsi|on », 549 défauts mesurés avant L74) et 29 réglages défilaient de côté (« qu'approxima-
// tivement », 360 px pour 320). Attendu (règle de L73) : aucun défilement de côté ; un titre ne se coupe qu'à un U+00AD,
// avec son trait, 3 lettres de chaque côté, et seulement si le mot ne tient pas sur la ligne ; un nom de personne jamais ;
// aucun mot du texte courant cassé sans trait (césure française du navigateur).
test('P7 — fiches du codex, 320 et 390 px, texte 125 à 200 % : titres et texte coupés à une syllabe, avec un trait, sans défilement', { timeout: 1_800_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  assert.ok(FICHES.length >= 60, `${FICHES.length} fiches seulement dans dist/`);
  const failures = [];
  let cuts = 0;
  for (const width of [320, 390]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of FICHES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.25, 1.5, 1.75, 2]) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (sw > cw) failures.push(`${where} : la page défile de côté (${sw} px pour ${cw})`);
        for (const r of await titleLines(page, ['#contenu h1', '#contenu .entry-body h2', '#contenu .entry-body h3', '#contenu .entry-body h4'])) {
          for (const c of r.cuts) {
            cuts++;
            const at = `${where} « ${c.word} »`;
            if (c.kind !== 'shy') failures.push(`${at} coupé sans trait`);
            else if (c.before < 3 || c.after < 3) failures.push(`${at} : ${c.before}/${c.after} lettres de part et d'autre`);
            const word = c.word.replace('-', '').toLowerCase().replace(/^[ld][’']/, '').replace(/[^\p{L}'’]/gu, '');
            if (NEVER_CUT.has(word.replace(/[’']s$/, ''))) failures.push(`${at} : nom de personne coupé`);
          }
        }
        // Un mot de titre en boîte ne se coupe que s'il est plus large que la ligne (arrondi : une demi-unité de marge).
        const fits = await page.evaluate(() => [...document.querySelectorAll('#contenu .title-word')].filter((w) => w.checkVisibility()).flatMap((w) => {
          const lh = parseFloat(getComputedStyle(w).lineHeight) || parseFloat(getComputedStyle(w).fontSize) * 1.2;
          if (w.getBoundingClientRect().height < lh * 1.5) return [];
          const line = w.getBoundingClientRect().width;
          w.style.width = 'max-content';
          const natural = w.getBoundingClientRect().width;
          w.style.width = '';
          return natural <= line - 0.5 ? [`« ${w.textContent.replaceAll('­', '')} » coupé alors qu'il tient (${natural.toFixed(0)} px, ligne ${line.toFixed(0)})`] : [];
        }));
        for (const f of fits) failures.push(`${where} : ${f}`);
        const { broken } = await wordBreaks(page);
        if (broken.length) failures.push(`${where} : mots cassés ${broken.join(', ')}`);
      }
    }
    await page.close();
  }
  assert.ok(cuts > 100, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

// L74 r1 (revue UX, M1) : la césure du navigateur coupait les noms de personnes du texte courant — 313 fois dans les
// fiches (« Qua-ritch », « Ney-tiri ») et 6 sur /nouveautes/, dont l'entrée L74 qui dit le contraire (« Ron-gloa », 320 px
// texte 200 %). Chaque occurrence d'un nom de PERSON_NAMES dans <main> doit tenir sur une seule ligne.
test('P8 — fiches et /nouveautes/, 320 et 390 px, texte 150 à 200 % : aucun nom de personne coupé', { timeout: 1_200_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let seen = 0;
  const source = PERSON_NAME_SOURCE; // noms échappés, apostrophes droite et typographique (revue de code r2 de L74)
  for (const width of [320, 390]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of [...FICHES, '/nouveautes/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.5, 1.75, 2]) {
        await setText(page, factor);
        const r = await page.evaluate((src) => {
          const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'gu');
          const cut = [];
          let count = 0;
          const walker = document.createTreeWalker(document.getElementById('contenu'), NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.parentElement.checkVisibility()) continue;
            for (const m of n.data.matchAll(re)) {
              const range = document.createRange();
              range.setStart(n, m.index);
              range.setEnd(n, m.index + m[0].length);
              const rects = [...range.getClientRects()].filter((x) => x.width > 0.5);
              if (!rects.length) continue;
              count++;
              if (rects.some((a) => rects.some((b) => b.top > a.top + a.height / 2))) cut.push(m[0]);
            }
          }
          return { count, cut };
        }, source);
        seen += r.count;
        for (const w of r.cut) failures.push(`${path} @${width}px texte ${factor * 100} % : « ${w} » coupé`);
      }
    }
    await page.close();
  }
  assert.ok(seen > 1000, `${seen} noms seulement : la mesure ne les voit plus`);
  assert.deepEqual(failures, [], `${failures.length} nom(s) coupé(s) :\n${failures.slice(0, 40).join('\n')}`);
});

test('P9 — fiches et /nouveautes/, 320 et 390 px, texte 125 à 200 % : au plus 3 lignes de suite finies par une coupure, sans défilement', { timeout: 1_200_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let cutLines = 0;
  for (const width of [320, 390]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of [...FICHES, '/nouveautes/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1.25, 1.5, 1.75, 2]) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (sw > cw) failures.push(`${where} : la page défile de côté (${sw} px pour ${cw})`);
        for (const r of await hyphenRuns(page, '#contenu .entry-summary, #contenu .entry-body, #contenu .news-body')) {
          cutLines += r.length;
          if (r.length > 3) failures.push(`${where} : ${r.length} lignes à trait de suite (${r.words.join(' | ')}) dans « ${r.block}… »`);
        }
      }
    }
    await page.close();
  }
  // Mesure vivante : des milliers de lignes finies par une coupure sur ces 552 vues (5 300 environ au réglage de L77).
  assert.ok(cutLines > 1000, `${cutLines} lignes à trait seulement : la mesure ne les voit plus`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});
