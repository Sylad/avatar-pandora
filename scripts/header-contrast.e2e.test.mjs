// L14 — WCAG 1.4.3 : sur-titre, titre et chapeau de la page Nouveautés, posés sans carte
// sur l'ambiance du codex (dégradés bioluminescents animés, particules WebGL, halo du
// curseur), mesurés au PIRE PIXEL sous les glyphes, à 1440 et 390 px, halo du curseur
// placé sur le texte. Les particules sont figées (requestAnimationFrame suspendu) le temps
// de chaque mesure, sur trois images différentes de l'animation.
// Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const SELECTORS = ['.news-eyebrow', '.news-title', '.news-lede'];

test('en-tête de /nouveautes/ ≥ 4,5:1 au pire pixel du fond (1440/390 px)', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const report = [];
  const failures = [];
  for (const width of [1440, 390]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const frame of [1, 2, 3]) {
      // Une image différente de l'animation à chaque tour : page rechargée, attente variable,
      // puis boucle de rendu des particules suspendue le temps des mesures.
      await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800 + 700 * frame);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      for (const sel of SELECTORS) {
        // Halo du curseur (au bureau) posé au centre du texte mesuré : le pire cas.
        const box = await page.locator(sel).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
        const { worst, glyphs } = await worstPixelContrast(page, sel);
        const where = `${sel} @${width}px image ${frame}`;
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
