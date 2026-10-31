// L12 — revue UX de la page À propos. Lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './lib/e2e-dist.mjs';

async function open(t, width = 1440) {
  const env = await setupBrowser(t);
  if (!env) return null;
  const page = await env.browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${env.base}/about/`, { waitUntil: 'load' });
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
  assert.equal(names.length, 9, `liens externes : ${names.length}`);
  assert.deepEqual(names.filter((n) => !n.ok || n.hint !== 1), []);
});

test('R2 — les titres se suivent sans saut de niveau : h1, puis un h2 par section (WCAG 1.3.1 / 2.4.6)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const levels = await page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => Number(h.tagName[1])));
  assert.equal(levels[0], 1);
  assert.equal(levels.filter((l) => l === 1).length, 1, 'un seul h1');
  const jumps = levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1);
  assert.deepEqual(jumps, [], `sauts de niveau : ${levels.join(',')}`);
  assert.equal(levels.filter((l) => l === 2).length, 4, 'histoire, sources, autres sites, + pile technique');
});

test('R3 — pile technique, sources et autres sites sont des listes : le lecteur d\'écran annonce le nombre d\'éléments (WCAG 1.3.1)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const r = await page.evaluate(() => ({
    sources: document.querySelectorAll('main ul.about-sources > li > a').length,
    sites: document.querySelectorAll('main ul.about-sites > li > a').length,
    stack: document.querySelectorAll('main .about-stack ul').length,
    orphans: [...document.querySelectorAll('main a[target="_blank"]')].filter((a) => a.parentElement.tagName !== 'LI' && !a.closest('p')).length,
  }));
  assert.deepEqual(r, { sources: 4, sites: 4, stack: 3, orphans: 0 });
});

test('R4 — emojis, flèches ↗ et puces › sont masqués aux lecteurs d\'écran', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const bad = await page.evaluate(() => {
    const out = [];
    for (const n of document.querySelectorAll('main span')) {
      const own = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).join('');
      if (/^(↗|›|\p{Extended_Pictographic}+)$/u.test(own) && !n.closest('[aria-hidden="true"]')) out.push(own);
    }
    return out;
  });
  assert.deepEqual(bad, []);
});

test('R5 — le passage en anglais est balisé lang="en" (WCAG 3.1.2)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const en = await page.evaluate(() => [...document.querySelectorAll('main [lang="en"]')].map((e) => e.textContent.trim()));
  assert.ok(en.includes('Vibe coded'), `titre : ${en}`);
  assert.ok(en.includes('Made with curiosity'), `signature : ${en}`);
});

test('R6 — le texte de la page ne descend pas sous 12 px et ne perd pas de contraste par opacité (WCAG 1.4.3 / 1.4.4)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const small = await page.evaluate(() => {
    const out = [];
    for (const n of document.querySelectorAll('main *')) {
      const hasText = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!hasText || n.closest('[aria-hidden="true"]')) continue;
      const s = getComputedStyle(n);
      let o = 1; for (let e = n; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      const a = Number(s.color.match(/[\d.]+/g)[3] ?? 1);
      if (parseFloat(s.fontSize) < 12 || o < 1 || a < 1) out.push(`${n.className} ${s.fontSize} o${o} a${a}`);
    }
    return out;
  });
  assert.deepEqual(small, []);
});

// Texte petit : peu de pixels « pleins », donc la mesure porte sur le FOND derrière la boîte du
// texte (texte rendu transparent), comparé à la couleur du texte (méthode de L11 R8).
test('R7 — signature, auteur d\'une source, description de source et d\'un site gardent ≥ 4,5:1 sur le pire pixel de fond (WCAG 1.4.3)', { timeout: 120_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.evaluate(() => document.fonts.ready);
  for (const sel of ['.about-sign', '.about-by', '.about-why', '.about-site-desc', '.about-stack li span:last-child']) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    const color = await el.evaluate((n) => getComputedStyle(n).color);
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

test('R8 — le lien focalisé au clavier montre un anneau d\'au moins 2 px', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  for (const sel of ['.about-sources a', '.about-sites a']) {
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

test('R9 — la pile technique ne cite pas de jargon de plan interne (« Plan 2 ») que la lectrice ne peut pas comprendre', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  assert.equal(await page.evaluate(() => /Plan \d/.test(document.querySelector('main').textContent)), false);
});

for (const width of [1440, 390, 320]) {
  test(`R10 — page À propos @${width}px : aucun débordement horizontal`, { timeout: 60_000 }, async (t) => {
    const page = await open(t, width);
    if (!page) return;
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  });
}
