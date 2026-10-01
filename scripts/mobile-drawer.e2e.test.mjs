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

// ClientRouter : les pages s'enchaînent sans rechargement ; le menu doit encore s'ouvrir
// après une navigation par le tiroir, et après être arrivé depuis l'accueil (sans tiroir).
test('390 px, navigation sans rechargement : le menu s’ouvre encore après chaque page', { timeout: 120_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const opened = () => page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1, null, { timeout: 5000 });
  await page.goto(`${env.base}/`, { waitUntil: 'load' });
  await page.evaluate(() => { window.__sansRechargement = true; });
  await Promise.all([page.waitForURL((u) => u.pathname === '/pandora/intro/'), page.click('a[href="/pandora/intro/"]')]);
  for (const next of ['/bestiaire/', '/nouveautes/', '/langue/']) {
    await page.click('#eywa-burger');
    await opened();
    await Promise.all([page.waitForURL((u) => u.pathname === next), page.locator(`#eywa-sidebar a[href="${next}"]`).click()]);
    await page.waitForFunction(() => document.documentElement.getAttribute('data-drawer-open') === null);
  }
  await page.click('#eywa-burger');
  await opened();
  assert.ok(await page.evaluate(() => window.__sansRechargement), 'la page a été rechargée : ClientRouter non exercé');
  await context.close();
});

// Revue UX L14 (WCAG 2.4.3 / 2.4.7 / 2.4.11) : tiroir fermé, ses liens hors écran ne
// doivent pas recevoir le focus ; tiroir ouvert, le focus reste dans le tiroir et le
// bouton menu ; Échap ramène le focus au bouton. Aussi après une navigation ClientRouter.
const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const r = a.getBoundingClientRect();
  return {
    tag: a.tagName, href: a.getAttribute('href'), id: a.id,
    inDrawer: !!a.closest('#eywa-sidebar'), isBurger: a.id === 'eywa-burger',
    visible: r.width > 0 && r.right > 0 && r.left < innerWidth,
  };
});

async function checkClosedTabOrder(page, where) {
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const f = await focusInfo(page);
    assert.ok(!f.inDrawer, `${where} : tiroir fermé, Tab ${i + 1} atteint ${f.href ?? f.tag} dans le tiroir`);
    if (f.tag !== 'BODY') assert.ok(f.visible, `${where} : Tab ${i + 1} sur un élément hors écran (${f.href ?? f.tag})`);
  }
}

async function checkOpenTrap(page, where) {
  await page.focus('#eywa-burger');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1);
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const f = await focusInfo(page);
    assert.ok(f.inDrawer || f.isBurger, `${where} : tiroir ouvert, Tab ${i + 1} sort vers ${f.href ?? f.tag}`);
    seen.add(f.href ?? f.id);
  }
  assert.ok(seen.has('/nouveautes/') && seen.has('eywa-burger'), `${where} : la boucle ne passe pas par tout le tiroir`);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Shift+Tab');
    const f = await focusInfo(page);
    assert.ok(f.inDrawer || f.isBurger, `${where} : Maj+Tab ${i + 1} sort vers ${f.href ?? f.tag}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-drawer-open') === null);
  assert.ok((await focusInfo(page)).isBurger, `${where} : Échap ne rend pas le focus au bouton menu`);
}

test('320/390 px, clavier : tiroir fermé hors de l’ordre de tabulation, ouvert = focus piégé, Échap → bouton', { timeout: 180_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const width of [320, 390]) {
    const context = await env.browser.newContext({ viewport: { width, height: 700 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
    await checkClosedTabOrder(page, `@${width}px chargement`);
    await checkOpenTrap(page, `@${width}px chargement`);
    // Le voile referme aussi.
    await page.click('#eywa-burger');
    await page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1);
    await page.mouse.click(width - 8, 650);
    await page.waitForFunction(() => document.documentElement.getAttribute('data-drawer-open') === null);
    // Navigation ClientRouter par le tiroir, puis mêmes contrôles.
    await page.click('#eywa-burger');
    await page.waitForFunction(() => Math.abs(document.getElementById('eywa-sidebar').getBoundingClientRect().left) < 1);
    await Promise.all([page.waitForURL((u) => u.pathname === '/bestiaire/'), page.locator('#eywa-sidebar a[href="/bestiaire/"]').click()]);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement?.blur());
    await checkClosedTabOrder(page, `@${width}px après navigation`);
    await checkOpenTrap(page, `@${width}px après navigation`);
    await context.close();
  }
});

test('≥ 1024 px : pas de bouton menu, la barre latérale reste dans l’ordre de tabulation', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const width of [1024, 1440]) {
    const context = await env.browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('eywa-burger')).display), 'none', `${width}px : bouton menu affiché`);
    assert.equal(await page.evaluate(() => document.getElementById('eywa-sidebar').inert), false, `${width}px : barre latérale inerte`);
    await context.close();
  }
});
