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

// Délai mesuré sur l'HORLOGE DE LA PAGE (L68), plus à la montre du runner : du moment où la page traite le geste
// (premier `pointerdown`, sinon `click`, en capture sur document : avant tout script de la carte) au moment où le
// ClientRouter change l'adresse (`history.pushState`). Mesuré au mur, Playwright comptait aussi l'acheminement du
// geste et des réponses par CDP, qui s'allonge sous charge (1 061 ms le 23-11 à charge ~115 sans aucun défaut).
// L'ancien chemin (minuterie de 1,5 s puis `location.assign`) échoue toujours : la minuterie court dans la page,
// et un rechargement perd `__sansRechargement`.
async function measureNav(env, opts) {
  const { context, page, card } = await openCodex(env, opts);
  await page.evaluate(() => {
    window.__sansRechargement = true;
    const nav = (window.__nav = {});
    const mark = (k) => () => { nav[k] ??= performance.now(); };
    document.addEventListener('pointerdown', mark('geste'), true);
    document.addEventListener('click', mark('geste'), true);
    document.addEventListener('astro:before-preparation', mark('depart'));
    const push = history.pushState;
    history.pushState = function (...args) { mark('adresse')(); return push.apply(this, args); };
  });
  const href = await card.getAttribute('href');
  await Promise.all([
    page.waitForURL((u) => u.pathname === href, { waitUntil: 'commit' }),
    opts.touch ? card.tap() : card.click(),
  ]);
  await page.waitForFunction((h) => location.pathname === h && document.querySelector('h1'), href);
  const { kept, nav } = await page.evaluate(() => ({ kept: window.__sansRechargement === true, nav: window.__nav }));
  await context.close();
  const ms = nav?.adresse - nav?.geste;
  return { href, ms: Math.round(ms), start: Math.round(nav?.depart - nav?.geste), kept };
}

test('cartes du codex : navigation immédiate par le ClientRouter, éclat ≤ 200 ms', { timeout: 240_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('390 px au toucher : la fiche s’ouvre sans attendre ni recharger la page', async (st) => {
    const { href, ms, start, kept } = await measureNav(env, { width: 390, height: 844, touch: true });
    st.diagnostic(`toucher → ${href} : ${ms} ms (départ du ClientRouter à ${start} ms), horloge de la page`);
    assert.ok(kept, 'page rechargée : la navigation ne passe pas par le ClientRouter');
    assert.ok(Number.isFinite(ms), `toucher : adresse jamais changée par le ClientRouter`);
    assert.ok(ms < MAX_NAV_MS, `toucher → navigation en ${ms} ms (attendu < ${MAX_NAV_MS})`);
  });

  await t.test('1440 px à la souris : la fiche s’ouvre par le ClientRouter', async (st) => {
    const { href, ms, start, kept } = await measureNav(env, { width: 1440, height: 900, touch: false });
    st.diagnostic(`clic → ${href} : ${ms} ms (départ du ClientRouter à ${start} ms), horloge de la page`);
    assert.ok(kept, 'page rechargée : la navigation ne passe pas par le ClientRouter');
    assert.ok(Number.isFinite(ms), `clic : adresse jamais changée par le ClientRouter`);
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
    // L68 : état attendu sans délai de 2 s au mur (sous charge, la minuterie de 200 ms de la page part en retard) ; la
    // durée de l'éclat est déjà bornée plus haut, lue dans la page (animation-duration).
    await page.waitForFunction(() => !document.querySelector('a.entry-card.is-blooming'));
    assert.equal(new URL(page.url()).pathname, '/bestiaire/', 'la navigation devait être retenue');
    await context.close();
  });
});
