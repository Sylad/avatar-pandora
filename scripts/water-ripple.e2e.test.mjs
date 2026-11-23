// L36 — « Pandora vivant 5 » : eau vivante. Critères tirés de la consigne du lot et du prototype validé le
// 10-10, pas du code :
//  - les pages des Metkayina et de l'océan (fiches dont l'image montre l'eau) ondoient sous le doigt ou la
//    souris, et elles seules ;
//  - un anneau déforme l'image autour du point touché (mesuré sur les pixels : plus visible que le plancton
//    seul) ; le plancton lumineux dérive ; sans rien faire, une goutte tombe de temps en temps ;
//  - le tactile comme la souris : un toucher fait l'anneau (et ne cache pas l'eau sous la visionneuse),
//    la souris en fait au passage ; la visionneuse reste ouvrable (clic, bouton « Agrandir » au doigt et au clavier) ;
//  - prefers-reduced-motion : aucune ondulation, image fixe ; pause de l'ambiance : plus rien ne bouge ;
//  - le bouton posé sur l'image reste lisible (texte ≥ 4,5:1, contour ≥ 3:1 sur l'image) et ≥ 44 px ; son anneau
//    de focus se détache (≥ 3:1) au pire pixel de l'image (WCAG 1.4.11, 2.4.13) ;
//  - « Agrandir » ouvre la visionneuse dans tous les cas : mouvement réduit, sans WebGL, contexte perdu (r1) ;
//  - un seul contexte WebGL par arrivée sur une fiche (premier chargement comme navigation) ;
//  - le pincement-zoom reste permis sur le bandeau (WCAG 1.4.4).
// Aucun chiffre de fluidité n'est tiré d'ici (Chromium sans tête, règle de Sylvain du 21-11). Lit frontend/dist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const WATER = ['/clans/metkayina/', '/films/voie-de-leau/', '/bestiaire/tulkun/', '/bestiaire/akula/', '/personnages/payakan/'];
const DRY = ['/clans/omatikaya/', '/bestiaire/ilu/', '/bestiaire/skimwing/', '/personnages/tsireya/', '/clans/', '/'];

async function open(env, path, { width = 1440, height = 900, touch = false, reducedMotion = 'no-preference', init } = {}) {
  const context = await env.browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
  if (await page.locator('[data-lightbox]').count()) await page.locator('[data-lightbox]').first().scrollIntoViewIfNeeded();
  await nextFrames(page, 3);
  return { context, page };
}
const stats = (page) => page.evaluate(() => ({ ...(window.__eywaWater ?? {}) }));
const banner = (page) => page.locator('[data-lightbox]').first().boundingBox();
const lightboxOpen = (page) => page.evaluate(() => !!document.getElementById('eywa-lightbox')?.open);
const closeLightbox = (page) => page.keyboard.press('Escape');

// Part des pixels d'un disque (rayon r autour de x, y, repère de la page) qui diffèrent de l'image seule
// (canevas masqué) : ce que l'eau change à l'écran.
async function changedShare(page, x, y, r) {
  const clip = { x: Math.round(x - r), y: Math.round(y - r), width: Math.round(2 * r), height: Math.round(2 * r) };
  const live = (await page.screenshot({ clip })).toString('base64');
  await page.evaluate(() => document.querySelector('[data-water-ripple]').style.setProperty('visibility', 'hidden', 'important'));
  const still = (await page.screenshot({ clip })).toString('base64');
  await page.evaluate(() => document.querySelector('[data-water-ripple]').style.removeProperty('visibility'));
  return page.evaluate(async ({ a, b }) => {
    const load = async (b64) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return { w: img.width, d: g.getImageData(0, 0, img.width, img.height).data };
    };
    const A = await load(a), B = await load(b);
    const R = A.w / 2;
    let n = 0, changed = 0;
    for (let i = 0; i < A.d.length; i += 4) {
      const p = i / 4, px = p % A.w, py = Math.floor(p / A.w);
      if (Math.hypot(px - R, py - R) > R) continue;
      n++;
      if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) > 24) changed++;
    }
    return changed / n;
  }, { a: live, b: still });
}

test('eau vivante sur les fiches de l’océan (L36)', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('l’eau ondoie sur les fiches de l’océan, et seulement elles', async () => {
    const { context, page } = await open(env, WATER[0]);
    for (const path of [...WATER, ...DRY]) {
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      const water = await page.evaluate(() => {
        const c = document.querySelector('[data-water-ripple]');
        if (!c) return null;
        const box = c.parentElement;
        return {
          overImage: !!box.querySelector('img') && box.hasAttribute('data-lightbox'),
          hidden: c.getAttribute('aria-hidden'),
          pe: getComputedStyle(c).pointerEvents,
          zoom: !!box.querySelector('button[data-water-zoom]'),
        };
      });
      if (!WATER.includes(path)) { assert.equal(water, null, `${path} : eau inattendue`); continue; }
      assert.deepEqual(water, { overImage: true, hidden: 'true', pe: 'none', zoom: true }, path);
    }
    await context.close();
  });

  await t.test('au toucher : un anneau déforme l’image autour du doigt, la visionneuse ne cache pas l’eau', async () => {
    const { context, page } = await open(env, WATER[0], { width: 390, height: 844, touch: true });
    const s0 = await stats(page);
    if (!s0.gl) { t.skip('WebGL indisponible dans ce Chromium'); await context.close(); return; }
    const b = await banner(page);
    const x = b.x + b.width * 0.45, y = b.y + b.height * 0.5;
    const r = Math.min(b.height / 2 - 2, 64);
    const before = await changedShare(page, x, y, r);
    // L68 : 250 ms de la SCÈNE après le toucher (temps de l'eau, qui avance de 50 ms au plus par image), plus 250 ms au
    // mur : sous charge, la page rendait trop peu d'images et l'anneau mesuré n'avait pas encore grandi.
    const t0 = (await stats(page)).time;
    await page.touchscreen.tap(x, y);
    await page.waitForFunction((t) => window.__eywaWater.time >= t + 250, t0);
    const after = await changedShare(page, x, y, r);
    const s = await stats(page);
    t.diagnostic(`pixels changés autour du doigt : ${(after * 100).toFixed(1)} % (plancton seul : ${(before * 100).toFixed(1)} %)`);
    assert.equal(s.touches, 1, 'toucher non compté');
    assert.ok(s.ripples >= 1);
    assert.equal(await lightboxOpen(page), false, 'la visionneuse a recouvert l’eau');
    assert.ok(after >= 0.25 && after > before * 2,
      `déformation trop faible autour du doigt : ${(after * 100).toFixed(1)} % des pixels changés (plancton seul : ${(before * 100).toFixed(1)} %)`);
    // Le bouton « Agrandir » ouvre la visionneuse au doigt.
    await page.locator('[data-water-zoom]').tap();
    assert.equal(await lightboxOpen(page), true, '« Agrandir » n’ouvre pas la visionneuse');
    await context.close();
  });

  await t.test('à la souris : anneaux au passage, le clic ouvre toujours la visionneuse', async () => {
    const { context, page } = await open(env, '/bestiaire/tulkun/');
    if (!(await stats(page)).gl) { await context.close(); return; }
    const b = await banner(page);
    await page.mouse.move(b.x + 40, b.y + b.height / 2);
    await page.mouse.move(b.x + b.width - 40, b.y + b.height / 2, { steps: 12 });
    const s = await stats(page);
    assert.ok(s.ripples >= 4, `anneaux au passage : ${s.ripples}`);
    assert.equal(s.touches, 0);
    assert.equal(await lightboxOpen(page), false, 'un simple passage a ouvert la visionneuse');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    assert.equal(await lightboxOpen(page), true, 'le clic n’ouvre plus la visionneuse');
    await closeLightbox(page);
    // Au clavier : le bouton est atteignable et ouvre la visionneuse.
    await page.locator('[data-water-zoom]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await lightboxOpen(page), true, '« Agrandir » au clavier');
    await context.close();
  });

  await t.test('sans rien faire, une goutte tombe et le plancton dérive', async () => {
    const { context, page } = await open(env, '/films/voie-de-leau/');
    if (!(await stats(page)).gl) { await context.close(); return; }
    // L68 : la première goutte tombe à 1,8 s du temps de l'eau (FIRST_DROP_MS), qui avance de 50 ms au plus par image ;
    // sous charge (peu d'images), 15 s au mur n'y suffisaient pas. On attend la goutte (délai du test) et on vérifie
    // qu'elle est tombée sans geste, au temps de la scène prévu.
    await page.waitForFunction(() => (window.__eywaWater?.drops ?? 0) > 0);
    const s1 = await stats(page);
    assert.equal(s1.touches, 0, 'goutte attendue sans geste');
    t.diagnostic(`première goutte vue à ${Math.round(s1.time)} ms du temps de l’eau`);
    const f0 = s1.frames;
    await page.waitForFunction((t) => window.__eywaWater.time >= t + 600, s1.time, { timeout: 60_000 }).catch(() => {});
    assert.ok((await stats(page)).frames > f0, 'le plancton ne bouge pas');
    await context.close();
  });

  await t.test('mouvement réduit : aucune ondulation, image fixe ; le toucher ouvre la visionneuse', async () => {
    const { context, page } = await open(env, WATER[0], { width: 390, height: 844, touch: true, reducedMotion: 'reduce' });
    const b = await banner(page);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(400);
    const s = await stats(page);
    assert.equal(s.gl, null, 'un contexte WebGL a été créé en mouvement réduit');
    assert.equal(s.ripples, 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-water-ripple]')).display), 'none');
    assert.equal(await lightboxOpen(page), true, 'le toucher n’ouvre plus la visionneuse');
    await closeLightbox(page);
    const shots = [];
    for (let i = 0; i < 2; i++) { shots.push(await page.screenshot({ clip: b })); await page.waitForTimeout(700); }
    assert.ok(shots[0].equals(shots[1]), 'le bandeau bouge en mouvement réduit');
    // « Agrandir » au doigt, puis au clavier : la visionneuse s'ouvre aussi sans scène WebGL.
    await page.locator('[data-water-zoom]').tap();
    assert.equal(await lightboxOpen(page), true, '« Agrandir » au doigt en mouvement réduit');
    await closeLightbox(page);
    await page.locator('[data-water-zoom]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await lightboxOpen(page), true, '« Agrandir » au clavier en mouvement réduit');
    await closeLightbox(page);
    await context.close();
  });

  await t.test('mouvement réduit à la souris : le clic sur « Agrandir » ouvre la visionneuse', async () => {
    const { context, page } = await open(env, '/bestiaire/tulkun/', { reducedMotion: 'reduce' });
    await page.locator('[data-water-zoom]').click();
    assert.equal(await lightboxOpen(page), true, '« Agrandir » au clic en mouvement réduit');
    await context.close();
  });

  await t.test('contexte WebGL perdu : repli sur l’image fixe, « Agrandir » et le toucher ouvrent la visionneuse', async () => {
    const { context, page } = await open(env, WATER[0], { width: 390, height: 844, touch: true });
    if (!(await stats(page)).gl) { await context.close(); return; }
    await page.evaluate(() => {
      const c = document.querySelector('[data-water-ripple]');
      (c.getContext('webgl2') ?? c.getContext('webgl')).getExtension('WEBGL_lose_context').loseContext();
    });
    await page.waitForFunction(() => window.__eywaWater?.gl === null);
    assert.equal(await page.evaluate(() => document.querySelector('[data-water-ripple]').classList.contains('is-live')), false,
      'le canevas perdu reste affiché');
    await page.locator('[data-water-zoom]').tap();
    assert.equal(await lightboxOpen(page), true, '« Agrandir » après la perte du contexte');
    await closeLightbox(page);
    const n = (await stats(page)).ripples;
    const b = await banner(page);
    await page.touchscreen.tap(b.x + b.width / 3, b.y + b.height / 2);
    await page.waitForTimeout(200);
    assert.equal((await stats(page)).ripples, n, 'un anneau sans contexte');
    assert.equal(await lightboxOpen(page), true, 'le toucher n’ouvre pas la visionneuse après la perte du contexte');
    await context.close();
  });

  await t.test('un seul contexte WebGL par arrivée (premier chargement et navigation)', async () => {
    // Compte les getContext demandés pour le canevas de l'eau (webgl2 obtenu = un seul appel par montage).
    const init = () => {
      const orig = HTMLCanvasElement.prototype.getContext;
      window.__waterGetContext = 0;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (this.hasAttribute('data-water-ripple') && /webgl/.test(type)) window.__waterGetContext++;
        return orig.call(this, type, ...rest);
      };
    };
    const { context, page } = await open(env, WATER[0], { init });
    if (!(await stats(page)).gl) { await context.close(); return; }
    await nextFrames(page, 3);
    const gl = (await stats(page)).gl;
    const perMount = gl === 'webgl2' ? 1 : 2; // repli WebGL 1 : webgl2 refusé puis webgl
    assert.equal(await page.evaluate(() => window.__waterGetContext), perMount, 'premier chargement');
    await page.evaluate(() => { window.__waterGetContext = 0; });
    await page.locator('a[href="/clans/"]').first().click();
    await page.waitForURL('**/clans/');
    await page.locator('a[href="/clans/metkayina/"]').first().click();
    await page.waitForURL('**/clans/metkayina/');
    await page.waitForFunction(() => !!document.querySelector('[data-water-ripple].is-live'));
    await nextFrames(page, 3);
    assert.equal(await page.evaluate(() => window.__waterGetContext), perMount, 'après une navigation');
    await context.close();
  });

  await t.test('le pincement-zoom reste permis sur le bandeau (WCAG 1.4.4)', async () => {
    const { context, page } = await open(env, WATER[0], { width: 390, height: 844, touch: true });
    const ta = await page.evaluate(() => getComputedStyle(document.querySelector('[data-water-ripple]').parentElement).touchAction);
    assert.match(ta, /pinch-zoom/, `touch-action du bandeau : ${ta}`);
    assert.match(ta, /pan-y/, `touch-action du bandeau : ${ta}`);
    await context.close();
  });

  await t.test('pause de l’ambiance : l’eau se fige, aucun anneau, le toucher ouvre la visionneuse', async () => {
    const { context, page } = await open(env, WATER[0], { width: 390, height: 844, touch: true });
    if (!(await stats(page)).gl) { await context.close(); return; }
    await page.locator('#eywa-atmo-toggle').click();
    await nextFrames(page, 3);
    const s0 = await stats(page);
    const b = await banner(page);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(600);
    const s1 = await stats(page);
    assert.equal(s1.ripples, s0.ripples, 'un anneau pendant la pause');
    assert.equal(s1.frames, s0.frames, 'l’eau bouge pendant la pause');
    assert.equal(await lightboxOpen(page), true);
    await closeLightbox(page);
    // Reprise : l'eau répond de nouveau.
    await page.locator('#eywa-atmo-toggle').click();
    await page.touchscreen.tap(b.x + b.width / 3, b.y + b.height / 2);
    assert.ok((await stats(page)).ripples > s1.ripples, 'l’eau ne répond plus après la reprise');
    await context.close();
  });

  await t.test('après une navigation (ClientRouter), l’eau répond toujours', async () => {
    const { context, page } = await open(env, '/clans/', { width: 1440, height: 900 });
    await page.locator('a[href="/clans/metkayina/"]').first().click();
    await page.waitForURL('**/clans/metkayina/');
    await page.waitForFunction(() => !!document.querySelector('[data-water-ripple]'));
    await page.locator('[data-lightbox]').first().scrollIntoViewIfNeeded();
    await nextFrames(page, 3);
    if (!(await stats(page)).gl) { await context.close(); return; }
    const n = (await stats(page)).ripples;
    const b = await banner(page);
    await page.mouse.move(b.x + 60, b.y + 60);
    await page.mouse.move(b.x + 300, b.y + 120, { steps: 6 });
    assert.ok((await stats(page)).ripples > n);
    await context.close();
  });

  await t.test('« Agrandir » : ≥ 44 px, texte ≥ 4,5:1 et contour ≥ 3:1 sur l’image, à 1440 et 390 px', async () => {
    for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]]) {
      for (const path of WATER) {
        const { context, page } = await open(env, path, { width, height, touch, reducedMotion: 'reduce' });
        const zoom = page.locator('[data-water-zoom]');
        const z = await zoom.boundingBox();
        const b = await banner(page);
        assert.ok(z.width >= 44 && z.height >= 44, `${path} ${width} : ${z.width}×${z.height}`);
        assert.ok(z.x >= b.x && z.y >= b.y && z.x + z.width <= b.x + b.width && z.y + z.height <= b.y + b.height, `${path} ${width} : bouton hors du bandeau`);
        if (await zoom.locator('span').isVisible()) {
          const { worst, glyphs } = await worstPixelContrast(page, '[data-water-zoom] span');
          assert.ok(glyphs > 20 && worst >= 4.5, `${path} ${width} : texte à ${worst.toFixed(2)}:1`);
        }
        // Contour : chaque pixel de l'image autour du bouton se distingue (≥ 3:1) de son liseré ou de son fond.
        const ratio = await page.evaluate(async (zb) => {
          const el = document.querySelector('[data-water-zoom]');
          const cs = getComputedStyle(el);
          const parse = (c) => c.match(/[\d.]+/g).map(Number);
          const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
          const C = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          // Image seule (sans eau ni bouton), lue dans un canevas aux coordonnées du bouton.
          const img = el.parentElement.querySelector('img');
          const ib = img.getBoundingClientRect();
          const c = document.createElement('canvas'); c.width = Math.round(ib.width); c.height = Math.round(ib.height);
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
          const x0 = Math.round(zb.x - ib.left) - 3, y0 = Math.round(zb.y - ib.top) - 3;
          const w = Math.round(zb.width) + 6, h = Math.round(zb.height) + 6;
          const d = g.getImageData(Math.max(0, x0), Math.max(0, y0), Math.min(w, c.width - x0), Math.min(h, c.height - y0)).data;
          const border = parse(cs.borderTopColor), fill = parse(cs.backgroundColor);
          let worst = Infinity;
          for (let i = 0; i < d.length; i += 4) {
            const px = [d[i], d[i + 1], d[i + 2]];
            worst = Math.min(worst, Math.max(C(over(border, px), px), C(over(fill, px), px)));
          }
          return worst;
        }, z);
        assert.ok(ratio >= 3, `${path} ${width} : contour à ${ratio.toFixed(2)}:1`);
        // Anneau de focus : au clavier, il est bordé des deux côtés par le halo sombre, qui le sépare de
        // l'image ; au pire pixel de l'image sous le halo, anneau contre halo ≥ 3:1.
        await page.keyboard.press('Tab');
        await zoom.focus();
        const ring = await page.evaluate(() => {
          const el = document.querySelector('[data-water-zoom]');
          const cs = getComputedStyle(el);
          const spread = Number((cs.boxShadow.match(/0px 0px 0px ([\d.]+)px/) ?? [])[1] ?? 0);
          return {
            visible: el.matches(':focus-visible'), style: cs.outlineStyle, outline: cs.outlineColor, shadow: cs.boxShadow,
            reach: parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth), spread,
          };
        });
        assert.ok(ring.visible && ring.style === 'solid', `${path} ${width} : pas d’anneau au clavier`);
        assert.ok(ring.spread >= ring.reach + 2, `${path} ${width} : halo (${ring.spread} px) qui ne déborde pas l’anneau (${ring.reach} px)`);
        const ringRatio = await page.evaluate(async ({ zb, ring }) => {
          const parse = (c) => c.match(/[\d.]+/g).map(Number);
          const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
          const C = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const img = document.querySelector('[data-water-zoom]').parentElement.querySelector('img');
          const ib = img.getBoundingClientRect();
          const c = document.createElement('canvas'); c.width = Math.round(ib.width); c.height = Math.round(ib.height);
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
          const m = ring.spread;
          const x0 = Math.max(0, Math.round(zb.x - ib.left - m)), y0 = Math.max(0, Math.round(zb.y - ib.top - m));
          const d = g.getImageData(x0, y0, Math.min(Math.round(zb.width + 2 * m), c.width - x0), Math.min(Math.round(zb.height + 2 * m), c.height - y0)).data;
          const outline = parse(ring.outline), halo = parse(ring.shadow.match(/rgba?\([^)]*\)/)[0]);
          let worst = Infinity;
          for (let i = 0; i < d.length; i += 4) worst = Math.min(worst, C(outline, over(halo, [d[i], d[i + 1], d[i + 2]])));
          return worst;
        }, { zb: z, ring });
        assert.ok(ringRatio >= 3, `${path} ${width} : anneau de focus à ${ringRatio.toFixed(2)}:1 contre son halo`);
        await context.close();
      }
    }
  });
});
