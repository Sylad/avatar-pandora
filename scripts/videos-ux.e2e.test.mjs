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
      // Une seule indication par lien (d'autres .sr-only peuvent y vivre : le type d'une carte vidéo, L47).
      hint: [...a.querySelectorAll('.sr-only')].filter((e) => /nouvel onglet/.test(e.textContent)).length,
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
      lang: c.querySelector('.video-card__title [lang]')?.getAttribute('lang') ?? null,
      hint: c.querySelector('.sr-only')?.closest('[lang]')?.lang ?? null,
    })));
  assert.ok(r.some((x) => x.chip === 'EN') && r.some((x) => x.chip === 'FR'), 'les deux langues sont présentes');
  assert.deepEqual(r.filter((x) => x.chip === 'EN' && x.lang !== 'en'), []);
  assert.deepEqual(r.filter((x) => x.chip === 'FR' && x.lang), []);
  assert.deepEqual(r.filter((x) => x.hint !== 'fr'), [], 'l\'indication « nouvel onglet » est lue en français, hors du passage lang="en"');
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
test('R8 — le nom de la chaîne, la description et la langue d\'une carte ou d\'une ligne de la liste complète gardent ≥ 4,5:1 sur le pire pixel de fond (WCAG 1.4.3)', { timeout: 120_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.evaluate(() => document.fonts.ready);
  for (const sel of ['.video-card__channel', '.video-card__desc', '.video-card__lang', '.channel-card__desc', '.channel-link__desc', '.channel-link__lang']) {
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

// L47 — « (nouvel onglet) » sur le lien, jamais dans le titre : la navigation par titres lit le titre seul.
test('R10 — les titres h3 des cartes vidéo ne contiennent que le titre ; chaque lien garde « (nouvel onglet) » (WCAG 2.4.6 / 3.2.5)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('.video-card')].map((c) => {
      const h = c.querySelector('h3');
      return { h: h.textContent, inH: /nouvel onglet/.test(h.textContent), inA: /\(nouvel onglet\)/.test(c.textContent) };
    }));
  assert.ok(r.length >= 10, `cartes : ${r.length}`);
  assert.deepEqual(r.filter((x) => x.inH || !x.inA), []);
});

// L47 — aucune description coupée (line-clamp, ellipse, débordement caché), au bureau comme au téléphone,
// texte à 100, 125 et 200 % : la revue UX de L47 a trouvé, au-dessus de 700 px avec le texte agrandi, la
// description de « Toutes les chaînes » réduite à 12–22 px et la pastille de langue rognée par la carte vidéo.
const R11_CASES = [
  [1440, 100], [1024, 100], [390, 100], [320, 100],
  [1024, 125], [1280, 125], [1440, 125],
  [768, 200], [1024, 200], [1280, 200], [1440, 200], [320, 200],
];
for (const [width, scale] of R11_CASES) {
  test(`R11 — @${width}px texte ${scale} % : descriptions lisibles en entier et assez larges, aucune pastille rognée (WCAG 1.4.10 / 1.4.4)`, { timeout: 90_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    if (scale !== 100) {
      await page.addInitScript((s) => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${s}%`; }, { once: true });
      }, scale);
    }
    await page.goto(`${env.base}/videos/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate((scale) => {
      const cut = (d) => {
        const s = getComputedStyle(d);
        // Une boîte qui cache son trop-plein, ou un clamp, coupe le texte même si elle « tient ».
        return d.scrollHeight > d.clientHeight + 1 || d.scrollWidth > d.clientWidth + 1
          || s.webkitLineClamp !== 'none' || s.textOverflow === 'ellipsis';
      };
      // Morceaux d'un mot (coupure permise après un trait d'union) répartis sur plusieurs lignes.
      const splitWords = (el) => {
        const out = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (const m of n.data.matchAll(/[^\s-]+-?/g)) {
            const range = document.createRange();
            range.setStart(n, m.index);
            range.setEnd(n, m.index + m[0].length);
            const tops = new Set([...range.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top)));
            if (tops.size > 1) out.push(m[0]);
          }
        }
        return out;
      };
      const descs = [...document.querySelectorAll('.video-card__desc, .channel-card__desc, .channel-link__desc')];
      const card = [...document.querySelectorAll('.video-card')]
        .filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1);
      // Largeur de lecture : au moins 10 em (~20 caractères), ou toute la ligne de la chaîne quand elle est plus étroite.
      const narrow = [...document.querySelectorAll('.channel-link__desc')].map((d) => {
        const link = d.closest('.channel-link');
        const ls = getComputedStyle(link);
        const inner = link.clientWidth - parseFloat(ls.paddingLeft) - parseFloat(ls.paddingRight);
        const need = Math.min(10 * parseFloat(getComputedStyle(d).fontSize), inner);
        return { w: Math.round(d.getBoundingClientRect().width), need: Math.floor(need), t: d.textContent.slice(0, 30) };
      }).filter((x) => x.w < x.need - 1);
      // Pastille de langue entière dans sa carte (la carte vidéo cache son trop-plein).
      const chips = [...document.querySelectorAll('.video-card__lang, .channel-card__lang, .channel-link__lang')].filter((chip) => {
        const b = chip.getBoundingClientRect();
        const c = chip.closest('.video-card, .channel-card, .channel-link').getBoundingClientRect();
        return b.right > c.right + 0.5 || b.left < c.left - 0.5 || chip.scrollWidth > chip.clientWidth + 1;
      }).map((chip) => chip.closest('a').textContent.trim().slice(0, 30));
      return {
        n: descs.length,
        cut: descs.filter(cut).map((d) => d.textContent.slice(0, 40)),
        // À 100 %, aucun mot coupé au milieu (« encyclopé/dique. » à 1024 px avant correction).
        words: scale === 100 ? descs.flatMap(splitWords) : [],
        card: card.length,
        narrow,
        chips,
        // Rien du contenu ne sort de la fenêtre (une carte qui cache son trop-plein le couperait sans défilement).
        out: [...document.querySelectorAll('main *')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1);
        }).map((e) => e.textContent.slice(0, 40)),
        fs: getComputedStyle(document.documentElement).fontSize,
      };
    }, scale);
    assert.ok(r.n >= 20, `descriptions : ${r.n}`);
    if (scale !== 100) assert.ok(parseFloat(r.fs) >= 16 * scale / 100, `texte non agrandi : ${r.fs}`);
    assert.deepEqual(r.cut, []);
    assert.deepEqual(r.words, [], 'mots coupés au milieu');
    assert.equal(r.card, 0, 'carte vidéo qui coupe son contenu');
    assert.deepEqual(r.narrow, [], 'description de chaîne trop étroite pour se lire');
    assert.deepEqual(r.chips, [], 'pastille de langue rognée');
    assert.deepEqual(r.out, [], 'contenu hors de la fenêtre');
  });
}

// L47 (revue UX, m1) — chaque carte vidéo remplit son <li> : les bordures d'une rangée finissent à la même hauteur.
test('R13 — @1440px : les cartes vidéo d\'une rangée ont la hauteur de leur rangée', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const off = await page.evaluate(() =>
    [...document.querySelectorAll('.video-card')].map((c) => ({
      d: Math.abs(c.getBoundingClientRect().height - c.parentElement.getBoundingClientRect().height),
      t: c.querySelector('h3').textContent.slice(0, 30),
    })).filter((x) => x.d > 1));
  assert.deepEqual(off, []);
});

// L47 (revue UX, m2) — le nom accessible d'une carte vidéo commence par son titre, pas par le type (« Officiel… »).
test('R14 — le nom accessible de chaque carte vidéo commence par le titre de la vidéo (WCAG 2.4.4 / 2.5.3)', { timeout: 60_000 }, async (t) => {
  const page = await open(t);
  if (!page) return;
  const cards = page.locator('main .video-card');
  const n = await cards.count();
  assert.ok(n >= 10, `cartes : ${n}`);
  const bad = [];
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const title = (await card.locator('h3').textContent()).replaceAll('\u00ad', '').replace(/[\u00a0\u202f]/g, ' ').trim(); // L73 : sans les U+00AD des coupures, insécables lues comme des espaces
    const snap = await card.ariaSnapshot();
    // Première ligne du snapshot : « - link "…" », entre apostrophes YAML quand le nom en contient (' doublée).
    const first = snap.split('\n')[0].replace(/''/g, "'");
    const name = (first.match(/link "(.*)"/) ?? [])[1] ?? first;
    const type = (await card.locator('.video-card__type').textContent()).trim();
    if (!name.startsWith(title) || !name.includes(type)) bad.push({ title, name: name.slice(0, 80) });
  }
  assert.deepEqual(bad, [], 'nom qui ne commence pas par le titre, ou type absent du nom');
});

// L47 / L52 — vignettes : hqdefault d'emblée ; jamais de maxresdefault demandée pour une vidéo qui n'en a pas.
// YouTube est simulé (réponses fixes) : le test ne dépend pas du réseau.
test('R12 — vignettes servies en hqdefault, aucune demande de maxresdefault en 404, 0 erreur console', { timeout: 90_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const asked = [];
  await page.route('https://img.youtube.com/**', (route) => {
    const url = route.request().url();
    asked.push(url);
    if (url.includes('/muEMyQAJreg/maxresdefault')) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${env.base}/videos/`, { waitUntil: 'load' });
  // Les vignettes sont en chargement paresseux : les amener toutes à l'écran.
  for (const img of await page.locator('img.video-card__img').all()) await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('img.video-card__img')].every((i) => i.complete));
  const srcs = await page.evaluate(() => [...document.querySelectorAll('img.video-card__img')].map((i) => i.getAttribute('src')));
  assert.ok(srcs.length >= 10);
  assert.deepEqual(srcs.filter((s) => !/\/hqdefault\.jpg$/.test(s)), [], 'src initial hors hqdefault');
  assert.deepEqual(asked.filter((u) => u.includes('/muEMyQAJreg/maxresdefault')), []);
  assert.ok(asked.some((u) => u.includes('/muEMyQAJreg/hqdefault')), 'hqdefault de muEMyQAJreg demandée');
  assert.deepEqual(errors, []);
});
