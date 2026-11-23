// L35 r1 — réglage « Jour et nuit » : critères tirés de la revue UX du lot (ux-avatar-L35), pas du code.
//  - Le panneau tient entier dans la fenêtre, ses trois choix touchables, à 320, 390 et 1440 px,
//    texte à 100 % et à 200 % (WCAG 1.4.10, 1.4.4), sur toutes les pages qui le portent :
//    accueil, /pandora/, une page du codex (/flore/) et /bestiaire/ ; aussi en mouvement réduit
//    (le rond du ciel prend alors la place de la pause).
//  - Ordre du focus = ordre visuel (WCAG 2.4.3) : le rond du ciel (à gauche ou au-dessus de la pause)
//    vient avant elle au Tab.
//  - Au grand écran, les ronds fixes ne recouvrent aucun texte de la première vue des pages du codex.
// L35 r2 (revue UX r2) :
//  - le panneau s'ouvre en entier SANS défilement interne, phrase d'heure comprise, même à 320 px
//    texte 200 % en « Selon ton heure » la nuit (phrase la plus longue) : le panneau n'est pas un
//    défileur atteignable au clavier, une phrase coupée ne se lit pas (WCAG 1.4.10) ;
//  - sur le codex, les deux ronds viennent APRÈS la navigation dans l'ordre du focus (WCAG 2.4.3).
// Lit frontend/dist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrames, setupBrowser } from './lib/e2e-dist.mjs';

const PAGES = ['/', '/pandora/', '/flore/', '/bestiaire/'];
const SIZES = [[320, 640], [390, 844], [1440, 900]];

// 23 h 30 en mode « Selon ton heure » : la phrase d'heure la plus longue (« … : nuit noire. »).
const NIGHT = new Date('2026-11-22T23:30:00+01:00');

async function newPage(env, { width, height, reducedMotion = 'no-preference', big = false, time }) {
  const context = await env.browser.newContext({ viewport: { width, height }, reducedMotion, timezoneId: 'Europe/Paris' });
  // Texte à 200 % : taille de police de base doublée (réglage du navigateur, pas zoom de page).
  if (big) await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }, { once: true });
  });
  const page = await context.newPage();
  if (time) await page.clock.setFixedTime(time);
  return { context, page };
}

const inside = (b, w, h) => b && b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5;

test('réglage jour et nuit : panneau dans la fenêtre, ordre du focus, rien de masqué (L35 r1)', { timeout: 1_800_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;

  await t.test('le panneau tient entier dans la fenêtre et ses trois choix se touchent (320, 390, 1440 px ; texte 100 et 200 %)', async () => {
    const failures = [];
    const combos = [];
    for (const [width, height] of SIZES) for (const big of [false, true]) combos.push({ width, height, big, reducedMotion: 'no-preference' });
    // Mouvement réduit : le ciel prend la place de la pause.
    for (const [width, height] of [[320, 640], [1440, 900]]) combos.push({ width, height, big: true, reducedMotion: 'reduce' });
    for (const c of combos) {
      const { context, page } = await newPage(env, { ...c, time: NIGHT });
      for (const path of PAGES) {
        const tag = `${path} ${c.width}px texte ${c.big ? 200 : 100} %${c.reducedMotion === 'reduce' ? ' (mvt réduit)' : ''}`;
        await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
        await nextFrames(page);
        const btn = page.locator('#eywa-sky-toggle');
        const bb = await btn.boundingBox();
        if (!inside(bb, c.width, c.height)) { failures.push(`${tag} : rond hors écran ${JSON.stringify(bb)}`); continue; }
        await btn.click();
        const panel = page.locator('#eywa-sky-panel');
        await panel.waitFor({ state: 'visible' });
        const box = await panel.boundingBox();
        if (!inside(box, c.width, c.height)) failures.push(`${tag} : panneau ${JSON.stringify(box)}`);
        // Tout le panneau se lit sans le faire défiler (pas de défilement interne) ; chaque choix et la
        // phrase d'heure dans la fenêtre ET dans la partie visible du panneau, tels qu'ouverts.
        const now = await page.locator('[data-sky-now]').innerText();
        if (!/23 h 30 chez toi : nuit noire/.test(now)) failures.push(`${tag} : phrase d'heure « ${now} »`);
        const over = await panel.evaluate((p) => p.scrollHeight - p.clientHeight);
        if (over > 1) failures.push(`${tag} : panneau à faire défiler (${over} px cachés)`);
        const pb = await panel.evaluate((p) => { const r = p.getBoundingClientRect(); return { top: r.top + p.clientTop, bottom: r.top + p.clientTop + p.clientHeight }; });
        for (const sel of ['#eywa-sky-title', '#eywa-sky-panel label', '[data-sky-now]']) {
          for (const el of await page.locator(sel).all()) {
            const b = await el.boundingBox();
            if (!inside(b, c.width, c.height) || b.y < pb.top - 0.5 || b.y + b.height > pb.bottom + 0.5) failures.push(`${tag} : ${sel} coupé ${JSON.stringify(b)}`);
          }
        }
        // Les trois choix répondent au toucher (pointeur réel au centre : rien ne les recouvre).
        for (const [label, mode] of [['Nuit', 'nuit'], ['Jour', 'jour'], ['Selon ton heure', 'auto']]) {
          const l = page.locator('#eywa-sky-panel label', { hasText: new RegExp(`^\\s*${label}\\s*$`) });
          try {
            // L68 : 30 s (et non 3) pour que Playwright voie le choix stable sur deux images sous charge ; un choix
            // recouvert échoue toujours (le clic attend que le point visé soit le libellé).
            await l.click({ timeout: 30_000 });
            const got = await page.evaluate(() => document.documentElement.dataset.skyMode);
            if (got !== mode) failures.push(`${tag} : « ${label} » → ${got}`);
          } catch (e) {
            failures.push(`${tag} : « ${label} » intouchable (${e.message.split('\n')[0]})`);
          }
        }
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
    assert.deepEqual(failures, []);
  });

  await t.test('ordre du focus : le rond du ciel vient avant la pause, comme à l’écran', async () => {
    for (const [path, width] of [['/', 1440], ['/', 390], ['/flore/', 1440], ['/flore/', 390]]) {
      const { context, page } = await newPage(env, { width, height: 900 });
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      await nextFrames(page);
      const r = await page.evaluate(() => {
        const sky = document.getElementById('eywa-sky-toggle').getBoundingClientRect();
        const pause = document.getElementById('eywa-atmo-toggle').getBoundingClientRect();
        const order = document.getElementById('eywa-sky-toggle').compareDocumentPosition(document.getElementById('eywa-atmo-toggle'));
        return {
          skyFirstVisually: sky.right <= pause.left || sky.bottom <= pause.top,
          skyFirstInDom: Boolean(order & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      });
      assert.deepEqual(r, { skyFirstVisually: true, skyFirstInDom: true }, `${path} @${width}`);
      // Au Tab, le ciel est atteint juste avant la pause.
      const seen = [];
      for (let i = 0; i < 40 && seen.length < 2; i++) {
        await page.keyboard.press('Tab');
        const id = await page.evaluate(() => document.activeElement?.id);
        if ((id === 'eywa-sky-toggle' || id === 'eywa-atmo-toggle') && !seen.includes(id)) seen.push(id);
      }
      assert.deepEqual(seen, ['eywa-sky-toggle', 'eywa-atmo-toggle'], `${path} @${width}`);
      await context.close();
    }
  });

  await t.test('codex : les deux ronds viennent après la navigation au Tab (WCAG 2.4.3)', async () => {
    for (const [path, width] of [['/flore/', 1440], ['/flore/', 390], ['/bestiaire/akula/', 1440], ['/bestiaire/akula/', 390]]) {
      const { context, page } = await newPage(env, { width, height: 900 });
      await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
      await nextFrames(page);
      // Navigation atteignable au Tab à cette largeur : liens de la barre latérale (grand écran) ou
      // bouton du menu (téléphone, tiroir fermé donc inerte).
      const nav = await page.evaluate(() => {
        const ids = [];
        const burger = document.getElementById('eywa-burger');
        if (burger && burger.checkVisibility()) ids.push('#eywa-burger');
        const side = document.getElementById('eywa-sidebar');
        if (side && !side.inert) side.querySelectorAll('a[href]').forEach((a, i) => { if (a.checkVisibility()) { a.dataset.navProbe = String(i); ids.push(`[data-nav-probe="${i}"]`); } });
        return ids;
      });
      assert.ok(nav.length > 0, `${path} @${width} : aucune navigation trouvée`);
      const order = [];
      for (let i = 0; i < 400; i++) {
        await page.keyboard.press('Tab');
        const key = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a) return null;
          if (a.id === 'eywa-sky-toggle' || a.id === 'eywa-atmo-toggle' || a.id === 'eywa-burger') return `#${a.id}`;
          return a.dataset?.navProbe != null ? `[data-nav-probe="${a.dataset.navProbe}"]` : null;
        });
        if (key && !order.includes(key)) order.push(key);
        if (order.includes('#eywa-atmo-toggle')) break;
      }
      const sky = order.indexOf('#eywa-sky-toggle');
      assert.ok(sky >= 0, `${path} @${width} : rond du ciel jamais atteint`);
      const navBefore = nav.filter((id) => { const k = order.indexOf(id); return k >= 0 && k < sky; });
      assert.deepEqual(navBefore, nav, `${path} @${width} : ordre ${order.join(' ')}`);
      await context.close();
    }
  });

  await t.test('au grand écran, les ronds fixes ne recouvrent aucun texte de la première vue du codex', async () => {
    const failures = [];
    for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768], [1920, 1080]]) {
      const { context, page } = await newPage(env, { width, height });
      for (const path of ['/pandora/', '/flore/', '/bestiaire/', '/bestiaire/akula/']) {
        await page.goto(`${env.base}${path}`, { waitUntil: 'load' });
        await nextFrames(page);
        const hits = await page.evaluate(() => {
          const rounds = ['eywa-sky-toggle', 'eywa-atmo-toggle']
            .map((id) => document.getElementById(id))
            .filter((el) => el && getComputedStyle(el).display !== 'none')
            .map((el) => [el.id, el.getBoundingClientRect()]);
          const out = [];
          const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const n = walker.currentNode;
            if (!n.textContent.trim() || !n.parentElement.checkVisibility()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) {
              if (r.bottom <= 0 || r.top >= innerHeight) continue;
              for (const [id, b] of rounds) {
                if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) out.push(`${id} sur « ${n.textContent.trim().slice(0, 30)} »`);
              }
            }
          }
          return out;
        });
        for (const h of hits) failures.push(`${path} ${width}×${height} : ${h}`);
      }
      await context.close();
    }
    assert.deepEqual(failures, []);
  });
});
