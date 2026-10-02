// L21 — Nouveautés, finitions (repasse UX L14) et mise au niveau d'evatosorus :
//   • séparateur « Déjà vu » HORS de la liste (deux listes de part et d'autre d'un
//     role="separator" nommé) — WCAG 1.3.1 : une liste ne contient que des éléments de liste ;
//   • nombre de nouveautés non vues dans le nom du bouton menu au téléphone ;
//   • mémoire de base dès la première page vue, entrée antidatée encore nouvelle, ancien
//     format (en production depuis L14) toujours lu ;
//   • « N nouveautés depuis ta dernière visite » et marque « Nouveau » ;
//   • lien permanent par un bouton « Copier le lien » visible près de la date (le titre
//     redevient du texte) ; arrivée sur /nouveautes/#<slug> : entrée signalée, focalisée,
//     pas sous le bouton menu fixe.
// Lit frontend/dist (lancer le build avant) ; tests navigateur en « skip » sans Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const DATA = JSON.parse(readFileSync(new URL('../frontend/public/nouveautes-data/nouveautes.json', import.meta.url), 'utf8'));
const html = () => readFileSync(join(DIST, 'nouveautes', 'index.html'), 'utf8');
const KEY = 'eywa.news.seen-v1';
const OLD_VISIT = { date: '2026-01-01', slugs: [], at: '2026-01-01T10:00:00.000Z' };
const unseenText = (n) => (n === 1 ? '1 nouveauté non vue' : `${n} nouveautés non vues`);
const sinceText = (n) => (n === 1 ? '1 nouveauté depuis ta dernière visite' : `${n} nouveautés depuis ta dernière visite`);
const newest = DATA.entries.map((e) => e.date).sort().at(-1);

const visible = (page, sel) => page.locator(sel).evaluateAll((els) => els.filter((e) => e.offsetParent && !e.closest('[hidden]')).length);

// ── Structure construite ────────────────────────────────────────────────────

test('titre en texte simple ; bouton « Copier le lien » dans la ligne de date de chaque entrée ; entrée focalisable ; annonce pour lecteur d’écran', () => {
  const page = html();
  for (const e of DATA.entries) {
    const start = page.indexOf(`id="${e.slug}"`);
    const block = page.slice(start, page.indexOf('</article>', start));
    const h2 = block.slice(block.indexOf('<h2'), block.indexOf('</h2>'));
    assert.doesNotMatch(h2, /<a /, `${e.slug} : le titre est un lien`);
    const date = block.slice(block.indexOf('class="news-date'), block.indexOf('</p>', block.indexOf('class="news-date')));
    assert.match(date, /<button type="button" class="news-copy[^"]*"[^>]*data-slug="/, `${e.slug} : bouton absent de la ligne de date`);
    assert.match(date, /Copier le lien/);
    assert.match(page.slice(page.lastIndexOf('<article', start), start + 200), /tabindex="-1"/, `${e.slug} : entrée non focalisable`);
  }
  assert.doesNotMatch(page, /class="news-permalink"/, 'ancienne icône de lien permanent');
  assert.match(page, /<p[^>]*id="news-copy-status"[^>]*role="status"|<p[^>]*role="status"[^>]*id="news-copy-status"/);
  assert.match(page, /<p[^>]*class="news-since"[^>]*role="status"/);
});

// ── Mémoire, pastille, bouton menu ──────────────────────────────────────────

test('mémoire de base : premier passage sur n’importe quelle page sans pastille ; une entrée publiée ensuite la lève sans jamais ouvrir /nouveautes/', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/`, { waitUntil: 'load' });
  await page.waitForFunction((k) => localStorage.getItem(k), KEY);
  assert.equal(await visible(page, '.news-badge'), 0, 'pastille au tout premier passage');
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.equal(stored.all, true);
  assert.deepEqual(stored.slugs, DATA.entries.map((e) => e.slug).sort());
  // Une entrée publiée après ce premier passage : son slug n'est pas dans la mémoire.
  await page.evaluate(([k, slug]) => {
    const v = JSON.parse(localStorage.getItem(k));
    v.slugs = v.slugs.filter((s) => s !== slug);
    localStorage.setItem(k, JSON.stringify(v));
  }, [KEY, DATA.entries.at(-1).slug]);
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  const badge = page.locator('#eywa-sidebar a[href="/nouveautes/"] .news-badge');
  await badge.waitFor({ state: 'visible' });
  assert.equal((await badge.locator('.news-badge__n').textContent()).trim(), '1', 'entrée antidatée non comptée');
  await context.close();
});

test('mémoire au format de L14 (déjà chez les visiteurs) : lue sans rien rallumer, puis convertie à la visite', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/about/`, { waitUntil: 'load' });
  const l14 = { date: newest, slugs: DATA.entries.filter((e) => e.date === newest).map((e) => e.slug).sort(), at: '2026-10-01T20:30:00.000Z' };
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, l14]);
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  assert.equal(await visible(page, '.news-badge'), 0, 'ancienne mémoire : pastille rallumée');
  assert.deepEqual(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY), l14, 'ancienne mémoire écrasée hors visite');
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).all === true, KEY);
  assert.equal(await page.locator('.news-new').count(), 0);
  await context.close();
});

test('téléphone : le nom du bouton menu dit le nombre de nouveautés non vues ; « Fermer la navigation » ouvert ; rien après la visite', { timeout: 90_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const n = DATA.entries.length;
  const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, OLD_VISIT]);
  await page.reload({ waitUntil: 'load' });
  const burger = page.locator('#eywa-burger');
  await page.waitForFunction((label) => document.getElementById('eywa-burger').getAttribute('aria-label') === label, `Ouvrir la navigation (${unseenText(n)})`);
  assert.equal(await page.getByRole('button', { name: `Ouvrir la navigation (${unseenText(n)})` }).count(), 1);
  assert.ok(await burger.locator('.eywa-burger__dot').isVisible(), 'point absent');
  await burger.click();
  assert.equal(await burger.getAttribute('aria-label'), 'Fermer la navigation');
  await page.keyboard.press('Escape');
  assert.equal(await burger.getAttribute('aria-label'), `Ouvrir la navigation (${unseenText(n)})`, 'nombre perdu à la fermeture');
  // Navigation sans rechargement (ClientRouter) vers une autre page : toujours annoncé.
  await burger.click();
  await Promise.all([page.waitForURL((u) => u.pathname === '/bestiaire/'), page.locator('#eywa-sidebar a[href="/bestiaire/"]').click()]);
  await page.waitForFunction((label) => document.getElementById('eywa-burger')?.getAttribute('aria-label') === label, `Ouvrir la navigation (${unseenText(n)})`);
  // Visite des Nouveautés par le tiroir : plus rien à annoncer.
  await page.locator('#eywa-burger').click();
  await Promise.all([page.waitForURL((u) => u.pathname === '/nouveautes/'), page.locator('#eywa-sidebar a[href="/nouveautes/"]').click()]);
  await page.waitForFunction(() => document.getElementById('eywa-burger')?.getAttribute('aria-label') === 'Ouvrir la navigation');
  assert.equal(await page.locator('#eywa-burger .eywa-burger__dot').isVisible(), false);
  await context.close();
});

// ── Page : bandeau, marques, séparateur ─────────────────────────────────────

test('page : « N nouveautés depuis ta dernière visite », marque écrite « Nouveau » ; premier visiteur sans marque', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const n = DATA.entries.length;
  const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.news-new').count(), 0);
  assert.equal((await page.locator('.news-since').textContent()).trim(), '');
  assert.equal(await page.locator('.news-since').isVisible(), false, 'bandeau vide affiché');
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, OLD_VISIT]);
  await page.reload({ waitUntil: 'load' });
  await page.locator('.news-new').first().waitFor();
  assert.equal(await page.locator('.news-new').count(), n);
  assert.equal((await page.locator('.news-new').first().textContent()).trim(), 'Nouveau');
  assert.equal((await page.locator('.news-since').textContent()).trim(), sinceText(n));
  assert.equal(await page.locator('.news-seen-sep').count(), 0, 'séparateur sans entrée déjà vue');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `débordement horizontal de ${overflow}px`);
  await context.close();
});

// Structure des listes : uniquement des <li> sans rôle (règle axe « list » / « listitem »).
const listsAreClean = (page) => page.evaluate(() => [...document.querySelectorAll('ol, ul')]
  .flatMap((l) => [...l.children].filter((c) => c.tagName !== 'LI' || c.hasAttribute('role')).map((c) => `${l.className} > ${c.tagName}.${c.className}[role=${c.getAttribute('role')}]`)));

test('séparateur « Déjà vu lors de ta visite du … » : hors de toute liste, role="separator" nommé, entre la dernière nouvelle et la première déjà vue', { timeout: 60_000 }, async (t) => {
  if (DATA.entries.length < 2) { t.skip('il faut au moins deux nouveautés'); return; }
  const env = await setupBrowser(t);
  if (!env) return;
  const visit = { date: DATA.entries[1].date, slugs: DATA.entries.slice(1).map((e) => e.slug).sort(), at: '2026-10-01T08:30:00.000Z', all: true };
  for (const width of [1440, 320]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 640 }, timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/about/`, { waitUntil: 'load' });
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, visit]);
    await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
    const sep = page.locator('.news-seen-sep');
    await sep.waitFor();
    const label = 'Déjà vu lors de ta visite du 1er octobre 2026 à 10\u00a0h\u00a030';
    const info = await sep.evaluate((s) => ({
      role: s.getAttribute('role'),
      name: s.getAttribute('aria-label'),
      text: s.textContent.trim(),
      inList: !!s.closest('ol, ul, li'),
      before: s.previousElementSibling?.matches('ol.news-list') ? [...s.previousElementSibling.querySelectorAll('article')].map((a) => a.id) : null,
      after: s.nextElementSibling?.matches('ol.news-list') ? [...s.nextElementSibling.querySelectorAll('article')].map((a) => a.id) : null,
    }));
    assert.equal(await sep.count(), 1);
    assert.equal(info.role, 'separator');
    assert.equal(info.name, label);
    assert.equal(info.text, label);
    assert.equal(info.inList, false, 'séparateur dans une liste');
    assert.deepEqual(info.before, [DATA.entries[0].slug], 'liste des nouvelles avant le séparateur');
    assert.deepEqual(info.after, DATA.entries.slice(1).map((e) => e.slug), 'liste des déjà vues après le séparateur');
    assert.equal(await page.getByRole('separator', { name: label }).count(), 1, 'séparateur absent de l’arbre d’accessibilité');
    assert.deepEqual(await listsAreClean(page), [], 'liste qui contient autre chose que des éléments de liste');
    assert.equal(await page.locator('.news-new').count(), 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 0, `${width}px : débordement horizontal de ${overflow}px`);
    await context.close();
  }
});

test('nouvelles non contiguës (entrée antidatée plus bas) : marques « Nouveau » sans séparateur trompeur', { timeout: 60_000 }, async (t) => {
  if (DATA.entries.length < 3) { t.skip('il faut au moins trois nouveautés (deux aujourd’hui)'); return; }
  const env = await setupBrowser(t);
  if (!env) return;
  const unseen = [DATA.entries[0].slug, DATA.entries[2].slug];
  const visit = { date: DATA.entries[0].date, slugs: DATA.entries.map((e) => e.slug).filter((s) => !unseen.includes(s)).sort(), at: '2026-10-01T08:30:00.000Z', all: true };
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${env.base}/about/`, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, visit]);
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  await page.locator('.news-new').first().waitFor();
  assert.deepEqual(await page.locator('article:has(.news-new)').evaluateAll((as) => as.map((a) => a.id)), unseen);
  assert.equal(await page.locator('.news-seen-sep').count(), 0);
  await context.close();
});

// ── Lien permanent ──────────────────────────────────────────────────────────

test('arriver sur /nouveautes/#<slug> : entrée signalée, focalisée, dans l’écran et pas sous le bouton menu fixe', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const target = DATA.entries.at(-1).slug;
  for (const width of [390, 320, 1440]) {
    const context = await env.browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 700 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${env.base}/nouveautes/#${target}`, { waitUntil: 'load' });
    await page.waitForFunction((s) => document.activeElement?.id === s, target);
    assert.deepEqual(await page.locator('article.is-target').evaluateAll((as) => as.map((a) => a.id)), [target]);
    const { top, vh, burgerBottom, y } = await page.locator(`[id="${target}"]`).evaluate((a) => {
      const b = document.getElementById('eywa-burger');
      const r = b && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect().bottom : 0;
      return { top: a.getBoundingClientRect().top, vh: innerHeight, burgerBottom: r, y: scrollY };
    });
    assert.ok(y > 0, `${width}px : la page n’a pas défilé jusqu’à l’entrée`);
    assert.ok(top >= burgerBottom - 1 && top < vh - 40, `${width}px : entrée à ${top}px du haut (bouton menu jusqu’à ${burgerBottom}px, écran ${vh}px)`);
    await context.close();
  }
});

const copyGeometry = (page, slug) => page.evaluate((sl) => {
  const art = document.getElementById(sl);
  const btn = art.querySelector('.news-copy');
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, w: b.width, h: b.height }; };
  const li = art.closest('li');
  return { scrollY, hash: location.hash, url: location.href, btn: r(btn), h2: r(art.querySelector('h2')), body: r(art.querySelector('.news-body')), next: li.nextElementSibling ? r(li.nextElementSibling) : null };
}, slug);

test('au clavier (1440 px) : Tab atteint « Copier le lien » (contour visible, ≥ 24×24 px) ; Entrée copie sans défiler ni changer l’adresse ; retour dans le libellé, 0 px de décalage, annoncé', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  const slug = DATA.entries[0].slug;
  const btn = page.locator(`[id="${slug}"] .news-copy`);
  await btn.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 60));
  await btn.evaluate((b) => b.closest('article').focus({ preventScroll: true }));
  let reached = false;
  for (let i = 0; i < 10 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate((s) => document.activeElement?.matches(`[id="${s}"] .news-copy`), slug);
  }
  assert.ok(reached, 'bouton hors de l’ordre de tabulation');
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
  assert.ok(outline.style !== 'none' && outline.w >= 2, `contour de focus invisible (${JSON.stringify(outline)})`);
  const before = await copyGeometry(page, slug);
  assert.ok(before.btn.w >= 24 && before.btn.h >= 24, `cible ${before.btn.w}×${before.btn.h}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction((s) => document.querySelector(`[id="${s}"] .news-copy`).dataset.state === 'ok', slug);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${env.base}/nouveautes/#${slug}`);
  assert.equal((await btn.locator('.news-copy-label:not(.is-hidden)').textContent()).trim(), 'Lien copié');
  assert.equal((await page.locator('#news-copy-status').textContent()).trim(), 'Lien copié dans le presse-papiers');
  const during = await copyGeometry(page, slug);
  assert.equal(during.scrollY, before.scrollY, 'la page a défilé');
  assert.equal(during.url, before.url, 'l’adresse a changé');
  assert.deepEqual(during.btn, before.btn, 'le bouton a changé de taille');
  assert.deepEqual([during.h2, during.body, during.next], [before.h2, before.body, before.next], 'décalage pendant le retour');
  await page.waitForFunction((s) => document.querySelector(`[id="${s}"] .news-copy`).dataset.state === 'idle', slug, { timeout: 8000 });
  const after = await copyGeometry(page, slug);
  assert.deepEqual([after.btn, after.h2, after.body, after.next], [before.btn, before.h2, before.body, before.next], 'décalage à la fin du retour');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('news-copy')), true, 'focus perdu');
  await context.close();
});

test('au toucher (390 px) : « Copier le lien » visible sans survol, cible ≥ 44 px ; un toucher copie sans défiler ; le titre ne copie rien', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${env.base}/nouveautes/`, { waitUntil: 'load' });
  const slug = DATA.entries[0].slug;
  const btn = page.locator(`[id="${slug}"] .news-copy`);
  await btn.scrollIntoViewIfNeeded();
  assert.ok(await btn.isVisible());
  assert.equal((await btn.locator('.news-copy-label:not(.is-hidden)').textContent()).trim(), 'Copier le lien');
  const before = await copyGeometry(page, slug);
  assert.ok(before.btn.h >= 44 && before.btn.w >= 44, `cible tactile ${before.btn.w}×${before.btn.h}`);
  // Toucher le titre : rien ne se passe (ni copie, ni défilement, ni ancre).
  await page.locator(`[id="${slug}"] h2`).tap();
  await page.waitForTimeout(200);
  assert.equal(await btn.evaluate((b) => b.dataset.state), 'idle');
  await btn.tap();
  await page.waitForFunction((s) => ['ok', 'ko'].includes(document.querySelector(`[id="${s}"] .news-copy`).dataset.state), slug);
  const during = await copyGeometry(page, slug);
  assert.equal(during.scrollY, before.scrollY, 'la page a défilé');
  assert.equal(during.hash, '', 'l’adresse a changé');
  assert.deepEqual([during.btn, during.h2, during.body], [before.btn, before.h2, before.body], 'décalage');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `débordement horizontal de ${overflow}px`);
  await context.close();
});
