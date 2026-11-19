// L17 — illustrations propres au site (public/illustrations/), générées en local
// (scripts/illustrations/). Chaque fiche illustrée sert deux WebP aux dimensions annoncées
// au navigateur, porte un texte alternatif français, et rien ne traîne sans fiche.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { coverCardSrc, coverImageSrc, isIllustration, ILLUSTRATION_SIZES } from '../frontend/src/lib/cover.ts';
import { setupBrowser } from './lib/e2e-dist.mjs';

const FRONT = fileURLToPath(new URL('../frontend/', import.meta.url));
const REPO = fileURLToPath(new URL('../', import.meta.url));
const SOURCES = JSON.parse(readFileSync(join(REPO, 'scripts/illustrations/illustrations.json'), 'utf8'));
const GUIDEES = SOURCES.filter((e) => e.ip_adapter);
const CONTENT = join(FRONT, 'src/content');
const PUBLIC = join(FRONT, 'public');
const SECTIONS = ['pandora', 'clans', 'bestiaire', 'flore', 'engins', 'films', 'personnages'];
// Cloudflare Pages refuse un fichier de plus de 25 Mo ; on vise bien plus léger.
const MAX_FICHE = 250 * 1024;
const MAX_CARTE = 90 * 1024;
const MAX_TOTAL = 12 * 1024 * 1024;

function frontmatter(file) {
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const get = (k) => m[1].match(new RegExp(`^${k}:\\s*"(.*)"\\s*$`, 'm'))?.[1];
  return { title: get('title'), cover: get('cover'), coverAlt: get('coverAlt'), pandorapedia: get('pandorapedia') };
}

/** Vrai si le texte alternatif reprend le titre de la fiche (en entier, ou son nom avant « — ») au lieu de décrire l'image. */
function repeatsTitle(alt, title) {
  const norm = (s) => s.normalize('NFC').toLocaleLowerCase('fr').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const a = norm(alt);
  const t = norm(title);
  const name = norm(title.split(/\s+[—–-]\s+/)[0]);
  return a === t || a.includes(t) || a.startsWith(name);
}

const entries = SECTIONS.flatMap((s) =>
  readdirSync(join(CONTENT, s)).filter((f) => f.endsWith('.md'))
    .map((f) => ({ section: s, slug: f.slice(0, -3), ...frontmatter(join(CONTENT, s, f)) })));
const illustrated = entries.filter((e) => isIllustration(e.cover));

/** Largeur × hauteur d'un WebP (VP8, VP8L ou VP8X), lues dans l'en-tête. */
function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  throw new Error(`WebP inconnu : ${kind}`);
}

test('R1 — chemins : la carte prend la taille 4:3, la fiche la 21:9 ; un titre Fandom reste sans image', () => {
  assert.equal(coverCardSrc('/illustrations/pandora/intro.webp'), '/illustrations/pandora/intro-carte.webp');
  assert.equal(coverImageSrc('/illustrations/pandora/intro.webp'), '/illustrations/pandora/intro.webp');
  assert.equal(coverCardSrc('Toruk'), undefined);
  assert.equal(coverImageSrc('Toruk'), undefined);
  assert.equal(coverCardSrc('/autre/image.png'), '/autre/image.png', 'image du site hors illustrations : telle quelle');
  assert.equal(isIllustration('/illustrations/pandora/intro-carte.webp'), true);
  assert.equal(isIllustration('/illustrations/../x.webp'), false);
});

test('R2 — les 8 fiches de la section Pandora (accueil du codex) sont illustrées', () => {
  const pandora = entries.filter((e) => e.section === 'pandora');
  assert.equal(pandora.length, 8);
  assert.deepEqual(pandora.filter((e) => !isIllustration(e.cover)).map((e) => e.slug), []);
});

test('R3 — chaque illustration : chemin de sa section, deux WebP aux dimensions annoncées, poids raisonnable', () => {
  assert.ok(illustrated.length >= 8);
  let total = 0;
  for (const e of illustrated) {
    assert.equal(e.cover, `/illustrations/${e.section}/${e.slug}.webp`, `${e.section}/${e.slug}`);
    for (const [kind, src, max] of [['fiche', e.cover, MAX_FICHE], ['carte', coverCardSrc(e.cover), MAX_CARTE]]) {
      const file = join(PUBLIC, src);
      assert.ok(existsSync(file), `absent : ${src}`);
      const buf = readFileSync(file);
      assert.deepEqual(webpSize(buf), { ...ILLUSTRATION_SIZES[kind] }, src);
      assert.ok(buf.length <= max, `${src} : ${buf.length} octets > ${max}`);
      total += buf.length;
    }
  }
  assert.ok(total <= MAX_TOTAL, `total ${total} octets`);
});

test('R4 — texte alternatif français qui décrit l’image (pas le titre de la fiche)', () => {
  // Le garde-fou lui-même : un titre allongé est refusé, une vraie description passe.
  assert.equal(repeatsTitle('Ikran — le banshee de montagne des Omatikaya', 'Ikran — le banshee de montagne'), true);
  assert.equal(repeatsTitle('Ikran planant au-dessus des falaises', 'Ikran — le banshee de montagne'), true);
  assert.equal(repeatsTitle('Falaises vertigineuses couvertes de jungle', 'Ikran — le banshee de montagne'), false);
  for (const e of illustrated) {
    assert.ok(e.title, `${e.section}/${e.slug} : titre introuvable`);
    assert.equal(repeatsTitle(e.coverAlt, e.title), false, `${e.section}/${e.slug} : coverAlt reprend le titre « ${e.title} »`);
    assert.ok(e.coverAlt && e.coverAlt.length >= 30, `${e.section}/${e.slug} : coverAlt trop court`);
    assert.match(e.coverAlt, /[a-zàâçéèêëîïôûùüÿœ]{3,} (de|du|des|la|le|les|un|une|sur|dans|au|aux|à) /i,
      `${e.section}/${e.slug} : coverAlt ne ressemble pas à une phrase française`);
    assert.doesNotMatch(e.coverAlt, /^(image|illustration|photo) (de|d’|d')/i, `${e.slug} : « image de » est superflu`);
  }
});

test('R5 — aucun fichier de public/illustrations/ sans fiche ni bandeau qui l’utilise', () => {
  const used = new Set();
  for (const e of illustrated) { used.add(e.cover); used.add(coverCardSrc(e.cover)); }
  const pages = readdirSync(join(FRONT, 'src/pages')).filter((f) => f.endsWith('.astro'));
  for (const p of pages) {
    for (const m of readFileSync(join(FRONT, 'src/pages', p), 'utf8').matchAll(/cover="(\/illustrations\/[^"]+)"/g)) used.add(m[1]);
  }
  const dir = join(PUBLIC, 'illustrations');
  const orphans = readdirSync(dir).flatMap((s) =>
    statSync(join(dir, s)).isDirectory() ? readdirSync(join(dir, s)).map((f) => `/illustrations/${s}/${f}`) : [`/illustrations/${s}`])
    .filter((f) => !used.has(f));
  assert.deepEqual(orphans, []);
});

test('R6 — la page À propos dit d’où viennent les images', () => {
  const about = readFileSync(join(FRONT, 'src/pages/about.astro'), 'utf8').replace(/\s+/g, ' ');
  assert.match(about, /illustration générée pour Eywa/);
  // L63 : œuvres de fan guidées par des images officielles, jamais affichées ni hébergées, © aux ayants droit.
  for (const re of [/œuvres de fan/, /IP-Adapter/, /20th Century Studios/, /références seulement/,
    /jamais être affichées ni hébergées/, /© leurs ayants droit/]) assert.match(about, re);
});

test('R8 — illustrations guidées par IP-Adapter (L63) : réglages notés, références hors du dépôt, lien Pandorapedia', () => {
  assert.deepEqual(GUIDEES.map((e) => e.fiche).sort(), ['bestiaire/ikran', 'bestiaire/pali', 'bestiaire/thanator']);
  const publics = readdirSync(join(PUBLIC, 'illustrations'), { recursive: true }).map(String);
  for (const e of GUIDEES) {
    assert.ok(e.prompt && e.neg && Number.isInteger(e.graine), `${e.fiche} : prompt, négatif, graine`);
    assert.ok(e.ip_adapter.echelle > 0 && e.ip_adapter.echelle <= 1, `${e.fiche} : échelle IP-Adapter`);
    assert.ok(e.ip_adapter.references.length >= 1, `${e.fiche} : au moins une référence`);
    for (const r of e.ip_adapter.references) {
      assert.match(r.page, /^https:\/\/www\.avatar\.com\/pandorapedia\/[a-z0-9-]+$/, `${e.fiche} : page de la référence`);
      assert.match(r.image, /^https:\/\//, `${e.fiche} : URL de l’image de référence`);
      const nom = r.image.split('/').pop();
      assert.ok(!publics.some((f) => f.endsWith(nom)), `${e.fiche} : la référence ${nom} ne doit pas être servie`);
    }
    const [section, slug] = e.fiche.split('/');
    const fiche = entries.find((x) => x.section === section && x.slug === slug);
    assert.equal(fiche.pandorapedia, e.pandorapedia, `${e.fiche} : champ pandorapedia de la fiche`);
    assert.equal(fiche.coverAlt, e.alt, `${e.fiche} : coverAlt = alt de illustrations.json`);
  }
  // Aucun fichier image de référence versionné dans le dépôt.
  const suivis = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n');
  const noms = GUIDEES.flatMap((e) => e.ip_adapter.references.map((r) => r.image.split('/').pop()));
  assert.deepEqual(suivis.filter((f) => noms.some((n) => f.endsWith(n))), []);
});

test('R7 — site construit : la carte charge la taille carte, la fiche décrit son image, le reste garde le visuel par défaut', { timeout: 60_000 }, async (t) => {
  const env = await setupBrowser(t);
  if (!env) return;
  const page = await env.browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${env.base}/pandora/`, { waitUntil: 'load' });
  const cards = await page.$$eval('.entry-card', (cs) => cs.map((c) => ({
    src: c.querySelector('img')?.getAttribute('src'), alt: c.querySelector('img')?.getAttribute('alt'),
    fallback: !!c.querySelector('.cover-fallback'),
  })));
  assert.equal(cards.length, 8);
  for (const c of cards) {
    assert.match(c.src ?? '', /^\/illustrations\/pandora\/[a-z0-9-]+-carte\.webp$/);
    assert.equal(c.alt, '', 'image de carte décorative : le titre nomme le lien');
    assert.equal(c.fallback, false);
  }
  // Les images se chargent pour de bon (pas de 404).
  const broken = await page.$$eval('.entry-card img, .section-hero img', async (imgs) => {
    await Promise.all(imgs.map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); }));
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  });
  assert.deepEqual(broken, []);

  const e = illustrated.find((x) => x.section === 'pandora' && x.slug === 'eywa');
  await page.goto(`${env.base}/pandora/eywa/`, { waitUntil: 'load' });
  const banner = page.locator('[data-lightbox] img');
  assert.equal(await banner.getAttribute('src'), e.cover);
  assert.equal(await banner.getAttribute('alt'), e.coverAlt);

  // Bandeau sans lien officiel : pas de légende.
  assert.equal(await page.locator('main figcaption').count(), 0);

  // L63 : une créature guidée par les images officielles porte sa légende et son lien Pandorapedia.
  for (const g of GUIDEES) {
    await page.goto(`${env.base}/${g.fiche}/`, { waitUntil: 'load' });
    const lien = page.locator('main figure figcaption a');
    assert.equal(await lien.count(), 1, `${g.fiche} : un lien sous le bandeau`);
    assert.equal(await lien.getAttribute('href'), g.pandorapedia);
    assert.match((await lien.innerText()).trim(), /^Fiche officielle sur Pandorapedia/);
    assert.equal(await page.locator('main figure [data-lightbox] img').getAttribute('alt'), g.alt);
  }

  const bare = entries.find((x) => !isIllustration(x.cover));
  if (bare) {
    await page.goto(`${env.base}/${bare.section}/${bare.slug}/`, { waitUntil: 'load' });
    assert.equal(await page.locator('main .cover-fallback').count(), 1, `${bare.section}/${bare.slug} : visuel par défaut`);
  }
});
