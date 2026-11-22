// L33 — « Pandora vivant 2 » : cartes du codex qui s'éveillent. Critères tirés de la consigne du lot
// (et du prototype validé le 10-10), pas du code :
//  - au repos, chaque carte DORT : image dans la pénombre, pas de liseré qui pulse, pas de spore ;
//  - elle s'éveille au SURVOL (souris), au CLAVIER (Tab, focus visible) et au TOUCHER :
//    liseré qui pulse, image qui s'éclaire, spores qui montent ;
//  - une seule carte éveillée au toucher à la fois, et elle se rendort après le toucher ;
//  - prefers-reduced-motion : aucune animation ni déplacement, état éveillé lisible (image
//    éclairée, titre cyan, spores visibles et immobiles) ;
//  - pause de l'ambiance (WCAG 2.2.2) : le pouls et les spores se figent ;
//  - le titre se lit (≥ 4,5:1 au pire pixel) endormi comme éveillé, à 1440 et 390 px.
// Lit frontend/dist (lancer le build avant) ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const PAGE = '/bestiaire/';

async function open(env, { width, height, touch = false, reducedMotion = 'no-preference' }) {
  const context = await env.browser.newContext({
    viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion,
  });
  const page = await context.newPage();
  await page.goto(`${env.base}${PAGE}`, { waitUntil: 'load' });
  await nextFrames(page);
  return { context, page };
}

// État lisible d'une carte : luminosité de l'image, animations du liseré et des spores, titre.
function state(page, index) {
  return page.evaluate((i) => {
    const card = document.querySelectorAll('a.entry-card')[i];
    const media = card.querySelector('.entry-card__img, .entry-card__fallback');
    const bright = Number((getComputedStyle(media).filter.match(/brightness\(([\d.]+)\)/) || [])[1] ?? 1);
    const spores = [...card.querySelectorAll('.entry-card__spore')].map((s) => getComputedStyle(s));
    const cs = getComputedStyle(card);
    return {
      bright,
      rim: cs.animationName,
      rimState: cs.animationPlayState,
      transform: cs.transform,
      transition: cs.transitionDuration,
      spores: spores.length,
      sporeAnim: spores.filter((s) => s.animationName === 'entry-card-spore').length,
      sporeState: spores.map((s) => s.animationPlayState),
      sporeVisible: spores.filter((s) => Number(s.opacity) > 0.5).length,
      title: getComputedStyle(card.querySelector('.entry-card__title')).color,
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
      awake: card.classList.contains('is-awake'),
    };
  }, index);
}

const CYAN = 'rgb(95, 255, 230)';

test('cartes du codex : endormies au repos, éveillées au survol, au clavier et au toucher (L33)', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('1440 px : au repos la carte dort, au survol elle s’éveille', async () => {
    const { context, page } = await open(env, { width: 1440, height: 900 });
    await page.mouse.move(2, 2);
    const asleep = await state(page, 0);
    assert.ok(asleep.spores >= 8, `spores absentes de la carte (${asleep.spores})`);
    assert.ok(asleep.bright <= 0.6, `image non endormie au repos : brightness ${asleep.bright}`);
    assert.equal(asleep.rim, 'none', 'le liseré pulse déjà au repos');
    assert.equal(asleep.sporeAnim, 0, 'des spores montent au repos');
    assert.notEqual(asleep.title, CYAN, 'titre déjà éveillé au repos');

    const card = page.locator('a.entry-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(900); // fin des transitions (700 ms)
    const lit = await state(page, 0);
    assert.ok(lit.bright >= 1, `image non éclairée au survol : brightness ${lit.bright}`);
    assert.equal(lit.rim, 'entry-card-rim', 'le liseré ne pulse pas au survol');
    assert.equal(lit.sporeAnim, lit.spores, 'les spores ne montent pas au survol');
    assert.equal(lit.title, CYAN, 'titre non éveillé au survol');
    // Les autres cartes dorment toujours.
    const other = await state(page, 1);
    assert.equal(other.rim, 'none', 'une carte non survolée s’est éveillée');
    await context.close();
  });

  await t.test('1440 px : au clavier, la carte atteinte s’éveille avec un focus visible', async () => {
    const { context, page } = await open(env, { width: 1440, height: 900 });
    await page.mouse.move(2, 2);
    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement?.matches('a.entry-card') ?? false);
    }
    assert.ok(reached, 'aucune carte atteinte à la touche Tab');
    const idx = await page.evaluate(() => [...document.querySelectorAll('a.entry-card')].indexOf(document.activeElement));
    await page.waitForTimeout(900);
    const s = await state(page, idx);
    assert.match(s.outline, /^solid [2-9]/, `focus clavier peu visible : ${s.outline}`);
    assert.ok(s.bright >= 1, `image non éclairée au clavier : brightness ${s.bright}`);
    assert.equal(s.rim, 'entry-card-rim', 'le liseré ne pulse pas au clavier');
    assert.equal(s.sporeAnim, s.spores, 'les spores ne montent pas au clavier');
    await context.close();
  });

  await t.test('390 px : le toucher éveille une seule carte, qui se rendort après', async () => {
    const { context, page } = await open(env, { width: 390, height: 844, touch: true });
    const cards = page.locator('a.entry-card');
    await cards.nth(0).scrollIntoViewIfNeeded();
    const down = (i) => cards.nth(i).dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, bubbles: true });
    await down(0);
    await page.waitForTimeout(900);
    const first = await state(page, 0);
    assert.ok(first.awake, 'carte non éveillée au toucher');
    assert.ok(first.bright >= 1, `image non éclairée au toucher : brightness ${first.bright}`);
    assert.equal(first.rim, 'entry-card-rim');
    assert.equal(first.sporeAnim, first.spores);
    await down(1);
    assert.equal((await state(page, 0)).awake, false, 'deux cartes éveillées à la fois');
    assert.ok((await state(page, 1)).awake);
    await cards.nth(1).dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
    await page.waitForFunction(() => !document.querySelector('a.entry-card.is-awake'), null, { timeout: 4000 });
    await context.close();
  });

  await t.test('mouvement réduit : rien ne bouge, l’éveil reste lisible', async () => {
    const { context, page } = await open(env, { width: 1440, height: 900, reducedMotion: 'reduce' });
    const card = page.locator('a.entry-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await nextFrames(page);
    const s = await state(page, 0);
    assert.equal(s.rim, 'none', 'le liseré pulse en mouvement réduit');
    assert.equal(s.sporeAnim, 0, 'des spores bougent en mouvement réduit');
    assert.equal(s.transform, 'none', `la carte se déplace en mouvement réduit (${s.transform})`);
    assert.match(s.transition, /^0s/, `transition en mouvement réduit (${s.transition})`);
    assert.ok(s.bright >= 1, `éveil illisible : image non éclairée (${s.bright})`);
    assert.equal(s.title, CYAN, 'éveil illisible : titre non éveillé');
    assert.equal(s.sporeVisible, s.spores, 'spores invisibles en mouvement réduit');
    await context.close();
  });

  await t.test('pause de l’ambiance : le pouls et les spores se figent', async () => {
    const { context, page } = await open(env, { width: 1440, height: 900 });
    await page.evaluate(() => document.documentElement.classList.add('eywa-atmo-paused'));
    const card = page.locator('a.entry-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await nextFrames(page);
    const s = await state(page, 0);
    assert.equal(s.rimState, 'paused');
    assert.ok(s.sporeState.every((v) => v === 'paused'), 'spores non figées');
    await context.close();
  });

  for (const width of [1440, 390]) {
    await t.test(`${width} px : titre ≥ 4,5:1 au pire pixel, endormi et éveillé`, async () => {
      const { context, page } = await open(env, { width, height: width > 1000 ? 900 : 844 });
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      const sel = 'a.entry-card >> nth=0 >> .entry-card__title';
      const card = page.locator('a.entry-card').first();
      await card.scrollIntoViewIfNeeded();
      await page.mouse.move(1, 1);
      await page.waitForTimeout(600);
      const asleep = await worstPixelContrast(page, sel);
      await card.evaluate((c) => c.classList.add('is-awake'));
      await page.waitForTimeout(900);
      const lit = await worstPixelContrast(page, sel);
      for (const [name, r] of [['endormi', asleep], ['éveillé', lit]]) {
        assert.ok(r.glyphs > 20, `${name} : glyphes non détectés`);
        assert.ok(r.worst >= 4.5, `titre ${name} à ${r.worst.toFixed(2)}:1`);
      }
      await context.close();
    });
  }
});
