// L73 — titres des pages hors des listes du codex, texte agrandi sur écran étroit. À 320 px texte 175 et 200 %, /langue/
// coupait ses titres sans trait (« lang|ue », « Na'|vi », « Alphab|et », « Gramm|aire », « Lexiqu|e ») et défilait de
// côté (363 px pour 320) ; même défaut ailleurs : À propos (« Claude », « Codex », 461 px), 404 (« n'existe »),
// Nouveautés (titres des entrées, 433 px), Plan de travail (« Récemment », 340 px), Vidéos (« recommandées »,
// « LinksTheSun »). Attendu, comme les 7 sections du codex (L71, L72) : coupures aux seuls U+00AD de titleBreaks,
// 3 lettres de chaque côté (repli à 2 avant dans un titre de section seulement), au plus 2 lignes à trait de suite,
// aucun U+00AD copié ni dans un nom accessible, aucun défilement horizontal. Rien ne change à 100 %.
// Texte agrandi joué comme les revues : taille de police de <html>. Lit frontend/dist ; skip sans playwright-core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';
import { titleLines } from './lib/title-lines.mjs';
import { wordBreaks } from './lib/word-breaks.mjs';
import { syllableBreaks } from '../frontend/src/lib/title-breaks.ts';

const SHY = '­';
const PAGES = ['/langue/', '/about/', '/404.html', '/nouveautes/', '/plan-de-travail/', '/videos/', '/'];
// Titres de section (repli à 2 lettres permis) : le h1 de /langue/ (section VI) et le bandeau de /videos/.
const SECTION_TITLES = new Set(["La langue Na'vi", 'Les voix qui ont fait grandir Pandora hors écran']);
const TITLES = ['h1', 'h2', 'h3', '.about-site .block.font-display', '.channel-link__name', '.channel-card__name'];

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
        // Hors du texte courant des Nouveautés (césure du navigateur, « anywhere » en secours), aucun mot cassé sans trait.
        await page.evaluate(() => { document.body.id ||= 'eywa-body'; });
        const { broken } = await wordBreaks(page, await page.evaluate(() => document.body.id));
        // Une adresse (« refactoringui.com », À propos) passe à la ligne avant son point, puis se coupe sans trait si son nom
        // ne tient pas : jamais de trait ajouté dans une adresse.
        const domains = await page.evaluate(() => [...document.querySelectorAll('.about-source-name')].map((e) => e.textContent.trim()).filter((s) => /\.[a-z]{2,4}\b/.test(s)));
        const words = broken.filter((w) => !domains.some((d) => d.startsWith(w.split(' ')[0])));
        if (path !== '/nouveautes/' && words.length) failures.push(`${where} : mots cassés ${words.join(', ')}`);
      }
    }
    await page.close();
  }
  assert.ok(cuts > 40, `${cuts} coupures seulement : la mesure ne voit plus les titres coupés`);
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 40).join('\n')}`);
});

test('P2 — /langue/ à 320 px texte 200 % : titre copié sans U+00AD, noms accessibles des titres et liens sans U+00AD', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  const context = await env.browser.newContext({ viewport: { width: 320, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(env.base + '/langue/', { waitUntil: 'load' });
  await setText(page, 2);
  assert.ok(await page.evaluate(() => document.querySelector('h1').textContent.includes('­')), 'le h1 de /langue/ ne porte plus de coupure');
  await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('h1'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+C');
  const copied = await page.evaluate(async () => {
    const out = {};
    for (const item of await navigator.clipboard.read()) for (const type of item.types) out[type] = await (await item.getType(type)).text();
    return out;
  });
  if (copied['text/plain'] !== "La langue Na'vi") failures.push(`h1 copié : ${JSON.stringify(copied['text/plain'])}`);
  if (!copied['text/html'] || copied['text/html'].includes(SHY)) failures.push(`h1 copié (HTML) : ${JSON.stringify(copied['text/html'])}`);
  const cdp = await context.newCDPSession(page);
  for (const path of PAGES) {
    await page.goto(env.base + path, { waitUntil: 'load' });
    await setText(page, 2);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    for (const n of nodes) {
      if (['heading', 'link'].includes(n.role?.value) && n.name?.value?.includes(SHY)) failures.push(`${path} ${n.role.value} « ${n.name.value.replaceAll(SHY, '·')} »`);
    }
    // Chaque titre coupé garde son nom exact (texte sans U+00AD).
    const titles = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].filter((h) => h.textContent.includes('­'))
      .map((h) => h.textContent.replaceAll('­', '').replace(/[ \t\n\u00a0\u202f]+/g, ' ').trim()));
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
    for (const path of [...PAGES, '/flore/', '/engins/', '/films/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await setText(page, 1);
      for (const r of await titleLines(page, [...TITLES, '#contenu .entry-card__title'])) {
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
test('P4 — 320, 375, 390, 414 et 768 px, texte 100 à 200 % par pas de 5 : aucune page ne défile de côté', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const width of [320, 375, 390, 414, 768]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (let pct = 100; pct <= 200; pct += path === '/about/' ? 5 : 25) {
        await setText(page, pct / 100);
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (sw > cw) failures.push(`${path} @${width}px texte ${pct} % : la page défile de côté (${sw} px pour ${cw})`);
      }
    }
    await page.close();
  }
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
