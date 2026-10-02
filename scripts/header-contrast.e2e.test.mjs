// L14 — WCAG 1.4.3 : sur-titre, titre et chapeau de la page Nouveautés, posés sans carte
// sur l'ambiance du codex (dégradés bioluminescents animés, particules WebGL, halo du
// curseur), mesurés au PIRE PIXEL sous les glyphes, à 1440 et 390 px, halo du curseur
// placé sur le texte. Les particules sont figées (requestAnimationFrame suspendu) le temps
// de chaque mesure, sur trois images différentes de l'animation.
// Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ringContrast, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

// En-tête commun des pages méta (components/MetaHeader.astro) : Nouveautés et Plan de
// travail (L20), mesurés tous les deux.
const SELECTORS = ['.meta-eyebrow', '.meta-title', '.meta-lede'];
const PAGES = ['/nouveautes/', '/plan-de-travail/'];

test('en-tête de /nouveautes/ et /plan-de-travail/ ≥ 4,5:1 au pire pixel du fond (1440/390 px)', { timeout: 360_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const report = [];
  const failures = [];
  for (const path of PAGES) for (const width of [1440, 390]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const frame of [1, 2, 3]) {
      // Une image différente de l'animation à chaque tour : page rechargée, attente variable,
      // puis boucle de rendu des particules suspendue le temps des mesures.
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800 + 700 * frame);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      for (const sel of SELECTORS) {
        // Halo du curseur (au bureau) posé au centre du texte mesuré : le pire cas.
        const box = await page.locator(sel).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
        const { worst, glyphs } = await worstPixelContrast(page, sel);
        const where = `${path} ${sel} @${width}px image ${frame}`;
        report.push(`${where} : ${worst.toFixed(2)}:1 (${glyphs} px)`);
        assert.ok(glyphs > 20, `${where} : glyphes non détectés`);
        if (worst < 4.5) failures.push(`${where} : ${worst.toFixed(2)}:1`);
      }
    }
    await context.close();
  }
  for (const line of report) t.diagnostic(line);
  assert.deepEqual(failures, []);
});

// Revue UX L14 : l'anneau de 2 px autour des lettres (là où l'œil lit le contour) passait
// sous 4,5:1 quand le pollen défilait (sur-titre : 5 % des pixels à 320 px, 1er
// percentile 2,75:1). Mesuré comme le relecteur, à 1440/390/320 px, 8 images par élément.
test('en-tête de /nouveautes/ et /plan-de-travail/ : anneau de 2 px autour des lettres : 1er percentile ≥ 4,5:1, ≤ 0,5 % des pixels sous le seuil', { timeout: 480_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const report = [];
  const failures = [];
  for (const path of PAGES) for (const [width, height] of [[1440, 900], [390, 844], [320, 700]]) {
    const context = await env.browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    for (const sel of SELECTORS) {
      const { ring, min, p1, share } = await ringContrast(page, sel);
      const where = `${path} ${sel} @${width}px`;
      report.push(`${where} : anneau ${ring} px, min ${min.toFixed(2)}, p1 % ${p1.toFixed(2)}, sous 4,5 : ${(share * 100).toFixed(2)} %`);
      assert.ok(ring > 50, `${where} : anneau non détecté`);
      // Le pollen est aléatoire : quelques pixels isolés d'un passage de particule sont
      // tolérés (avant correctif : 4,7 % et 1er percentile 2,7:1 sur le sur-titre à 320 px).
      if (share > 0.005 || p1 < 4.5) failures.push(`${where} : ${(share * 100).toFixed(2)} % sous 4,5:1 (p1 % ${p1.toFixed(2)})`);
    }
    await context.close();
  }
  for (const line of report) t.diagnostic(line);
  assert.deepEqual(failures, []);
});
