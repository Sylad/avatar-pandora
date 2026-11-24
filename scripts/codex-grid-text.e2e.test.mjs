// L70 — grille des cartes des sections du codex avec le texte agrandi (WCAG 1.4.4). Revue UX de L69 : à 1280 px
// texte 175 % et à 1440 px texte 175–200 %, la grille du Bestiaire gardait ses colonnes de 170 à 223 px (points de
// rupture de la FENÊTRE, que le texte agrandi par la page ne change pas) et cassait 23 à 42 mots. Attendu : colonnes
// en em (.codex-grid), moins de colonnes quand le texte grandit, aucun mot cassé de 390 à 1440 px à 100, 125, 175 et
// 200 % ; au réglage normal, mêmes colonnes qu'avant à 1024, 1280 et 1440 px. Au passage (m1 de la même revue) :
// en mouvement réduit, le tiroir du codex, son voile et le bouton menu changent d'état sans transition.
// Revue UX de L70 (WCAG 1.4.4, F94) : les titres plafonnés en cqi ne grandissaient plus avec le texte. Titres en rem,
// longs mots coupés à leurs syllabes AVEC un trait (césure, coupures de lib/title-breaks.ts) : une telle coupure est
// permise, une coupure lettre à lettre sans trait reste un mot cassé ; au réglage normal, aucun titre n'est coupé.
// L71 (revue UX de L70, m1) : à 320 px texte 200 %, 15 mots de titre étaient cassés sans trait (« tec/hno-/logie »,
// « (2009/) ») : R1 et R5 couvrent aussi 320 px.
// Texte agrandi joué comme la revue : taille de police de <html> (×1 = les 109,375 % du site).
// Lit frontend/dist (lancer `npm run build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';
import { wordBreaks } from './lib/word-breaks.mjs';

const SECTIONS = ['/bestiaire/', '/pandora/', '/clans/', '/flore/', '/personnages/', '/films/', '/engins/'];
const WIDTHS = [320, 390, 768, 1024, 1280, 1440];
const FACTORS = [1, 1.25, 1.75, 2];

async function setText(page, factor) {
  await page.evaluate((f) => { document.documentElement.style.fontSize = `calc(109.375% * ${f})`; }, factor);
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page, 2);
}

// Colonnes de la grille, et mots cassés ou césurés dans le contenu (lib/word-breaks.mjs).
async function measure(page) {
  const grid = await page.evaluate(() => {
    const el = document.querySelector('#contenu .codex-grid');
    if (!el) return null;
    const cards = [...el.children].map((c) => c.getBoundingClientRect());
    const doc = document.documentElement;
    return {
      cols: cards.filter((c) => Math.abs(c.top - cards[0].top) < 1).length,
      colWidth: cards[0].width,
      overflow: doc.scrollWidth - doc.clientWidth,
    };
  });
  if (!grid) return null;
  return { ...grid, ...(await wordBreaks(page)) };
}

test('R1 — sections du codex, 320 à 1440 px, texte 100 à 200 % : aucun mot cassé sans trait, aucun défilement horizontal', { timeout: 600_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const width of WIDTHS) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    for (const path of SECTIONS) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of FACTORS) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const m = await measure(page);
        if (!m) { failures.push(`${where} : pas de grille .codex-grid`); continue; }
        if (m.broken.length) failures.push(`${where} : ${m.broken.length} mot(s) cassé(s) — ${m.broken.slice(0, 6).join(', ')}`);
        // Au réglage normal, aucun titre ne se césure : le rendu reste celui d'avant L70.
        if (factor === 1 && m.hyphenated.length) failures.push(`${where} : césure au réglage normal — ${m.hyphenated.join(', ')}`);
        if (process.env.EYWA_L70_LOG && m.hyphenated.length) console.log(`${where} : césures ${m.hyphenated.join(', ')}`);
        if (m.overflow > 0) failures.push(`${where} : défilement horizontal de ${m.overflow} px`);
      }
    }
    await page.close();
  }
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.join('\n')}`);
});

test('R5 — texte 200 % : chaque titre grandit au moins autant que le texte courant (320, 390, 768, 1024, 1440 px)', { timeout: 300_000 }, async (t) => {
  // Revue UX de L70 (WCAG 1.4.4, échec F94) : plafonnés en cqi, le titre de section restait à 100 % de sa taille et
  // les titres de carte à 117 % à 390 px texte 200 %, plus petits que le résumé et l'accroche qu'ils annoncent.
  const env = await setupBrowser(t);
  if (!env) return;
  const sizes = (page) => page.evaluate(() => {
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    return {
      h1: px(document.querySelector('.section-hero__title')),
      accroche: px(document.querySelector('.section-hero__tagline')),
      cartes: [...document.querySelectorAll('#contenu .codex-grid .entry-card__title')].map(px),
      resumes: [...document.querySelectorAll('#contenu .codex-grid .entry-card__summary')].map(px),
    };
  });
  const failures = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    for (const path of SECTIONS) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await setText(page, 1);
      const a = await sizes(page);
      await setText(page, 2);
      const b = await sizes(page);
      const where = `${path} @${width}px`;
      const text = Math.min(b.accroche / a.accroche, ...b.resumes.map((r, i) => r / a.resumes[i]));
      if (!(text >= 1.99)) failures.push(`${where} : le texte courant ne double pas (×${text.toFixed(2)})`);
      if (b.h1 / a.h1 < text - 0.01) failures.push(`${where} : titre de section ×${(b.h1 / a.h1).toFixed(2)} (${b.h1} px), texte ×${text.toFixed(2)}`);
      if (b.h1 < b.accroche) failures.push(`${where} : titre de section (${b.h1} px) plus petit que son accroche (${b.accroche} px)`);
      b.cartes.forEach((c, i) => {
        if (c / a.cartes[i] < text - 0.01) failures.push(`${where} carte ${i + 1} : titre ×${(c / a.cartes[i]).toFixed(2)} (${c} px), texte ×${text.toFixed(2)}`);
        if (c < b.resumes[i]) failures.push(`${where} carte ${i + 1} : titre (${c} px) plus petit que son résumé (${b.resumes[i]} px)`);
      });
    }
    await page.close();
  }
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.slice(0, 20).join('\n')}`);
});

test('R6 — marges latérales resserrées seulement à 320 px texte 175 et 200 % (L71), jamais à 390 px ni à 100 %', { timeout: 120_000 }, async (t) => {
  // L71 : dans un gabarit du codex de moins de 10,75 em, les marges de la page, du bandeau et des cartes gardent leur
  // taille du réglage normal. Ailleurs, elles suivent le texte comme avant (1 rem, min(1,25 rem, 7cqi), 1,25 rem).
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const width of [320, 390]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(env.base + '/films/', { waitUntil: 'load' });
    for (const factor of FACTORS) {
      await setText(page, factor);
      const m = await page.evaluate(() => {
        const pl = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).paddingLeft);
        return {
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          main: pl('#contenu'), hero: pl('.section-hero__content'), carte: pl('#contenu .entry-card__body'),
        };
      });
      const narrow = width === 320 && factor >= 1.75;
      const want = narrow
        ? { main: 0.5 * m.rem, hero: 0.5 * m.rem, carte: 0.75 * m.rem }
        : { main: m.rem, hero: Math.min(1.25 * m.rem, 0.07 * width), carte: 1.25 * m.rem };
      for (const k of ['main', 'hero', 'carte']) {
        if (Math.abs(m[k] - want[k]) > 0.3) failures.push(`@${width}px texte ${factor * 100} % : marge ${k} ${m[k]} px au lieu de ${want[k].toFixed(2)}`);
      }
    }
    await page.close();
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('R2 — le texte grandit, les colonnes diminuent : /bestiaire/ à 1280 et 1440 px', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const width of [1280, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(env.base + '/bestiaire/', { waitUntil: 'load' });
    let prev = Infinity;
    for (const factor of [1, 1.25, 1.75]) {
      await setText(page, factor);
      const m = await measure(page);
      assert.ok(m.cols <= prev, `@${width}px texte ${factor * 100} % : ${m.cols} colonnes, plus qu'à la taille précédente (${prev})`);
      // Une colonne fait au moins 14,5 fois la taille du texte (sauf colonne unique, bornée par la grille).
      const em = 17.5 * factor;
      if (m.cols > 1) assert.ok(m.colWidth >= 14.5 * em - 0.5, `@${width}px texte ${factor * 100} % : colonnes de ${m.colWidth} px < 14,5 em`);
      prev = m.cols;
    }
    await page.close();
  }
});

test('R3 — texte 100 % : mêmes colonnes qu’avant L70 à 1024, 1280 et 1440 px', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  // Mesurées avant L70 (md:grid-cols-2 xl:grid-cols-3 gap-5, barre latérale de 20 rem).
  const BEFORE = { 1024: [2, 282.3], 1280: [3, 266.3], 1440: [3, 319.6] };
  for (const [width, [cols, colWidth]] of Object.entries(BEFORE)) {
    const page = await env.browser.newPage({ viewport: { width: Number(width), height: 900 } });
    for (const path of SECTIONS) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await setText(page, 1);
      const m = await measure(page);
      assert.equal(m.cols, cols, `${path} @${width}px : ${m.cols} colonnes au lieu de ${cols}`);
      assert.ok(Math.abs(m.colWidth - colWidth) < 0.6, `${path} @${width}px : colonnes de ${m.colWidth} px au lieu de ${colWidth}`);
    }
    await page.close();
  }
});

test('R4 — mouvement réduit : tiroir, voile et bouton menu sans transition (sinon le tiroir glisse en 0,3 s)', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const durations = (page) => page.evaluate(() => {
    const max = (sel) => {
      const el = document.querySelector(sel);
      return Math.max(...getComputedStyle(el).transitionDuration.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000)));
    };
    return {
      tiroir: max('#eywa-sidebar'), voile: max('#eywa-drawer-overlay'),
      bouton: max('#eywa-burger'), trait: max('.eywa-burger__line'),
    };
  });
  for (const [width, factor] of [[390, 1], [1024, 2]]) {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const context = await env.browser.newContext({ viewport: { width, height: 800 }, reducedMotion });
      const page = await context.newPage();
      await page.goto(env.base + '/bestiaire/', { waitUntil: 'load' });
      await setText(page, factor);
      const d = await durations(page);
      const where = `@${width}px texte ${factor * 100} % ${reducedMotion}`;
      if (reducedMotion === 'reduce') {
        assert.deepEqual(d, { tiroir: 0, voile: 0, bouton: 0, trait: 0 }, `${where} : transitions restantes`);
        // Ouvert d'un coup : le tiroir est en place dès l'image suivante.
        await page.click('#eywa-burger');
        await nextFrames(page, 1);
        const left = await page.evaluate(() => document.getElementById('eywa-sidebar').getBoundingClientRect().left);
        assert.ok(Math.abs(left) < 1, `${where} : tiroir à ${left} px juste après l'ouverture`);
      } else {
        assert.equal(d.tiroir, 300, `${where} : le tiroir ne glisse plus (${d.tiroir} ms)`);
      }
      await context.close();
    }
  }
});
