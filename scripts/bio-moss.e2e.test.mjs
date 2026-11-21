// L32 — Pandora vivant 1, lumière au toucher : le fond de l'accueil et du codex s'allume sous le
// doigt ou la souris (taches de mousse qui s'étendent puis s'éteignent en 3 à 4,2 s), visible au repos,
// arrêté par la pause de l'ambiance, absent en mouvement réduit, sans travail au défilement, sans
// retarder la page. Revue UX L32 : jamais sous un texte ni sous le menu (≥ 4,5:1 au pire pixel, menu
// du codex compris), visible autour du doigt au téléphone, rien allumé par un glissement du doigt.
// Lit frontend/dist ; skip sans Chromium.
// EYWA_E2E_SHOTS=<dossier> enregistre des captures (repos et mousse allumée) à 1440 et 390 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { nextFrames, setupBrowser, worstPixelContrast } from './lib/e2e-dist.mjs';

const SHOTS = process.env.EYWA_E2E_SHOTS;
const PAGES = ['/', '/clans/omatikaya/'];
const VIEWPORTS = [[1440, 900], [390, 844]];

// Taches allumées, mousse au repos et animations de la mousse encore en cours.
const stats = (page) => page.evaluate(() => {
  const host = document.getElementById('eywa-moss');
  return {
    ...window.__eywaMoss,
    patches: host.querySelectorAll('.eywa-moss__patch').length,
    rest: [...host.querySelectorAll('.eywa-moss__rest')].filter((e) => {
      const r = e.getBoundingClientRect();
      return Number(getComputedStyle(e).opacity) > 0.1 && r.width > 50 && r.right > 0 && r.left < innerWidth;
    }).length,
    hostOpacity: Number(getComputedStyle(host).opacity),
    running: document.getAnimations().filter((a) => host.contains(a.effect?.target) && a.playState === 'running').length,
  };
});
// Différence moyenne de luminosité entre deux captures (0-255), pour voir la mousse s'allumer.
const meanDiff = (page, a, b) => page.evaluate(async ({ a, b }) => {
  const load = async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height).data;
  };
  const [x, y] = [await load(a), await load(b)];
  let sum = 0;
  for (let i = 0; i < x.length; i += 4) sum += (y[i] + y[i + 1] + y[i + 2] - x[i] - x[i + 1] - x[i + 2]) / 3;
  return sum / (x.length / 4);
}, { a: a.toString('base64'), b: b.toString('base64') });
// Allume des taches sur une grille couvrant `box` (événements de pointeur posés sur window :
// un vrai clic sur un lien changerait de page).
const lightGrid = (page, box, step = 60) => page.evaluate(({ box, step }) => {
  for (let y = box.y; y <= box.y + box.height; y += step) {
    for (let x = box.x; x <= box.x + box.width; x += step) {
      window.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerType: 'mouse' }));
    }
  }
}, { box, step });

// Fige chaque tache à pleine intensité (500 ms : étendue à 70 %, intensité maximale). Une animation
// encore en attente de sa première image (machine chargée) n'a pas d'heure : la mettre en pause sans
// heure la figerait à 0 ms, tache invisible. `commit` inscrit l'état dans le style et retire
// l'animation (la mesure de contraste coupe les animations).
const freezeMoss = (page, { commit = false } = {}) => page.evaluate((commit) => {
  const host = document.getElementById('eywa-moss');
  const moss = document.getAnimations().filter((a) => host.contains(a.effect?.target));
  for (const a of moss) {
    a.pause();
    a.currentTime = 500;
    if (commit) { a.commitStyles(); a.cancel(); }
  }
  return moss.length;
}, commit);

async function open(env, path, [width, height], options = {}) {
  const context = await env.browser.newContext({ viewport: { width, height }, hasTouch: width < 500, ...options });
  const page = await context.newPage();
  // Premier chargement : le processus GPU de Chromium met parfois plus d'une minute à démarrer.
  await page.goto(`${env.base}${path}`, { waitUntil: 'load', timeout: 180_000 });
  await page.evaluate(() => document.fonts.ready);
  await nextFrames(page); // première image : le processus GPU de Chromium peut tarder (cf. e2e-dist)
  await page.waitForTimeout(600);
  return { context, page };
}

for (const path of PAGES) {
  for (const vp of VIEWPORTS) {
    const [width, height] = vp;
    test(`${path} @${width}px : la mousse s'allume au toucher puis s'éteint (3 s, 4,2 s au toucher), visible au repos`, { timeout: 300_000 }, async (t) => {
      const env = await setupBrowser(t);
      if (!env) return;
      const { context, page } = await open(env, path, vp);
      const rest = await stats(page);
      assert.ok(rest.rest >= 4, `au repos, la mousse n’est pas invisible (${rest.rest} taches)`);
      assert.ok(rest.hostOpacity > 0.3, 'calque de mousse visible');
      assert.equal(rest.running, 0, 'au repos, aucune animation');
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `moss${path.replace(/\W+/g, '-')}repos-${width}.png`) });
      }

      // Souris au bureau, doigt au téléphone.
      if (width < 500) {
        // Dans les marges, hors des liens (un toucher sur « Explorer le codex » changerait de page).
        await page.touchscreen.tap(40, 90);
        await page.touchscreen.tap(12, height * 0.55);
      } else {
        await page.mouse.move(200, 200);
        for (let i = 1; i <= 8; i++) { await page.mouse.move(200 + i * 110, 200 + i * 50); await page.waitForTimeout(100); }
      }
      await page.waitForTimeout(500);
      const lit = await stats(page);
      assert.ok(lit.patches >= 2, `taches allumées : ${lit.patches}`);
      assert.equal(lit.running, lit.patches, 'chaque tache s’anime');
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `moss${path.replace(/\W+/g, '-')}allumee-${width}.png`) });

      // Éteinte 3 s (souris) ou 4,2 s (toucher, clic) après la dernière tache : plus rien.
      await page.waitForTimeout(width < 500 ? 4250 : 3050);
      // Retrait à la minuterie : sous charge (Chromium sans tête rend à ~1 image/s), elle peut
      // partir un peu après l'heure.
      await page.waitForFunction(() => !document.querySelector('#eywa-moss .eywa-moss__patch'), null, { timeout: 3000 }).catch(() => {});
      const after = await stats(page);
      assert.equal(after.patches, 0, 'toutes les taches sont éteintes et retirées');
      assert.equal(after.running, 0, 'plus aucune animation au repos');
      await context.close();
    });
  }
}

test('la mousse allumée se voit : le fond s’éclaire sous le pointeur (1440 px, marge droite du codex)', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const { context, page } = await open(env, '/clans/omatikaya/', [1440, 900]);
  // Particules arrêtées (pause), puis reprise de la mousse seule : la différence vient d'elle.
  await page.evaluate(() => { window.__eywaAtmo.setPaused(true); document.documentElement.classList.remove('eywa-atmo-paused'); });
  await page.waitForTimeout(400);
  // Marge à droite de la fiche (la bande du menu, à gauche, est protégée : revue UX L32, B1).
  const clip = { x: 1300, y: 150, width: 140, height: 500 };
  const before = await page.screenshot({ clip });
  await lightGrid(page, { x: 1330, y: 200, width: 80, height: 400 }, 100);
  await page.waitForTimeout(450);
  assert.ok((await freezeMoss(page)) >= 4, 'taches allumées à figer');
  const after = await page.screenshot({ clip, animations: 'allow' });
  const gain = await meanDiff(page, before, after);
  t.diagnostic(`éclaircissement moyen sous la mousse allumée : +${gain.toFixed(1)} / 255`);
  assert.ok(gain > 3, `mousse allumée presque invisible (+${gain.toFixed(1)})`);
  await context.close();
});

test('pause de l’ambiance : le pointeur n’allume plus rien, la mousse au repos reste', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const { context, page } = await open(env, '/clans/', [1440, 900]);
  await page.locator('#eywa-atmo-toggle').click();
  await page.waitForTimeout(100);
  const before = await stats(page);
  assert.equal(before.patches, 0, 'la pause éteint les taches allumées');
  for (let i = 0; i < 8; i++) await page.mouse.move(300 + i * 90, 300 + i * 30);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
  const s = await stats(page);
  assert.equal(s.patches, 0);
  assert.equal(s.spawned, before.spawned, 'rien ne s’allume pendant la pause');
  assert.equal(s.running, 0);
  assert.ok(s.rest > 0, 'la mousse au repos reste visible en pause');
  await context.close();
});

test('mouvement réduit : aucune mousse posée, rien ne s’allume', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  for (const path of PAGES) {
    const { context, page } = await open(env, path, [1440, 900], { reducedMotion: 'reduce' });
    assert.equal(await page.locator('#eywa-moss > *').count(), 0, `${path} : mousse posée en mouvement réduit`);
    await page.mouse.move(400, 400);
    await page.mouse.move(700, 500);
    await page.mouse.down();
    await page.mouse.up();
    const s = await stats(page);
    assert.equal(s.spawned, 0);
    assert.equal(s.patches, 0);
    await context.close();
  }
});

test('défilement : la mousse ne travaille pas ; coût mesuré ; la page n’attend pas la mousse', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  // Premier chargement du navigateur : la page et son fil principal ne doivent pas attendre la
  // mousse (un canvas 2D les faisait attendre 85 s, le temps du démarrage du processus GPU).
  let t0 = Date.now();
  await page.goto(`${env.base}/clans/omatikaya/`, { waitUntil: 'load', timeout: 180_000 });
  await page.evaluate(() => 1);
  const ready = Date.now() - t0;
  t.diagnostic(`page prête (load + fil principal libre) : ${ready} ms`);
  assert.ok(ready < 15_000, `page retardée : ${ready} ms`);
  assert.ok((await stats(page)).rest > 0, 'mousse au repos posée');
  await nextFrames(page);

  // Défilement à la molette, pointeur immobile (posé avant, sa tache éteinte) : rien ne s'allume,
  // aucune animation de la mousse.
  await page.mouse.move(700, 450);
  await page.waitForTimeout(3300);
  const before = await stats(page);
  assert.equal(before.running, 0);
  await page.evaluate(() => {
    window.__longTasks = 0;
    new PerformanceObserver((l) => { window.__longTasks += l.getEntries().length; }).observe({ type: 'longtask' });
  });
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.scrollY) > 1000, 'la page a défilé');
  const s1 = await stats(page);
  assert.equal(s1.spawned, before.spawned, 'défiler a allumé de la mousse');
  assert.equal(s1.running, 0, 'défiler a animé la mousse');

  // Pire cas : le nombre maximal de taches allumées en même temps, pendant un défilement.
  await lightGrid(page, { x: 40, y: 40, width: 1360, height: 820 }, 150);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
  const s2 = await stats(page);
  const per = (s2.spawnMs - s1.spawnMs) / (s2.spawned - s1.spawned);
  const longTasks = await page.evaluate(() => window.__longTasks);
  t.diagnostic(`mousse : ${s2.spawned - s1.spawned} taches posées, ${per.toFixed(2)} ms chacune ; ${s2.running} animées ; tâches longues (> 50 ms) pendant le défilement : ${longTasks}`);
  assert.ok(per < 2, `poser une tache coûte ${per.toFixed(2)} ms`);
  assert.ok(s2.patches <= 36, `au plus 36 taches vivantes (${s2.patches})`);
  await context.close();
});

// Textes mesurés sur la mousse allumée au plus dense. `all` : chaque élément (les liens du menu).
const CONTRAST = [
  { path: '/', sel: '.landing-tagline', label: 'phrase d’accueil' },
  { path: '/', sel: '.landing-eywa-def', label: 'définition d’Eywa' },
  { path: '/', sel: '#contenu a[href="/pandora/intro/"]', label: 'bouton Explorer le codex' },
  { path: '/', sel: '#contenu .landing-follow__link', label: 'lien Nouveautés', all: true },
  { path: '/clans/omatikaya/', sel: 'article .font-body p', label: 'paragraphe de fiche' },
  { path: '/clans/omatikaya/', sel: '.eywa-sidebar nav a', label: 'menu du codex', all: true, widths: [1440] },
  { path: '/clans/omatikaya/', sel: '.eywa-sidebar .eywa-about__link', label: 'liens du bas du menu', all: true, widths: [1440] },
  { path: '/clans/', sel: '.entry-card__summary', label: 'résumé de carte' },
];

// Même image figée mesurée sans puis avec la mousse : sous charge, une scène claire du fond de
// l'accueil peut à elle seule descendre sous 4,5:1 (fond hors de ce lot) ; la mousse, elle, ne doit
// jamais faire passer un texte sous 4,5:1. Revue UX L32 (B1) : le menu du codex tombait à 1,91:1.
test('texte et menu ≥ 4,5:1 au pire pixel avec la mousse allumée au plus dense (1440/390 px)', { timeout: 900_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const failures = [];
  for (const { path, sel, label, all, widths } of CONTRAST) for (const vp of VIEWPORTS) {
    if (widths && !widths.includes(vp[0])) continue;
    const { context, page } = await open(env, path, vp, { deviceScaleFactor: 2 });
    const first = page.locator(sel).first();
    await first.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const n = all ? await page.locator(sel).count() : 1;
    // Toute la zone mesurée allumée (pointeur souris : pleine intensité, sans délai de toucher).
    const boxes = [];
    for (let i = 0; i < n; i++) boxes.push(await page.locator(sel).nth(i).boundingBox());
    const area = {
      x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)),
      width: Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x)),
      height: Math.max(...boxes.map((b) => b.y + b.height)) - Math.min(...boxes.map((b) => b.y)),
    };
    await lightGrid(page, area, 40);
    // Pleine intensité, puis tout est figé : particules et fond (requestAnimationFrame),
    // taches à leur état courant (sinon la mesure, qui coupe les animations, les éteint).
    await page.waitForTimeout(450);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    assert.ok((await freezeMoss(page, { commit: true })) >= 4, `${path} ${label} : taches allumées à figer`);
    await page.waitForTimeout(300);
    const show = (v) => page.evaluate((v) => { document.getElementById('eywa-moss').style.visibility = v; }, v);
    for (let i = 0; i < n; i++) {
      const one = all ? `${sel} >> nth=${i}` : sel;
      await show('hidden');
      const base = await worstPixelContrast(page, one);
      await show('visible');
      const { worst, glyphs } = await worstPixelContrast(page, one);
      const where = `${path} ${label}${all ? ` n°${i + 1}` : ''} @${vp[0]}px`;
      t.diagnostic(`${where} : ${worst.toFixed(2)}:1 avec la mousse, ${base.worst.toFixed(2)}:1 sans (${glyphs} px)`);
      assert.ok(glyphs > 20, `${where} : glyphes non détectés`);
      if (worst < 4.5 && base.worst >= 4.5) failures.push(`${where} : ${worst.toFixed(2)}:1 avec la mousse (${base.worst.toFixed(2)}:1 sans)`);
      // La mousse ne retire pas plus d'un demi-point au pire pixel (même image figée).
      if (base.worst - worst > 0.5) failures.push(`${where} : ${base.worst.toFixed(2)} → ${worst.toFixed(2)}:1 sous la mousse`);
      if (base.worst < 4.5) t.diagnostic(`${where} : déjà sous 4,5:1 sans la mousse (fond animé, hors L32)`);
    }
    await context.close();
  }
  assert.deepEqual(failures, []);
});

// Revue UX L32 (M1) : au téléphone, un toucher au milieu de la page (sur le texte de l'accueil, sur
// la fiche opaque du codex) ne laissait presque rien de visible. Mesure : éclaircissement moyen de la
// bande de l'écran autour du doigt (toute la largeur, 160 px au-dessus et au-dessous), fond arrêté,
// tache figée à pleine intensité.
const TAPS = [
  { path: '/', at: '.landing-tagline', label: 'accueil, sur la phrase' },
  { path: '/clans/omatikaya/', at: 'article .font-body p', label: 'fiche du codex, sur un paragraphe' },
];
for (const { path, at, label } of TAPS) {
  test(`toucher au téléphone (390 px) : la mousse se voit autour du doigt — ${label}`, { timeout: 300_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const { context, page } = await open(env, path, [390, 844]);
    await page.locator(at).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.__eywaAtmo.setPaused(true); document.documentElement.classList.remove('eywa-atmo-paused'); });
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(400);
    const box = await page.locator(at).first().boundingBox();
    const [x, y] = [Math.round(box.x + box.width / 2), Math.round(box.y + Math.min(box.height, 200) / 2)];
    const clip = { x: 0, y: Math.max(0, y - 160), width: 390, height: 320 };
    const before = await page.screenshot({ clip, animations: 'disabled' });
    // Toucher sur window (un vrai toucher sur un lien changerait de page).
    await page.evaluate(({ x, y }) => {
      const o = { clientX: x, clientY: y, pointerType: 'touch', pointerId: 7, isPrimary: true };
      window.dispatchEvent(new PointerEvent('pointerdown', o));
      window.dispatchEvent(new PointerEvent('pointerup', o));
    }, { x, y });
    await page.waitForTimeout(450);
    assert.ok((await freezeMoss(page)) >= 1, 'le toucher a allumé une tache');
    const after = await page.screenshot({ clip, animations: 'allow' });
    const gain = await meanDiff(page, before, after);
    t.diagnostic(`${path} : éclaircissement moyen autour du doigt +${gain.toFixed(2)} / 255`);
    assert.ok(gain > 2.5, `mousse à peine visible autour du doigt (+${gain.toFixed(2)})`);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `moss${path.replace(/\W+/g, '-')}toucher-390.png`), animations: 'allow' });
    await context.close();
  });
}

// Revue UX L32 (m1) : un glissement du doigt (défilement) allumait une tache au pointerdown.
test('doigt qui glisse (défilement) : rien ne s’allume ; toucher bref et immobile : une tache', { timeout: 300_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const { context, page } = await open(env, '/clans/omatikaya/', [390, 844]);
  const fire = (steps) => page.evaluate((steps) => {
    for (const [type, x, y] of steps) {
      window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', pointerId: 3, isPrimary: true }));
    }
  }, steps);
  const spawned = () => page.evaluate(() => window.__eywaMoss.spawned);
  const s0 = await spawned();
  // Glissement que le navigateur prend pour un défilement (pointercancel), puis glissement levé loin.
  await fire([['pointerdown', 200, 600], ['pointermove', 200, 560], ['pointermove', 200, 480], ['pointercancel', 200, 480]]);
  await fire([['pointerdown', 200, 600], ['pointermove', 200, 520], ['pointerup', 200, 420]]);
  assert.equal(await spawned(), s0, 'un glissement du doigt a allumé de la mousse');
  await fire([['pointerdown', 200, 600], ['pointerup', 202, 601]]);
  assert.equal(await spawned(), s0 + 1, 'un toucher bref allume une tache');
  await context.close();
});
