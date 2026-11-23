// L70 — grille des cartes des sections du codex avec le texte agrandi (WCAG 1.4.4). Revue UX de L69 : à 1280 px
// texte 175 % et à 1440 px texte 175–200 %, la grille du Bestiaire gardait ses colonnes de 170 à 223 px (points de
// rupture de la FENÊTRE, que le texte agrandi par la page ne change pas) et cassait 23 à 42 mots. Attendu : colonnes
// en em (.codex-grid), moins de colonnes quand le texte grandit, aucun mot cassé de 390 à 1440 px à 100, 125, 175 et
// 200 % ; au réglage normal, mêmes colonnes qu'avant à 1024, 1280 et 1440 px. Au passage (m1 de la même revue) :
// en mouvement réduit, le tiroir du codex, son voile et le bouton menu changent d'état sans transition.
// Texte agrandi joué comme la revue : taille de police de <html> (×1 = les 109,375 % du site).
// Lit frontend/dist (lancer `npm run build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';

const SECTIONS = ['/bestiaire/', '/pandora/', '/clans/', '/flore/', '/personnages/', '/films/', '/engins/'];
const WIDTHS = [390, 768, 1024, 1280, 1440];
const FACTORS = [1, 1.25, 1.75, 2];

async function setText(page, factor) {
  await page.evaluate((f) => { document.documentElement.style.fontSize = `calc(109.375% * ${f})`; }, factor);
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page, 2);
}

// Colonnes de la grille et mots cassés au milieu dans le contenu (un mot dont les morceaux tiennent sur deux lignes).
async function measure(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('#contenu .codex-grid');
    if (!grid) return null;
    const cards = [...grid.children].map((c) => c.getBoundingClientRect());
    const cols = cards.filter((c) => Math.abs(c.top - cards[0].top) < 1).length;
    const broken = [];
    const walker = document.createTreeWalker(document.getElementById('contenu'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const host = n.parentElement;
      if (!host || host.closest('svg, script, style, .sr-only')) continue;
      const cs = getComputedStyle(host);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      for (const m of n.textContent.matchAll(/[^\s\-‐–—\/]+/gu)) {
        if (m[0].length < 2) continue;
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
        if (rects.some((a) => rects.some((b) => b.top > a.top + a.height / 2))) broken.push(m[0]);
      }
    }
    const doc = document.documentElement;
    return { cols, colWidth: cards[0].width, broken, overflow: doc.scrollWidth - doc.clientWidth };
  });
}

test('R1 — sections du codex, 390 à 1440 px, texte 100 à 200 % : aucun mot cassé, aucun défilement horizontal', { timeout: 600_000 }, async (t) => {
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
        if (m.overflow > 0) failures.push(`${where} : défilement horizontal de ${m.overflow} px`);
      }
    }
    await page.close();
  }
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.join('\n')}`);
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
