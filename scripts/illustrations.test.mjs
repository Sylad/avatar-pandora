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
/** L63 (19-11-2026) au bestiaire, L64 (D-4, 20-11-2026) partout : images officielles des films, source et crédit tracés. */
const FILMS_TOUS = JSON.parse(readFileSync(join(REPO, 'scripts/illustrations/films.json'), 'utf8'));
/** Images posées ; les refusées (`"retenue": false`, avec leur raison) gardent leur traçabilité mais ne sont jamais servies. */
const FILMS = FILMS_TOUS.filter((f) => f.retenue !== false);
const REFUSEES = FILMS_TOUS.filter((f) => f.retenue === false);
const CREDIT = '© 20th Century Studios';
/** Entrée gardée pour être refaite mais posée sur aucune fiche (`"branchee": false`, bestiaire depuis le 19-11-2026). */
const branchee = (e) => e.branchee !== false;
const CONTENT = join(FRONT, 'src/content');
const PUBLIC = join(FRONT, 'public');
const SECTIONS = ['pandora', 'clans', 'bestiaire', 'flore', 'engins', 'films', 'personnages'];
/** L64 : seules ces fiches d'ambiance gardent une illustration générée (SDXL) ; elles ne nomment ni lieu, ni être, ni objet précis des films. */
const AMBIANCES = ['clans/anurai', 'clans/tipani', 'pandora/atmosphere', 'pandora/bioluminescent-night'];
/** L64 : fiches sans image officielle sûre, au visuel par défaut plutôt qu'avec une image fausse. */
const SANS_IMAGE = ['bestiaire/glow-snake', 'pandora/moara-valley'];
// Cloudflare Pages refuse un fichier de plus de 25 Mo ; on vise bien plus léger.
const MAX_FICHE = 250 * 1024;
const MAX_CARTE = 90 * 1024;
const MAX_TOTAL = 12 * 1024 * 1024;

function frontmatter(file) {
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const get = (k) => m[1].match(new RegExp(`^${k}:\\s*"(.*)"\\s*$`, 'm'))?.[1];
  return { title: get('title'), cover: get('cover'), coverAlt: get('coverAlt'), coverCredit: get('coverCredit'), pandorapedia: get('pandorapedia') };
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

test('R2 — section Pandora (accueil du codex) : 8 fiches, toutes illustrées sauf la vallée Mo’ara (aucune image officielle sûre, L64)', () => {
  const pandora = entries.filter((e) => e.section === 'pandora');
  assert.equal(pandora.length, 8);
  assert.deepEqual(pandora.filter((e) => !isIllustration(e.cover)).map((e) => e.slug), ['moara-valley']);
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

test('R6 — la page À propos dit d’où viennent les images : officielles des films partout, générées pour quelques ambiances', () => {
  const about = readFileSync(join(FRONT, 'src/pages/about.astro'), 'utf8').replace(/\s+/g, ' ');
  // L64 (D-4, 20-11-2026) : chaque fiche montre son sujet tel qu'il est dans les films, avec le crédit.
  assert.match(about, /tel qu'on le voit dans les films/);
  assert.match(about, /illustration générée pour Eywa/);
  assert.match(about, /© 20th Century Studios/);
  assert.match(about, /visuel par défaut/);
  for (const re of [/œuvres de fan/, /IP-Adapter/, /aucune image des films/, /jamais un visage d'acteur/, /Hors bestiaire/]) assert.doesNotMatch(about, re);
});

test('R9 — fiches sans image : seulement celles sans image officielle sûre (glow snake, vallée Mo’ara)', () => {
  const sans = entries.filter((e) => !isIllustration(e.cover)).map((e) => `${e.section}/${e.slug}`).sort();
  const bestiaire = entries.filter((e) => e.section === 'bestiaire').map((e) => `${e.section}/${e.slug}`);
  assert.equal(bestiaire.length, 14);
  const sansFilm = bestiaire.filter((f) => !FILMS.some((x) => x.fiche === f));
  assert.deepEqual(sansFilm, ['bestiaire/glow-snake']);
  assert.deepEqual(sans, SANS_IMAGE);
});

test('R13 — L64 : chaque fiche illustrée montre une image officielle des films, sauf les ambiances listées ; tous les personnages ont leur portrait', () => {
  for (const e of illustrated) {
    const fiche = `${e.section}/${e.slug}`;
    const film = FILMS.find((x) => x.fiche === fiche);
    if (AMBIANCES.includes(fiche)) {
      assert.equal(film, undefined, `${fiche} : ambiance`);
      assert.equal(e.coverCredit, undefined, `${fiche} : pas de crédit sur une illustration générée`);
      assert.ok(SOURCES.some((x) => x.fiche === fiche && branchee(x)), `${fiche} : illustration générée tracée`);
      continue;
    }
    assert.ok(film, `${fiche} : image sans source officielle tracée dans films.json`);
    assert.equal(e.coverAlt, film.alt, `${fiche} : coverAlt = alt de films.json`);
    assert.equal(e.coverCredit, CREDIT, `${fiche} : crédit`);
    // Une image de Pandorapedia renvoie à sa page (champ `pandorapedia` de la fiche, posé par films.py).
    if (film.source.type === 'pandorapedia') assert.ok(e.pandorapedia, `${fiche} : lien Pandorapedia`);
  }
  // Les illustrations générées remplacées restent tracées mais ne sont plus posées.
  const posees = SOURCES.filter(branchee).map((x) => x.fiche).sort();
  assert.deepEqual(posees, AMBIANCES);
  // Personnages : portrait ou plan officiel pour tous (décision de Sylvain du 20-11-2026, humains compris).
  const perso = entries.filter((e) => e.section === 'personnages');
  assert.deepEqual(perso.filter((e) => !FILMS.some((x) => x.fiche === `personnages/${e.slug}`)).map((e) => e.slug), []);
});

test('R10 — bestiaire : une image n’y est posée que si films.json en trace la source et le crédit ; jamais une image générée', () => {
  const publics = readdirSync(join(PUBLIC, 'illustrations'), { recursive: true }).map(String);
  for (const e of entries.filter((x) => x.section === 'bestiaire')) {
    const fiche = `${e.section}/${e.slug}`;
    const film = FILMS.find((x) => x.fiche === fiche);
    if (film) {
      assert.equal(e.cover, `/illustrations/${fiche}.webp`, `${fiche} : cover`);
      assert.equal(e.coverAlt, film.alt, `${fiche} : coverAlt = alt de films.json`);
      assert.equal(e.coverCredit, CREDIT, `${fiche} : crédit dans le front matter`);
      continue;
    }
    assert.equal(e.cover, undefined, `${fiche} : cover sans source tracée dans films.json`);
    assert.equal(e.coverAlt, undefined, `${fiche} : coverAlt sans image`);
    assert.deepEqual(publics.filter((f) => f.startsWith(`${fiche}.`) || f.startsWith(`${fiche}-carte.`)), [], `${fiche} : WebP servi sans source`);
  }
  // Les anciennes entrées générées (SDXL, IP-Adapter) restent non branchées : la génération est abandonnée pour les créatures.
  const sources = SOURCES.filter((x) => x.fiche.startsWith('bestiaire/'));
  assert.equal(sources.length, 14);
  assert.deepEqual(sources.filter(branchee).map((x) => x.fiche), []);
  // Le bandeau de la section n’en reprend aucune.
  assert.doesNotMatch(readFileSync(join(FRONT, 'src/pages/bestiaire.astro'), 'utf8'), /cover="/);
});

test('R12 — images refusées par Sylvain le 20-11 : traçabilité gardée, raison notée, jamais posées (L64 : remplacées par l’image officielle de Pandorapedia)', () => {
  assert.deepEqual(REFUSEES.map((f) => f.fiche).sort(), ['bestiaire/akula', 'bestiaire/hexapede', 'bestiaire/nantang']);
  for (const f of REFUSEES) {
    assert.equal(f.raison, 'modèle 3D sur grille, refusé par Sylvain le 20-11', `${f.fiche} : raison`);
    const e = entries.find((x) => `${x.section}/${x.slug}` === f.fiche);
    assert.ok(e.pandorapedia, `${f.fiche} : le lien Pandorapedia reste`);
    const retenue = FILMS.find((x) => x.fiche === f.fiche);
    assert.equal(retenue?.source.type, 'pandorapedia', `${f.fiche} : image officielle retenue à la place`);
    assert.notEqual(retenue.source.fichier, f.source.fichier, `${f.fiche} : jamais le plan refusé`);
    assert.equal(e.coverAlt, retenue.alt, `${f.fiche} : l’image posée est la retenue`);
  }
  // films.py ne refait jamais une image refusée.
  assert.match(readFileSync(join(REPO, 'scripts/illustrations/films.py'), 'utf8'), /e\.get\("retenue"\) is False/);
});

test('R11 — films.json : chaque image du film a une source exacte, un crédit et une fiche réelle', () => {
  assert.ok(FILMS.length >= 1);
  const vues = new Set();
  for (const f of FILMS) {
    assert.ok(!vues.has(f.fiche), `${f.fiche} : deux images retenues`); vues.add(f.fiche);
  }
  for (const f of FILMS_TOUS) {
    assert.match(f.fiche, new RegExp(`^(${SECTIONS.join('|')})/[a-z0-9-]+$`), `${f.fiche} : section du codex`);
    assert.ok(entries.some((e) => `${e.section}/${e.slug}` === f.fiche), `${f.fiche} : fiche absente`);
    assert.equal(f.credit, CREDIT, `${f.fiche} : crédit`);
    const s = f.source;
    assert.ok(['sylvain', 'pandorapedia', 'video', 'film'].includes(s.type), `${f.fiche} : type de source ${s.type}`);
    assert.ok(s.fichier && !s.fichier.startsWith('/') && !s.fichier.includes('..'), `${f.fiche} : fichier source relatif au dossier des références`);
    if (s.type === 'sylvain') assert.match(s.fichier, /^[a-z-]+\/sylvain_[a-z0-9_]+\.png$/, `${f.fiche} : fichier de Sylvain`);
    if (s.type === 'pandorapedia') {
      assert.match(s.image, /^https:\/\/lumiere-a\.akamaihd\.net\/v1\/images\/[\w.-]+$/, `${f.fiche} : URL de l’image officielle`);
      assert.ok(s.image.endsWith(s.fichier.split('/').pop()), `${f.fiche} : le fichier est l’image de l’URL`);
      assert.match(s.page, /^https:\/\/www\.avatar\.com\/pandorapedia\/[a-z0-9-]+$/, `${f.fiche} : page Pandorapedia`);
    }
    if (s.type === 'film') {
      // L64 : plan officiel publié sur la page du film (avatar.com/movies/…).
      assert.match(s.image, /^https:\/\/lumiere-a\.akamaihd\.net\/v1\/images\/[\w.-]+$/, `${f.fiche} : URL de l’image officielle`);
      assert.ok(s.image.endsWith(s.fichier.split('/').pop()), `${f.fiche} : le fichier est l’image de l’URL`);
      assert.match(s.page, /^https:\/\/www\.avatar\.com\/movies\/[a-z0-9-]+$/, `${f.fiche} : page du film`);
    }
    if (s.type === 'video') assert.ok(Number.isFinite(s.temps) && s.temps >= 0, `${f.fiche} : horodatage du plan`);
    for (const re of [/fandom/i, /pinterest/i, /deviantart/i, /artstation/i]) assert.doesNotMatch(JSON.stringify(s), re, `${f.fiche} : source interdite`);
  }
  // Aucune image source versionnée : seules les deux tailles WebP sont servies.
  const suivis = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n');
  const noms = FILMS_TOUS.map((f) => f.source.fichier.split('/').pop());
  assert.deepEqual(suivis.filter((x) => noms.some((n) => x.endsWith(n))), []);
});

test('R8 — anciens essais guidés par IP-Adapter (L63, abandonnés) : réglages notés, références hors du dépôt, lien Pandorapedia', () => {
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
    assert.equal(branchee(e), false, `${e.fiche} : un essai généré ne se rebranche pas sur une créature`);
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
  assert.equal(cards.filter((c) => c.fallback && !c.src).length, 1, 'vallée Mo’ara au visuel par défaut');
  for (const c of cards.filter((x) => !x.fallback)) {
    assert.match(c.src ?? '', /^\/illustrations\/pandora\/[a-z0-9-]+-carte\.webp$/);
    assert.equal(c.alt, '', 'image de carte décorative : le titre nomme le lien');
  }
  // Les images se chargent pour de bon (pas de 404).
  const broken = await page.$$eval('.entry-card img, .section-hero img', async (imgs) => {
    await Promise.all(imgs.map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); }));
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  });
  assert.deepEqual(broken, []);

  // L64 : seule une ambiance générée garde un bandeau sans crédit ni lien officiel.
  const e = illustrated.find((x) => x.section === 'pandora' && x.slug === 'atmosphere');
  await page.goto(`${env.base}/pandora/atmosphere/`, { waitUntil: 'load' });
  const banner = page.locator('[data-lightbox] img');
  assert.equal(await banner.getAttribute('src'), e.cover);
  assert.equal(await banner.getAttribute('alt'), e.coverAlt);

  // Bandeau sans lien officiel : pas de légende.
  assert.equal(await page.locator('main figcaption').count(), 0);

  // L63 : une image des films porte le crédit en légende (et dans la visionneuse), puis le lien Pandorapedia.
  for (const f of FILMS) {
    const e = entries.find((x) => `${x.section}/${x.slug}` === f.fiche);
    await page.goto(`${env.base}/${f.fiche}/`, { waitUntil: 'load' });
    const img = page.locator('main figure [data-lightbox] img');
    assert.equal(await img.getAttribute('src'), `/illustrations/${f.fiche}.webp`, `${f.fiche} : image`);
    assert.equal(await img.getAttribute('alt'), f.alt, `${f.fiche} : alt`);
    const legende = (await page.locator('main .entry-cover-caption').innerText()).replace(/\s+/g, ' ').trim();
    assert.ok(legende.startsWith(CREDIT), `${f.fiche} : légende « ${legende} »`);
    assert.doesNotMatch(legende, /Illustration de fan/);
    if (e.pandorapedia) {
      const lien = page.locator('main .entry-cover-caption a');
      assert.equal(await lien.getAttribute('href'), e.pandorapedia, `${f.fiche} : lien Pandorapedia`);
      assert.match((await lien.innerText()).trim(), /^Fiche officielle sur Pandorapedia/);
    }
  }
  // La visionneuse reprend la description puis le crédit.
  await page.goto(`${env.base}/bestiaire/ikran/`, { waitUntil: 'load' });
  await page.locator('main [data-lightbox] img').click();
  const cap = (await page.locator('.eywa-lightbox__caption').innerText()).trim();
  assert.equal(cap, `${FILMS.find((f) => f.fiche === 'bestiaire/ikran').alt} — ${CREDIT}`);
  await page.keyboard.press('Escape');

  // Fiches sans image officielle sûre : visuel par défaut, aucun crédit, le lien Pandorapedia reste.
  for (const fiche of SANS_IMAGE) {
    await page.goto(`${env.base}/${fiche}/`, { waitUntil: 'load' });
    assert.equal(await page.locator('main .cover-fallback').count(), 1, `${fiche} : visuel par défaut`);
    assert.equal(await page.getByText(CREDIT).count(), 0, `${fiche} : aucun crédit`);
    assert.equal(await page.locator('main img[src*="/illustrations/"]').count(), 0, `${fiche} : aucune image`);
    const e = entries.find((x) => `${x.section}/${x.slug}` === fiche);
    if (e.pandorapedia) assert.equal(await page.locator(`main a[href="${e.pandorapedia}"]`).count() >= 1, true, `${fiche} : lien Pandorapedia`);
  }

  // Liste du bestiaire : cartes en taille carte pour les images des films, visuel par défaut sinon, et le crédit sous la liste.
  await page.goto(`${env.base}/bestiaire/`, { waitUntil: 'load' });
  const liste = await page.$$eval('.entry-card', (cs) => cs.map((c) => ({
    href: c.getAttribute('href'), src: c.querySelector('img')?.getAttribute('src') ?? null, fallback: !!c.querySelector('.cover-fallback'),
  })));
  assert.equal(liste.length, 14);
  for (const c of liste) {
    const fiche = c.href.replace(/^\/|\/$/g, '');
    if (FILMS.some((f) => f.fiche === fiche)) assert.equal(c.src, `/${'illustrations'}/${fiche}-carte.webp`, fiche);
    else assert.ok(c.fallback && !c.src, `${fiche} : visuel par défaut`);
  }
  assert.equal(liste.filter((c) => c.fallback).length, 1, 'une créature au visuel par défaut (glow snake)');
  const cassees = await page.$$eval('.entry-card img', async (imgs) => {
    await Promise.all(imgs.map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); }));
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  });
  assert.deepEqual(cassees, []);
  assert.equal((await page.locator('main .section-credit').innerText()).trim(), `Images des créatures : ${CREDIT}`);
  assert.equal(await page.locator('.section-hero img').count(), 0);

  // L64 : chaque liste dont les cartes montrent des images des films porte la ligne de crédit.
  for (const s of ['pandora', 'clans', 'flore', 'engins', 'films', 'personnages']) {
    await page.goto(`${env.base}/${s}/`, { waitUntil: 'load' });
    assert.match((await page.locator('main .section-credit').innerText()).trim(), new RegExp(`^Images officielles des films.* : ${CREDIT}$`), `${s} : crédit sous la liste`);
  }

  const bare = entries.find((x) => !isIllustration(x.cover));
  if (bare) {
    await page.goto(`${env.base}/${bare.section}/${bare.slug}/`, { waitUntil: 'load' });
    assert.equal(await page.locator('main .cover-fallback').count(), 1, `${bare.section}/${bare.slug} : visuel par défaut`);
  }
});
