// L35 — « Pandora vivant 4 » : jour et nuit. Critères tirés de la consigne du lot et du prototype
// validé le 10-10 (section 04), pas du code :
//  - l'ambiance suit l'heure du visiteur : à midi, plein jour (forêt du bandeau non assombrie,
//    aucun point bioluminescent) ; à 23 h, nuit (forêt assombrie qui s'illumine, points visibles) ;
//    le ciel est posé AVANT la première image (aucun éclair de jour la nuit) ;
//  - réglage manuel jour / nuit / auto, au clavier comme au doigt, mémorisé d'une page à l'autre
//    (navigation du site et rechargement) ;
//  - prefers-reduced-motion : rien ne palpite, le réglage reste offert ; pause de l'ambiance :
//    les points se figent ;
//  - contraste du texte (WCAG 2.2 AA au pire pixel : 4,5:1, 3:1 pour le grand titre ≥ 24 px) dans
//    les deux ambiances, aux deux largeurs ;
//  - les calques ne prennent aucun clic et restent sous le texte du bandeau.
// Aucun chiffre de performance n'est tiré d'ici (Chromium sans tête). Lit frontend/dist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const KEY = 'eywa.sky-v1';
const TZ = 'Europe/Paris';
const at = (hhmm) => new Date(`2026-11-22T${hhmm}:00+01:00`);

async function open(env, path, { width = 1440, height = 900, time, mode, reducedMotion = 'no-preference', touch = false } = {}) {
  const context = await env.browser.newContext({ viewport: { width, height }, timezoneId: TZ, reducedMotion, hasTouch: touch, isMobile: touch });
  // Ciel relevé au tout premier DOMContentLoaded : avant la première image.
  await context.addInitScript(([k, m]) => {
    if (m && !sessionStorage.getItem('sky-set')) { localStorage.setItem(k, m); sessionStorage.setItem('sky-set', '1'); }
    document.addEventListener('DOMContentLoaded', () => {
      const r = document.documentElement;
      window.__skyAtDcl = { mode: r.dataset.skyMode, lit: 'skyLit' in r.dataset, n: r.style.getPropertyValue('--sky-n') };
    }, { once: true });
  }, [KEY, mode ?? null]);
  const page = await context.newPage();
  if (time) await page.clock.setFixedTime(time);
  await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
  await nextFrames(page);
  return { context, page };
}

const sky = (page) => page.evaluate(() => {
  const r = document.documentElement;
  const v = (k) => Number(r.style.getPropertyValue(`--sky-${k}`));
  const hero = document.querySelector('.section-hero');
  const spots = document.querySelector('.section-hero [data-sky-spots], .landing-floor');
  const shade = hero?.querySelector('.sky__shade');
  return {
    mode: r.dataset.skyMode,
    lit: 'skyLit' in r.dataset,
    n: v('n'),
    shade: shade ? Number(getComputedStyle(shade).opacity) : null,
    spots: spots ? { opacity: Number(getComputedStyle(spots).opacity), visible: getComputedStyle(spots).visibility === 'visible' } : null,
    dcl: window.__skyAtDcl,
  };
});

test('jour et nuit (L35)', { timeout: 600_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('l’ambiance suit l’heure : plein jour à midi, nuit à 23 h, la nuit tombe le soir — posée avant la première image', async () => {
    const seen = {};
    for (const [hhmm, path] of [['13:00', '/flore/'], ['23:00', '/flore/'], ['19:30', '/flore/'], ['23:00', '/']]) {
      const { context, page } = await open(env, path, { time: at(hhmm) });
      seen[`${hhmm} ${path}`] = await sky(page);
      await context.close();
    }
    const midi = seen['13:00 /flore/'];
    assert.deepEqual({ mode: midi.mode, lit: midi.lit, n: midi.n, shade: midi.shade, spots: midi.spots.visible }, { mode: 'auto', lit: false, n: 0, shade: 0, spots: false });
    const nuit = seen['23:00 /flore/'];
    assert.deepEqual({ mode: nuit.mode, lit: nuit.lit, n: nuit.n, spots: nuit.spots }, { mode: 'auto', lit: true, n: 1, spots: { opacity: 1, visible: true } });
    assert.ok(nuit.shade > 0.6, `forêt non assombrie la nuit : ${nuit.shade}`);
    const soir = seen['19:30 /flore/'];
    assert.ok(soir.n > 0.3 && soir.n < 0.7, `19 h 30 : n = ${soir.n}`);
    // Avant la première image : déjà la nuit au DOMContentLoaded.
    assert.deepEqual(nuit.dcl, { mode: 'auto', lit: true, n: '1.000' });
    const accueil = seen['23:00 /'];
    assert.ok(accueil.lit && accueil.spots.visible && accueil.spots.opacity === 1, `accueil la nuit : ${JSON.stringify(accueil)}`);
  });

  await t.test('réglage au clavier : Nuit à midi, mémorisé de page en page et au rechargement, puis retour à « selon ton heure »', async () => {
    const { context, page } = await open(env, '/flore/', { time: at('13:00') });
    const btn = page.locator('#eywa-sky-toggle');
    assert.equal(await btn.getAttribute('aria-label'), 'Jour et nuit : selon ton heure');
    await btn.focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('#eywa-sky-panel');
    await panel.waitFor({ state: 'visible' });
    assert.equal(await btn.getAttribute('aria-expanded'), 'true');
    assert.match(await panel.innerText(), /13 h 00 chez toi : plein jour/);
    // Le focus est sur le choix courant ; les flèches changent de choix (radios natifs).
    assert.equal(await page.evaluate(() => document.activeElement?.value), 'auto');
    await page.keyboard.press('ArrowDown'); // jour
    await page.keyboard.press('ArrowDown'); // nuit
    let s = await sky(page);
    assert.deepEqual({ mode: s.mode, lit: s.lit, n: s.n }, { mode: 'nuit', lit: true, n: 1 });
    assert.equal(await btn.getAttribute('aria-label'), 'Jour et nuit : nuit');
    await page.keyboard.press('Escape');
    assert.equal(await panel.isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'eywa-sky-toggle', 'focus non rendu au bouton');

    // Navigation du site (ClientRouter) : la nuit reste.
    await page.locator('aside a[href="/pandora/"]').first().click();
    await page.waitForURL('**/pandora/');
    await nextFrames(page);
    s = await sky(page);
    assert.deepEqual({ mode: s.mode, lit: s.lit, n: s.n }, { mode: 'nuit', lit: true, n: 1 }, 'perdu après navigation');
    assert.ok(s.shade > 0.6);
    await page.reload({ waitUntil: 'load' });
    s = await sky(page);
    assert.deepEqual({ mode: s.mode, lit: s.lit }, { mode: 'nuit', lit: true }, 'perdu au rechargement');

    // Retour à l'heure du visiteur (midi) : plein jour.
    await btn.click();
    await page.locator('#eywa-sky-panel label', { hasText: 'Selon ton heure' }).click();
    s = await sky(page);
    assert.deepEqual({ mode: s.mode, lit: s.lit, n: s.n }, { mode: 'auto', lit: false, n: 0 });
    // Un clic ailleurs referme le panneau.
    await page.mouse.click(700, 600);
    assert.equal(await panel.isHidden(), true);
    await context.close();
  });

  await t.test('au doigt (390 px) : Jour à 23 h ; le bouton et son panneau tiennent dans l’écran, cible ≥ 44 px', async () => {
    const { context, page } = await open(env, '/', { width: 390, height: 844, time: at('23:00'), touch: true });
    const btn = page.locator('#eywa-sky-toggle');
    await btn.tap();
    const panel = page.locator('#eywa-sky-panel');
    await panel.waitFor({ state: 'visible' });
    const box = await panel.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, JSON.stringify(box));
    const choice = page.locator('#eywa-sky-panel label', { hasText: /^\s*Jour\s*$/ });
    assert.ok((await choice.boundingBox()).height >= 44);
    await choice.tap();
    const s = await sky(page);
    assert.deepEqual({ mode: s.mode, lit: s.lit, n: s.n }, { mode: 'jour', lit: false, n: 0 });
    await context.close();
  });

  await t.test('mouvement réduit : rien ne palpite, le réglage reste ; pause : les points se figent', async () => {
    const running = (page) => page.evaluate(() => [...document.querySelectorAll('[data-sky-spots] *, .sky__glow')]
      .flatMap((el) => el.getAnimations()).filter((a) => a.playState === 'running').length);
    let { context, page } = await open(env, '/flore/', { mode: 'nuit', reducedMotion: 'reduce' });
    assert.equal(await running(page), 0, 'animation en mouvement réduit');
    assert.equal(await page.locator('#eywa-sky-toggle').isVisible(), true, 'réglage absent en mouvement réduit');
    assert.equal((await sky(page)).lit, true);
    await context.close();

    ({ context, page } = await open(env, '/flore/', { mode: 'nuit' }));
    assert.ok(await running(page) > 0, 'les points ne palpitent pas');
    await page.locator('#eywa-atmo-toggle').click();
    assert.equal(await running(page), 0, 'points non figés par la pause');
    await context.close();
  });

  await t.test('les calques du ciel ne prennent aucun clic et restent sous le texte du bandeau', async () => {
    const { context, page } = await open(env, '/flore/', { mode: 'nuit' });
    const r = await page.evaluate(() => {
      const hero = document.querySelector('.section-hero');
      const layer = hero.querySelector('.sky');
      const kids = [...hero.children];
      const title = hero.querySelector('.section-hero__title').getBoundingClientRect();
      const hit = document.elementFromPoint(title.left + 10, title.top + title.height / 2);
      return {
        pe: getComputedStyle(layer).pointerEvents,
        hidden: layer.getAttribute('aria-hidden'),
        beforeVeil: kids.indexOf(layer) < kids.indexOf(hero.querySelector('.section-hero__veil')),
        hitTitle: !!hit?.closest('.section-hero__content'),
      };
    });
    assert.deepEqual(r, { pe: 'none', hidden: 'true', beforeVeil: true, hitTitle: true });
    await context.close();
  });

  await t.test('contraste du texte AA au pire pixel (4,5:1, grand titre 3:1), de jour comme de nuit, à 1440 et 390 px', async () => {
    const failures = [];
    const report = [];
    const cases = [
      ['/flore/', ['.section-hero__roman', '.section-hero__title', '.section-hero__tagline']],
      ['/pandora/', ['.section-hero__roman', '.section-hero__title', '.section-hero__tagline']],
      ['/', ['.landing-tagline', '.landing-eywa-def']],
    ];
    // Crépuscule : 19 h 20 en mode auto, lueur orange et rose à son maximum (n ≈ 0,45).
    for (const [mode, sky] of [['jour', { mode: 'jour' }], ['crépuscule', { time: at('19:20') }], ['nuit', { mode: 'nuit' }]]) {
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        // Mouvement réduit : image fixe (pas de travelling ni de particules qui bougent entre les deux captures).
        const { context, page } = await open(env, '/', { width, height, ...sky, reducedMotion: 'reduce' });
        if (mode === 'crépuscule') {
          const dusk = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--sky-dusk')));
          assert.ok(dusk > 0.9, `crépuscule non atteint : ${dusk}`);
        }
        await page.evaluate(() => document.fonts.ready);
        for (const [path, sels] of cases) {
          await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
          await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
          await nextFrames(page);
          for (const sel of sels) {
            const { worst, glyphs } = await worstPixelContrast(page, sel);
            // Grand texte (WCAG 1.4.3) : 24 px et plus → 3:1 ; sinon 4,5:1.
            const px = await page.locator(sel).first().evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
            const min = px >= 24 ? 3 : 4.5;
            report.push(`${mode} ${path} ${sel} @${width} : ${worst.toFixed(2)}:1 (${glyphs} px, seuil ${min})`);
            assert.ok(glyphs > 20, `${mode} ${path} ${sel} @${width} : glyphes non détectés`);
            if (worst < min) failures.push(`${mode} ${path} ${sel} @${width} : ${worst.toFixed(2)}:1 < ${min}`);
          }
        }
        await context.close();
      }
    }
    for (const line of report) t.diagnostic(line);
    assert.deepEqual(failures, []);
  });
});
