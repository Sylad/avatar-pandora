// L11 — revue UX de la page Vidéos. Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './lib/e2e-dist.mjs';

async function open(t, width = 1440) {
  const env = await setupBrowser(t);
  if (!env) return null;
  const page = await env.browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${env.base}/videos/`, { waitUntil: 'load' });
  return page;
}

test('R1 — tout lien qui ouvre un nouvel onglet le dit dans son nom accessible (WCAG 3.2.5 / G201)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('main a[target="_blank"]')].map((a) => ({
      hint: a.querySelectorAll('.sr-only').length,
      ok: /\(nouvel onglet\)/.test(a.textContent),
      t: a.textContent.trim().slice(0, 40),
    })));
  assert.ok(names.length >= 20, `liens externes : ${names.length}`);
  assert.deepEqual(names.filter((n) => !n.ok || n.hint !== 1), []);
});

test('R2 — les vignettes sont décoratives (alt vide) : le titre est déjà dans le lien, il n\'est pas lu deux fois (WCAG H67)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const alts = await page.evaluate(() =>
    [...document.querySelectorAll('img.video-card__img')].map((i) => i.getAttribute('alt')));
  assert.ok(alts.length >= 10, `vignettes : ${alts.length}`);
  assert.deepEqual(alts.filter((a) => a !== ''), []);
});

test('R3 — les initiales des pastilles de chaîne sont masquées aux lecteurs d\'écran (le nom suit)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const r = await page.evaluate(() => {
    const av = [...document.querySelectorAll('.channel-card__avatar, .channel-link__avatar')];
    return { n: av.length, bad: av.filter((a) => a.getAttribute('aria-hidden') !== 'true').length };
  });
  assert.ok(r.n >= 10, `pastilles : ${r.n}`);
  assert.equal(r.bad, 0);
});

test('R4 — cartes et chaînes sont des listes : le lecteur d\'écran annonce le nombre d\'éléments (WCAG 1.3.1)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const r = await page.evaluate(() => {
    const count = (sel) => document.querySelectorAll(sel).length;
    const orphan = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.parentElement.tagName !== 'LI').length;
    return {
      lists: [...document.querySelectorAll('main section')].map((s) => s.querySelectorAll(':scope > ul').length),
      orphans: orphan('.channel-card') + orphan('.video-card') + orphan('.channel-link'),
      cards: count('.video-card'),
    };
  });
  assert.deepEqual(r.lists, [1, 1, 1], 'une liste par section');
  assert.equal(r.orphans, 0, 'carte hors <li>');
  assert.ok(r.cards >= 10);
});

test('R5 — les titres de vidéos en anglais sont balisés lang="en" (WCAG 3.1.2), pas ceux en français', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('.video-card')].map((c) => ({
      chip: c.querySelector('.video-card__lang').textContent.trim(),
      lang: c.querySelector('.video-card__title').getAttribute('lang'),
    })));
  assert.ok(r.some((x) => x.chip === 'EN') && r.some((x) => x.chip === 'FR'), 'les deux langues sont présentes');
  assert.deepEqual(r.filter((x) => x.chip === 'EN' && x.lang !== 'en'), []);
  assert.deepEqual(r.filter((x) => x.chip === 'FR' && x.lang), []);
});

test('R6 — la description d\'une chaîne de la liste complète n\'est pas coupée par une ellipse à 1440 px (WCAG 1.4.4 / 1.4.10)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll('.channel-link__desc')].filter((d) => d.scrollWidth > d.clientWidth + 1).length);
  assert.equal(cut, 0, 'descriptions tronquées');
});

test('R7 — la carte focalisée au clavier montre un anneau d\'au moins 2 px', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  for (const sel of ['.video-card', '.channel-card', '.channel-link']) {
    await page.locator(sel).first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const o = await page.locator(sel).first().evaluate((n) => {
      const s = getComputedStyle(n);
      return { style: s.outlineStyle, w: parseFloat(s.outlineWidth), focused: document.activeElement === n };
    });
    assert.ok(o.focused, `${sel} non focalisé`);
    assert.ok(o.style !== 'none' && o.w >= 2, `${sel} : ${o.style} ${o.w}px`);
  }
});

// Le texte des cartes est petit (12–14 px) : peu de pixels « pleins », donc la mesure porte sur le
// FOND derrière la boîte du texte (texte rendu transparent), comparé à la couleur du texte.
test('R8 — le nom de la chaîne, la description et la langue d\'une carte gardent ≥ 4,5:1 sur le pire pixel de fond (WCAG 1.4.3)', { timeout: 120_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.evaluate(() => document.fonts.ready);
  for (const sel of ['.video-card__channel', '.video-card__desc', '.video-card__lang', '.channel-card__desc']) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    const color = await el.evaluate((n) => getComputedStyle(n).color);
    const opacity = await el.evaluate((n) => { let o = 1; for (let e = n; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; });
    assert.equal(opacity, 1, `${sel} : opacité cumulée ${opacity}`);
    await el.evaluate((n) => n.style.setProperty('color', 'transparent', 'important'));
    const shot = (await page.screenshot({ clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) }, animations: 'disabled' })).toString('base64');
    const worst = await page.evaluate(async ({ shot, color }) => {
      const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const [r, g, b] = color.match(/[\d.]+/g).map(Number);
      const Lt = L(r, g, b);
      let min = Infinity;
      for (let i = 0; i < d.length; i += 4) {
        const B = L(d[i], d[i + 1], d[i + 2]);
        min = Math.min(min, (Math.max(Lt, B) + 0.05) / (Math.min(Lt, B) + 0.05));
      }
      return min;
    }, { shot, color });
    assert.ok(worst >= 4.5, `${sel} : ${worst.toFixed(2)}:1`);
  }
});

for (const width of [1440, 390, 320]) {
  test(`R9 — page Vidéos @${width}px : aucun débordement horizontal`, { timeout: 60_000 }, async (t) => {
    const page = await open(t, width);
    if (!page) return;
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  });
}
