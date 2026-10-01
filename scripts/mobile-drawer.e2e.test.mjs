// L14 — tiroir de navigation au téléphone : le bouton menu doit FAIRE ENTRER la barre
// latérale dans l'écran (elle restait hors champ derrière le voile : Tailwind 4 décale
// avec la propriété `translate`, l'ouverture ne remettait que `transform` à zéro).
// Lit frontend/dist (lancer `npx astro build` avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './lib/e2e-dist.mjs';

const PAGES = ['/pandora/', '/pandora/eywa/', '/bestiaire/', '/langue/', '/videos/', '/nouveautes/'];

test('320 et 390 px : le menu ouvre le tiroir dans l’écran, tous ses liens visibles, Échap le referme', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const width of [320, 390]) {
    const context = await env.browser.newContext({ viewport: { width, height: 700 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const path of PAGES) {
      const where = `${path} @${width}px`;
      await page.goto(env.base + path, { waitUntil: 'load' });
      const left = () => page.evaluate(() => document.getElementById('eywa-sidebar').getBoundingClientRect().left);
      assert.ok(await left() < -100, `${where} : tiroir visible avant ouverture`);
      await page.click('#eywa-burger');
      await page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1);
      // Chaque lien du tiroir est dans l'écran (au besoin en faisant défiler le tiroir).
      for (const href of await page.$$eval('#eywa-sidebar a', (as) => as.map((a) => a.getAttribute('href')))) {
        const link = page.locator(`#eywa-sidebar a[href="${href}"]`);
        await link.scrollIntoViewIfNeeded();
        const box = await link.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 0.5, `${where} : ${href} hors de l'écran`);
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('eywa-sidebar').getBoundingClientRect().left < -100);
    }
    await context.close();
  }
});
