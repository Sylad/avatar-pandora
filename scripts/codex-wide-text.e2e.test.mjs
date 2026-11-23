// L69 — gabarit du codex avec le texte agrandi (WCAG 1.4.4, 1.4.10). La barre latérale mesure 20 rem :
// elle grandit avec le texte. À 1024 px et texte à 200 %, elle laissait 384 px au contenu (37 %) et
// 25 mots se cassaient au milieu sur /videos (revue UX r2 de L47). Attendu : à 1024 et 1280 px, texte à
// 200 %, le contenu garde au moins 45 % de la largeur et aucun mot n'est cassé ; le menu passe alors au
// tiroir, atteignable et refermable au clavier comme au téléphone. À 100 %, la barre reste à sa place.
// Texte agrandi joué comme dans la revue : taille de police de <html> (feuille de l'utilisateur,
// extension, réglage « texte seul ») — que les media queries, en em du réglage initial, ne voient pas.
// Lit frontend/dist (lancer `npm run build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, settleAnimations } from './lib/e2e-dist.mjs';

const PAGES = ['/videos/', '/bestiaire/', '/bestiaire/akula/', '/pandora/eywa/', '/nouveautes/'];
// Taille du texte du site (109,375 % = 17,5 px) multipliée par le facteur.
const TEXT = (factor) => `calc(109.375% * ${factor})`;

async function setText(page, factor) {
  await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, TEXT(factor));
  // Deux images : la mise en page, les requêtes de conteneur et le ResizeObserver ont suivi ; puis le
  // tiroir a fini de glisser hors de l'écran (transition de 300 ms, sur l'horloge de la page).
  await nextFrames(page, 2);
  await settleAnimations(page, '#eywa-sidebar');
}

// Mots cassés au milieu : un mot (sans trait d'union ni tiret) dont les morceaux tiennent sur plus d'une ligne.
async function brokenWords(page) {
  return page.evaluate(() => {
    const out = [];
    const main = document.getElementById('contenu');
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const host = n.parentElement;
      if (!host || host.closest('svg, script, style, .sr-only')) continue;
      const cs = getComputedStyle(host);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const text = n.textContent;
      for (const m of text.matchAll(/[^\s\-‐–—\/]+/gu)) {
        if (m[0].length < 2) continue;
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        // Deux morceaux sur des lignes différentes : l'un commence sous le milieu de l'autre.
        const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
        const split = rects.some((a) => rects.some((b) => b.top > a.top + a.height / 2));
        if (split) out.push(m[0]);
      }
    }
    return out;
  });
}

async function layout(page) {
  return page.evaluate(() => {
    const side = document.getElementById('eywa-sidebar');
    const s = side.getBoundingClientRect();
    const main = document.getElementById('contenu');
    const m = main.getBoundingClientRect();
    const burger = document.getElementById('eywa-burger');
    return {
      vw: document.documentElement.clientWidth,
      sideLeft: s.left, sideWidth: s.width, sidePos: getComputedStyle(side).position,
      mainLeft: m.left, mainWidth: m.width, mainPadLeft: getComputedStyle(main).paddingLeft,
      burger: getComputedStyle(burger).display !== 'none' && burger.getBoundingClientRect().width > 0,
      topbar: getComputedStyle(document.querySelector('.eywa-topbar')).display !== 'none',
    };
  });
}

test('R1 — 1024 et 1280 px, texte à 200 % : contenu ≥ 45 % de la largeur, aucun mot cassé, menu en tiroir', { timeout: 240_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const width of [1024, 1280]) {
    const page = await env.browser.newPage({ viewport: { width, height: 800 } });
    for (const path of PAGES) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      await setText(page, 2);
      const where = `${path} @${width}px texte 200 %`;
      const g = await layout(page);
      const share = g.mainWidth / g.vw;
      if (share < 0.45) failures.push(`${where} : contenu ${Math.round(g.mainWidth)} px = ${Math.round(share * 100)} % de la largeur`);
      // La barre latérale ne prend plus de place : elle est un tiroir fermé, hors de l'écran, et le bouton menu est là.
      if (!g.burger) failures.push(`${where} : pas de bouton menu`);
      if (g.sideLeft + g.sideWidth > 1) failures.push(`${where} : barre latérale dans l'écran (gauche ${Math.round(g.sideLeft)}, largeur ${Math.round(g.sideWidth)})`);
      const broken = await brokenWords(page);
      if (broken.length) failures.push(`${where} : ${broken.length} mot(s) cassé(s) — ${broken.slice(0, 8).join(', ')}`);
    }
    await page.close();
  }
  assert.deepEqual(failures, [], `${failures.length} défaut(s) :\n${failures.join('\n')}`);
});

test('R2 — 1024, 1280 et 1440 px, texte à 100 % et 125 % : la barre latérale reste collante à gauche, comme avant', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const width of [1024, 1280, 1440]) {
    const page = await env.browser.newPage({ viewport: { width, height: 800 } });
    for (const path of ['/videos/', '/bestiaire/akula/']) {
      await page.goto(env.base + path, { waitUntil: 'load' });
      for (const factor of [1, 1.25]) {
        await setText(page, factor);
        const where = `${path} @${width}px texte ${factor * 100} %`;
        const g = await layout(page);
        const side = 20 * 17.5 * factor; // w-80 = 20 rem
        assert.equal(g.sidePos, 'sticky', `${where} : barre latérale ${g.sidePos}`);
        assert.equal(g.sideLeft, 0, `${where} : barre latérale décalée`);
        assert.ok(Math.abs(g.sideWidth - side) < 0.5, `${where} : barre de ${g.sideWidth} px au lieu de ${side}`);
        assert.ok(Math.abs(g.mainLeft - side) < 0.5, `${where} : contenu à ${g.mainLeft} px`);
        assert.equal(g.mainPadLeft, `${2.5 * 17.5 * factor}px`, `${where} : marge du contenu`);
        assert.equal(g.burger, false, `${where} : bouton menu visible`);
        assert.equal(g.topbar, false, `${where} : bande du haut visible`);
      }
    }
    await page.close();
  }
});

test('R3 — 1024 px texte à 200 % : le tiroir s’ouvre et se referme au clavier comme au téléphone', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(env.base + '/bestiaire/', { waitUntil: 'load' });
  await setText(page, 2);
  const g = await layout(page);
  assert.ok(g.burger, 'bouton menu absent');
  // Tiroir fermé : ses liens ne prennent pas le focus.
  assert.equal(await page.evaluate(() => document.getElementById('eywa-sidebar').inert), true, 'tiroir fermé mais focalisable');
  // Le bouton menu est atteignable au Tab.
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.id === 'eywa-burger');
  }
  assert.ok(reached, 'bouton menu jamais atteint au Tab');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1);
  assert.equal(await page.evaluate(() => document.getElementById('eywa-burger').getAttribute('aria-expanded')), 'true');
  // Tab mène dans le tiroir, qui reste dans l'écran.
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return { inside: !!a.closest('#eywa-sidebar'), right: r.right, vw: innerWidth };
  });
  assert.ok(inside.inside, 'Tab ne mène pas dans le tiroir ouvert');
  assert.ok(inside.right <= inside.vw, 'lien du tiroir hors de l’écran');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('eywa-sidebar').getBoundingClientRect().right <= 1);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'eywa-burger', 'Échap ne rend pas le focus au bouton menu');
  // Retour au texte normal : la barre latérale reprend sa place, sans tiroir ni contenu inerte.
  await setText(page, 1);
  const back = await layout(page);
  assert.equal(back.sidePos, 'sticky');
  assert.equal(back.burger, false);
  assert.equal(await page.evaluate(() => document.getElementById('eywa-sidebar').inert), false, 'barre latérale inerte au texte normal');
  assert.equal(await page.evaluate(() => document.getElementById('contenu').closest('[inert]')), null, 'contenu inerte');
  await context.close();
});
