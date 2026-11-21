// L67 — WCAG 1.4.3 : chaque libellé du menu du codex (barre latérale au bureau, tiroir au
// téléphone) ≥ 4,5:1 au PIRE PIXEL de son fond réel : particules WebGL, halo du curseur, voile.
// Revue UX L32 r2 (hors lot) : barre transparente au bureau, une particule claire passait derrière
// un mot et le faisait tomber jusqu'à 1,0:1 (10 libellés sur 13 sous 4,5:1).
// États mesurés : au repos (pointeur sur le contenu), au survol (pointeur sur le libellé : le halo
// et les particules le suivent), au focus clavier, et à l'état actif (section courante, page courante).
// Particules figées (requestAnimationFrame suspendu) sur deux images différentes de l'animation.
// La mousse (L32) est mesurée sur le menu par bio-moss.e2e.test.mjs ; elle est masquée sous sa bande.
// Lit frontend/dist ; skip sans Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

// Les 13 libellés : marque, 9 sections, 3 liens du bas (le texte seul, sans l'icône ni la pastille).
const LABELS = [
  '.eywa-sidebar__brand > span.uppercase',
  ...Array.from({ length: 9 }, (_, i) => `.eywa-sidebar nav a >> nth=${i}`),
  ...Array.from({ length: 3 }, (_, i) => `.eywa-sidebar .eywa-about__link >> nth=${i} >> span >> nth=0`),
];

const CASES = [
  // Section courante « Clans Na'vi » : état actif d'un lien de section.
  { path: '/clans/omatikaya/', viewport: [1440, 900] },
  { path: '/clans/omatikaya/', viewport: [390, 844] },
  // Page courante « Nouveautés » : état actif d'un lien du bas.
  { path: '/nouveautes/', viewport: [1440, 900] },
];

async function openMenu(env, path, [width, height], frame) {
  const context = await env.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${env.base}${path}`, { waitUntil: 'load', timeout: 180_000 });
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page);
  if (width < 1024) {
    await page.locator('#eywa-burger').click();
    await page.waitForTimeout(500); // translation du tiroir (300 ms)
  }
  await page.waitForTimeout(600 + 900 * frame); // une image différente de l'ambiance
  return { context, page };
}

test('menu du codex : chaque libellé ≥ 4,5:1 au pire pixel, au repos, au survol, au focus et actif (1440/390 px)', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  let measured = 0;
  for (const { path, viewport } of CASES) for (const frame of [1, 2]) {
    const { context, page } = await openMenu(env, path, viewport, frame);
    const main = await page.locator('main').boundingBox();
    for (const state of ['repos', 'survol', 'focus']) {
      for (const sel of LABELS) {
        const el = page.locator(sel);
        const link = el.locator('xpath=ancestor-or-self::a[1]');
        if (state === 'repos') {
          // Pointeur loin du menu (au téléphone : sur le voile, hors du tiroir).
          await page.mouse.move(viewport[0] - 20, Math.min(main.y + 300, viewport[1] - 20));
        } else if (state === 'survol') {
          const box = await el.boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        } else {
          await page.mouse.move(viewport[0] - 20, viewport[1] - 20);
          await page.keyboard.press('Shift'); // dernière interaction au clavier : :focus-visible
          await link.focus();
        }
        await page.waitForTimeout(400); // transitions de couleur (300 ms) et halo du curseur
        // Ambiance figée le temps de la mesure, puis relancée (rappels mis de côté, rendus ensuite).
        await page.evaluate(() => {
          window.__eywaRaf ??= window.requestAnimationFrame;
          window.__eywaRafQueue = [];
          window.requestAnimationFrame = (cb) => { window.__eywaRafQueue.push(cb); return 0; };
        });
        // Transitions de couleur coupées : la mesure rend le texte transparent puis le remet.
        const still = await page.addStyleTag({ content: '.eywa-sidebar a, .eywa-sidebar a * { transition: none !important; }' });
        const { worst, glyphs } = await worstPixelContrast(page, sel);
        await still.evaluate((n) => n.remove());
        await page.evaluate(() => {
          window.requestAnimationFrame = window.__eywaRaf;
          for (const cb of window.__eywaRafQueue.splice(0)) window.__eywaRaf.call(window, cb);
        });
        const active = await link.evaluate((a) => a.getAttribute('aria-current') === 'page');
        const name = (await el.innerText()).trim();
        const where = `${path} « ${name} »${active ? ' (actif)' : ''} ${state} @${viewport[0]}px image ${frame}`;
        t.diagnostic(`${where} : ${worst.toFixed(2)}:1 (${glyphs} px)`);
        assert.ok(glyphs > 20, `${where} : glyphes non détectés`);
        measured++;
        if (worst < 4.5) failures.push(`${where} : ${worst.toFixed(2)}:1`);
        if (state === 'focus') await link.evaluate((a) => a.blur()); // après la mesure seulement
      }
    }
    await context.close();
  }
  assert.equal(measured, CASES.length * 2 * 3 * LABELS.length);
  assert.deepEqual(failures, []);
});
