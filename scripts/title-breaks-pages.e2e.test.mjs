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
        // Une adresse (« refactoringui.com », À propos) se coupe sans trait : jamais de trait ajouté dans une adresse.
        const words = broken.filter((w) => !/^\S+\.[a-z]{2,4} \(/.test(w));
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
      .map((h) => h.textContent.replaceAll('­', '').replace(/[ \t\n]+/g, ' ').trim()));
    const names = new Set(nodes.filter((n) => n.role?.value === 'heading').map((n) => n.name?.value));
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
