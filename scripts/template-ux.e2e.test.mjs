// L13 — revue UX du gabarit commun (navigation, en-tête, rendu téléphone). Lit frontend/dist ;
// skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const PAGES = ['/', '/about/', '/pandora/', '/clans/', '/clans/anurai/', '/videos/', '/langue/', '/nouveautes/', '/plan-de-travail/'];

for (const path of PAGES) {
  test(`R1 — ${path} : « Aller au contenu » est le premier arrêt de Tab, caché hors focus, et mène au contenu (WCAG 2.4.1)`, { timeout: 60_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    assert.equal(await skip.count(), 1);
    // Hors focus : hors de l'écran, pas seulement transparent.
    const rest = await skip.boundingBox();
    assert.ok(!rest || rest.y + rest.height <= 0 || rest.x + rest.width <= 0, `visible au repos : ${JSON.stringify(rest)}`);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Aller au contenu');
    const box = await skip.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.height >= 24, `invisible au focus : ${JSON.stringify(box)}`);
    await page.keyboard.press('Enter');
    const landed = await page.evaluate(() => ({
      tag: document.activeElement?.tagName, id: document.activeElement?.id, hash: location.hash,
    }));
    assert.deepEqual(landed, { tag: 'MAIN', id: 'contenu', hash: '#contenu' });
    assert.equal(await page.locator('main').count(), 1);
  });
}

test('R1 — le lien d’évitement fonctionne encore après une navigation ClientRouter', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  await page.locator('#eywa-sidebar a[href="/clans/"]').click();
  await page.waitForURL('**/clans/');
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Aller au contenu');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'contenu');
});

for (const path of PAGES.filter((p) => p !== '/' && p !== '/about/')) {
  test(`R2 — ${path} : chaque repère de navigation porte un nom, et deux repères n’ont jamais le même (WCAG 1.3.1 / ARIA11)`, { timeout: 60_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('nav, aside, [role="navigation"], [role="complementary"]')]
        .map((n) => `${n.tagName.toLowerCase()}:${n.getAttribute('aria-label') ?? ''}`));
    assert.ok(names.length >= 2, `repères trouvés : ${names}`);
    assert.deepEqual(names.filter((n) => n.endsWith(':')), [], 'repère sans nom');
    assert.equal(new Set(names.map((n) => n.split(':')[1])).size, names.length, `noms en double : ${names}`);
  });
}

// Le plan avait renvoyé ici le chapô de /videos/ (1,62:1 mesuré par la revue de L11) : texte nu posé
// sur les particules, sans voile — le gabarit offre désormais la classe .codex-text-veil.
for (const width of [1440, 390]) {
  test(`R3 — /videos/ @${width}px : l’intro de section (texte nu sur les particules) ≥ 4,5:1 au pire pixel, sur trois images`, { timeout: 120_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const sel = '.vid-section-intro';
    const failures = [];
    for (const frame of [1, 2, 3]) {
      await page.goto(`${env.base}/videos/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800 + 700 * frame);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      const { worst, glyphs } = await worstPixelContrast(page, sel);
      assert.ok(glyphs > 20, `glyphes non détectés (image ${frame})`);
      if (worst < 4.5) failures.push(`image ${frame} : ${worst.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, []);
    await context.close();
  });
}

test('R3 — la classe .codex-text-veil est appliquée à chaque intro de section de /videos/', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${env.base}/videos/`, { waitUntil: 'load' });
  const total = await page.locator('.vid-section-intro').count();
  assert.ok(total >= 3);
  assert.equal(await page.locator('.vid-section-intro.codex-text-veil').count(), total);
});

test('R4 — aucune page de premier niveau ne déborde à 320 px (WCAG 1.4.10)', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 320, height: 568 } });
  const wide = [];
  for (const path of PAGES) {
    await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 320) wide.push(`${path} : ${sw} px`);
  }
  assert.deepEqual(wide, []);
});
