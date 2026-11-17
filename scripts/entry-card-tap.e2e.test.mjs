// L30 (Nielsen 1, revue UX L3) — carte du codex touchée : la fiche s'ouvre tout de suite, par le
// ClientRouter (sans rechargement), et l'éclat de la carte (« bloom ») dure 200 ms au plus.
// Avant L30, le toucher attendait 1,5 s (setTimeout) puis rechargeait toute la page (location.assign) :
// 1 593 ms mesurées du toucher à la nouvelle adresse.
// Lit frontend/dist (lancer le build avant) ; skip sans playwright-core/Chromium.
// Un seul Chromium pour les trois cas : sa première image peut prendre plus d'une minute (cf. nextFrames).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';

// Délai clic ou toucher → nouvelle adresse : l'ancien chemin en prenait 1 500 ms au moins (minuterie seule).
const MAX_NAV_MS = 1000;

async function openCodex(env, { width, height, touch }) {
  const context = await env.browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  await page.goto(`${env.base}/bestiaire/`, { waitUntil: 'load' });
  await nextFrames(page);
  const card = page.locator('a.entry-card').first();
  await card.scrollIntoViewIfNeeded();
  return { context, page, card };
}

async function measureNav(env, opts) {
  const { context, page, card } = await openCodex(env, opts);
  await page.evaluate(() => { window.__sansRechargement = true; });
  const href = await card.getAttribute('href');
  const t0 = Date.now();
  await Promise.all([
    page.waitForURL((u) => u.pathname === href, { waitUntil: 'commit' }),
    opts.touch ? card.tap() : card.click(),
  ]);
  const ms = Date.now() - t0;
  await page.waitForFunction((h) => location.pathname === h && document.querySelector('h1'), href);
  const kept = await page.evaluate(() => window.__sansRechargement === true);
  await context.close();
  return { href, ms, kept };
}

test('cartes du codex : navigation immédiate par le ClientRouter, éclat ≤ 200 ms', { timeout: 240_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('390 px au toucher : la fiche s’ouvre sans attendre ni recharger la page', async (st) => {
    const { href, ms, kept } = await measureNav(env, { width: 390, height: 844, touch: true });
    st.diagnostic(`toucher → ${href} : ${ms} ms`);
    assert.ok(kept, 'page rechargée : la navigation ne passe pas par le ClientRouter');
    assert.ok(ms < MAX_NAV_MS, `toucher → navigation en ${ms} ms (attendu < ${MAX_NAV_MS})`);
  });

  await t.test('1440 px à la souris : la fiche s’ouvre par le ClientRouter', async (st) => {
    const { href, ms, kept } = await measureNav(env, { width: 1440, height: 900, touch: false });
    st.diagnostic(`clic → ${href} : ${ms} ms`);
    assert.ok(kept, 'page rechargée : la navigation ne passe pas par le ClientRouter');
    assert.ok(ms < MAX_NAV_MS, `clic → navigation en ${ms} ms (attendu < ${MAX_NAV_MS})`);
  });

  await t.test('390 px au toucher : l’éclat apparaît au toucher, dure 200 ms au plus et s’éteint', async () => {
    const { context, page, card } = await openCodex(env, { width: 390, height: 844, touch: true });
    // Navigation retenue pour observer l'éclat seul : clic annulé sur <body>, après le script de la carte
    // (capture sur document) et avant le ClientRouter (bulle sur document).
    await page.evaluate(() => {
      window.__bloom = [];
      document.body.addEventListener('click', (e) => {
        const c = e.target.closest('a.entry-card');
        if (!c) return;
        e.preventDefault();
        const cs = getComputedStyle(c);
        window.__bloom.push({ on: c.classList.contains('is-blooming'), name: cs.animationName, dur: cs.animationDuration });
      });
    });
    await card.tap();
    const [seen] = await page.evaluate(() => window.__bloom);
    assert.ok(seen?.on, 'aucun éclat au toucher');
    assert.equal(seen.name, 'entry-card-bloom');
    const durMs = parseFloat(seen.dur) * (seen.dur.endsWith('ms') ? 1 : 1000);
    assert.ok(durMs > 0 && durMs <= 200, `éclat de ${seen.dur} (attendu ≤ 200 ms)`);
    // Rien ne reste « allumé » si la navigation n'a pas lieu.
    await page.waitForFunction(() => !document.querySelector('a.entry-card.is-blooming'), null, { timeout: 2000 });
    assert.equal(new URL(page.url()).pathname, '/bestiaire/', 'la navigation devait être retenue');
    await context.close();
  });
});
