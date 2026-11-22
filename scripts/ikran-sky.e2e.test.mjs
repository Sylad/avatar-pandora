// L34 — « Pandora vivant 3 » : ikrans dans le ciel. Critères tirés de la consigne du lot et du
// prototype validé le 10-10, pas du code :
//  - des silhouettes d'ikrans (4 ailes, longue queue, SVG) traversent les bandeaux Pandora et
//    Bestiaire, et seulement eux, de temps en temps sans rien faire ;
//  - un toucher (ou un clic) sur le bandeau en appelle un ; un glissement du doigt (défilement) non ;
//  - prefers-reduced-motion : aucune traversée, même au toucher ;
//  - pause de l'ambiance : les ikrans en vol se figent, aucun nouveau ;
//  - aucune gêne pour les clics (calque sans pointer-events, sous le texte) ni pour la lecture
//    (au grand écran, jamais sur le texte ; au téléphone, derrière le titre qui garde ≥ 4,5:1) ;
//  - fondu à l'entrée et à la sortie ; animations en transform et opacity seulement.
// Aucun chiffre de performance n'est tiré d'ici (Chromium sans tête). Lit frontend/dist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

async function open(env, path, { width = 1440, height = 900, touch = false, reducedMotion = 'no-preference', init } = {}) {
  const context = await env.browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
  await nextFrames(page);
  return { context, page };
}

const count = (page) => page.evaluate(() => document.querySelectorAll('.section-hero .ikran').length);
const stats = (page) => page.evaluate(() => ({ ...(window.__eywaIkran ?? { spawned: 0, tapped: 0 }) }));
const heroBox = (page) => page.locator('.section-hero').boundingBox();
// Fige chaque ikran à la part `u` de sa traversée.
const freeze = (page, u) => page.evaluate((at) => {
  for (const b of document.querySelectorAll('.section-hero .ikran')) {
    for (const a of b.getAnimations({ subtree: true })) a.pause();
    const fly = b.getAnimations()[0];
    fly.currentTime = fly.effect.getComputedTiming().duration * at;
  }
}, u);

test('ikrans dans le ciel des bandeaux Pandora et Bestiaire (L34)', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('le ciel n’existe que dans les bandeaux Pandora et Bestiaire', async () => {
    const { context, page } = await open(env, '/pandora/');
    for (const [path, has] of [['/pandora/', true], ['/bestiaire/', true], ['/flore/', false], ['/clans/', false], ['/bestiaire/ikran/', false], ['/', false]]) {
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      const sky = await page.evaluate(() => {
        const s = document.querySelector('[data-ikran-sky]');
        return s && { inHero: !!s.closest('.section-hero'), hidden: s.getAttribute('aria-hidden'), pe: getComputedStyle(s).pointerEvents };
      });
      if (!has) { assert.equal(sky, null, `${path} : ciel d’ikrans inattendu`); continue; }
      assert.deepEqual(sky, { inHero: true, hidden: 'true', pe: 'none' }, path);
    }
    await context.close();
  });

  await t.test('sans rien faire, un ikran passe ; c’est un ikran (4 ailes, queue), en fondu', async () => {
    const { context, page } = await open(env, '/pandora/');
    await page.waitForFunction(() => (window.__eywaIkran?.spawned ?? 0) > 0, null, { timeout: 15_000 });
    const s = await stats(page);
    assert.equal(s.tapped, 0, 'passage compté comme appelé');
    const bird = await page.evaluate(() => {
      const b = document.querySelector('.section-hero .ikran');
      const fly = b.getAnimations()[0];
      const frames = fly.effect.getKeyframes();
      const props = [...new Set(b.getAnimations({ subtree: true }).flatMap((a) => a.effect.getKeyframes()
        .flatMap((k) => Object.keys(k).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)))))];
      return {
        wings: b.querySelectorAll('.ikran__wing').length,
        tail: !!b.querySelector('.ikran__tail'),
        svg: !!b.querySelector('svg'),
        first: Number(frames[0].opacity), last: Number(frames.at(-1).opacity),
        props: props.sort(),
        flapping: b.querySelectorAll('.ikran__wing').length === b.getAnimations({ subtree: true }).filter((a) => a.effect.target.classList?.contains('ikran__wing')).length,
      };
    });
    assert.deepEqual(bird, { wings: 4, tail: true, svg: true, first: 0, last: 0, props: ['opacity', 'transform'], flapping: true });
    await context.close();
  });

  await t.test('1440 px : un clic en appelle un, qui vole au-dessus du texte et ne prend pas les clics', async () => {
    const { context, page } = await open(env, '/pandora/');
    const box = await heroBox(page);
    const before = (await stats(page)).tapped;
    await page.mouse.click(box.x + box.width * 0.2, box.y + 60);
    await nextFrames(page);
    assert.equal((await stats(page)).tapped, before + 1, 'le clic n’a appelé aucun ikran');
    const textTop = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.section-hero__content > *')].map((e) => e.getBoundingClientRect().top)));
    for (const u of [0.15, 0.3, 0.5, 0.7, 0.85]) {
      await freeze(page, u);
      const r = await page.evaluate(() => [...document.querySelectorAll('.section-hero .ikran svg')].map((s) => {
        const b = s.getBoundingClientRect();
        return { bottom: b.bottom, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
      }));
      for (const b of r) {
        assert.ok(b.bottom <= textTop, `ikran sur le texte (bas ${b.bottom.toFixed(0)} > texte ${textTop.toFixed(0)})`);
        // Le point sous l'ikran appartient au bandeau, jamais à l'ikran (pointer-events).
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.ikran, .ikran-sky') ? 'ikran' : 'autre', { x: b.cx, y: b.cy });
        if (b.cx > box.x && b.cx < box.x + box.width) assert.equal(hit, 'autre');
      }
    }
    await context.close();
  });

  await t.test('390 px : un toucher en appelle un, un glissement non ; le titre se lit avec l’ikran derrière', async () => {
    const { context, page } = await open(env, '/bestiaire/', { width: 390, height: 844, touch: true });
    const box = await heroBox(page);
    // Glissement du doigt (défilement) : aucun ikran.
    const cdp = await context.newCDPSession(page);
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(box.x + 100, box.y + 60) });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(box.x + 100, box.y + 60 + i * 15) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await nextFrames(page);
    assert.equal((await stats(page)).tapped, 0, 'un glissement a appelé un ikran');
    await page.touchscreen.tap(box.x + 60, box.y + 40);
    await nextFrames(page);
    assert.equal((await stats(page)).tapped, 1, 'le toucher n’a appelé aucun ikran');
    // Ikran figé derrière le titre : le titre garde ≥ 4,5:1 au pire pixel.
    const title = await page.locator('.section-hero__title').boundingBox();
    await page.evaluate(({ y }) => {
      const b = [...document.querySelectorAll('.section-hero .ikran')].at(-1);
      for (const a of b.getAnimations({ subtree: true })) a.pause();
      const fly = b.getAnimations()[0];
      fly.currentTime = fly.effect.getComputedTiming().duration * 0.4;
      // Même trajectoire, abaissée au niveau du titre et pleinement opaque (cas le plus sombre).
      const sky = document.querySelector('[data-ikran-sky]').getBoundingClientRect();
      const svg = b.getBoundingClientRect();
      b.style.translate = `0 ${y - sky.top - (svg.top - sky.top)}px`;
      fly.effect.setKeyframes(fly.effect.getKeyframes().map((k) => ({ ...k, opacity: 1 })));
    }, { y: title.y - 10 });
    await nextFrames(page);
    const under = await page.evaluate(() => {
      const t = document.querySelector('.section-hero__title').getBoundingClientRect();
      const b = [...document.querySelectorAll('.section-hero .ikran svg')].at(-1).getBoundingClientRect();
      return b.top < t.bottom && b.bottom > t.top && b.left < t.right && b.right > t.left;
    });
    assert.ok(under, 'l’ikran n’est pas derrière le titre');
    const { worst, glyphs } = await worstPixelContrast(page, '.section-hero__title');
    assert.ok(glyphs > 50, `glyphes mesurés : ${glyphs}`);
    assert.ok(worst >= 4.5, `titre à ${worst.toFixed(2)}:1 avec l’ikran derrière`);
    await context.close();
  });

  await t.test('mouvement réduit : aucune traversée, même au toucher', async () => {
    const { context, page } = await open(env, '/pandora/', { reducedMotion: 'reduce' });
    const box = await heroBox(page);
    await page.mouse.click(box.x + 200, box.y + 60);
    await page.waitForTimeout(3500); // premier passage spontané : 2,5 s
    assert.equal(await count(page), 0);
    assert.equal((await stats(page)).spawned, 0);
    await context.close();
  });

  await t.test('pause de l’ambiance : les ikrans en vol se figent, aucun nouveau', async () => {
    const { context, page } = await open(env, '/pandora/');
    const box = await heroBox(page);
    await page.mouse.click(box.x + 200, box.y + 60);
    await nextFrames(page);
    await page.locator('#eywa-atmo-toggle').click();
    const states = await page.evaluate(() => [...document.querySelectorAll('.section-hero .ikran')]
      .flatMap((b) => b.getAnimations({ subtree: true }).map((a) => a.playState)));
    assert.ok(states.length >= 5 && states.every((s) => s === 'paused'), `états : ${states.join(',')}`);
    const n = (await stats(page)).spawned;
    await page.mouse.click(box.x + 400, box.y + 80);
    await page.waitForTimeout(3000);
    assert.equal((await stats(page)).spawned, n, 'un ikran est parti pendant la pause');
    // Reprise : ils repartent.
    await page.locator('#eywa-atmo-toggle').click();
    const running = await page.evaluate(() => [...document.querySelectorAll('.section-hero .ikran')]
      .every((b) => b.getAnimations()[0].playState === 'running'));
    assert.ok(running);
    await context.close();
  });
});
