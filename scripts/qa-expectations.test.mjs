// L43 — docs/qa/expectations.md : le fichier existe, porte les pages attendues, et ses deux
// mesures sur les fiches (corps non vide, vide ≥ 16 px entre deux paragraphes) tiennent sur le site
// construit. Le volet navigateur lit frontend/dist ; skip sans playwright-core/Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST, setupBrowser } from './lib/e2e-dist.mjs';

const DOC = fileURLToPath(new URL('../docs/qa/expectations.md', import.meta.url));
const SECTIONS = ['pandora', 'clans', 'bestiaire', 'flore', 'personnages', 'films', 'engins'];

function titresDeSections(md) {
  return [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
}

test('R1 — expectations.md décrit l\'accueil, Nouveautés et une section par rubrique du codex', () => {
  assert.ok(existsSync(DOC), 'docs/qa/expectations.md est absent');
  const titres = titresDeSections(readFileSync(DOC, 'utf8'));
  for (const attendu of ['/', '/nouveautes/', ...SECTIONS.map((s) => `/${s}/<fiche>/`)]) {
    assert.ok(titres.includes(attendu), `section « ## ${attendu} » absente (trouvées : ${titres.join(', ')})`);
  }
});

test('R2 — chaque section de la page porte au moins une ligne « shows: » ou « never: »', () => {
  const md = readFileSync(DOC, 'utf8');
  const blocs = md.split(/^## /m).slice(1);
  assert.ok(blocs.length >= 9, `${blocs.length} sections`);
  for (const b of blocs) {
    const titre = b.split('\n')[0];
    assert.match(b, /^- (shows|never): /m, `« ## ${titre} » sans attendu`);
  }
});

function section(md, titre) {
  return (md.split(/^## /m).slice(1).find((b) => b.split('\n')[0].trim() === titre) ?? '');
}

const dist = (chemin) => join(DIST, chemin, 'index.html');

test('R5 — expectations.md porte une section /about/ dont chaque attendu se vérifie sur la page construite', (t) => {
  const bloc = section(readFileSync(DOC, 'utf8'), '/about/');
  assert.match(bloc, /^- (shows|never): /m, 'section « ## /about/ » absente ou sans attendu');
  if (!existsSync(dist('about'))) return t.skip('frontend/dist absent : lancer le build');
  const html = readFileSync(dist('about'), 'utf8');
  assert.match(bloc, /À propos — Eywa/);
  assert.ok(html.includes('<title>À propos — Eywa</title>'), 'titre de l\'onglet');
  assert.match(bloc, /Vibe coded avec Claude Code & Codex/);
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, 'h1 unique');
  assert.match(html, /<h1[^>]*>\s*<span lang="en"[^>]*>Vibe coded<\/span> avec Claude Code (&|&#38;|&amp;) Codex/);
  for (const h2 of ["L'histoire courte", 'Sous le capot', 'Sources & inspirations', 'Mes autres sites']) {
    assert.ok(bloc.includes(h2), `« ${h2} » absent de l'attendu`);
  }
  assert.equal([...html.matchAll(/<h2[ >]/g)].length, 4, 'h2 ×4');
  for (const classe of ['about-sources', 'about-sites']) {
    const ul = html.match(new RegExp(`<ul[^>]*class="${classe}[^"]*"[^>]*>([\\s\\S]*?)</ul>`));
    assert.ok(ul, `ul.${classe} absente`);
    assert.equal([...ul[1].matchAll(/<li[ >]/g)].length, 4, `ul.${classe} : 4 li`);
  }
  const sortants = [...html.matchAll(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.equal(sortants.length, 9, '9 liens sortants');
  for (const a of sortants) {
    assert.match(a, /href="https?:\/\//);
    assert.match(a, /\(nouvel onglet\)/);
  }
  assert.equal([...html.matchAll(/lang="en"/g)].length, 2, '[lang=en] ×2');
  assert.doesNotMatch(html, /ChatGPT/i);
});

test('R6 — la ligne du permalien de /nouveautes/ décrit ce que la page porte (id=<slug> + data-slug), pas un lien <a>', (t) => {
  const bloc = section(readFileSync(DOC, 'utf8'), '/nouveautes/');
  assert.doesNotMatch(bloc, /lien permanent `\/nouveautes\/#<slug>`/, 'ancienne formulation : aucun <a href="#…"> n\'existe');
  assert.match(bloc, /id=<slug>/);
  assert.match(bloc, /data-slug/);
  if (!existsSync(dist('nouveautes'))) return t.skip('frontend/dist absent : lancer le build');
  const html = readFileSync(dist('nouveautes'), 'utf8');
  const articles = [...html.matchAll(/<article [^>]*class="news-entry"[^>]*>/g)].map((m) => m[0]);
  assert.ok(articles.length > 0);
  for (const a of articles) assert.match(a, /id="[^"]+"/);
  const ids = articles.map((a) => a.match(/id="([^"]+)"/)[1]);
  const slugs = [...html.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(slugs, ids, 'data-slug de chaque bouton = id de son article');
});

test('R3 — la règle du seuil écrite dans expectations.md est celle que le test mesure (16 px, 390 et 1440)', () => {
  const md = readFileSync(DOC, 'utf8');
  assert.match(md, /16 px/);
  assert.match(md, /390/);
  assert.match(md, /1440/);
  assert.match(md, /\.entry-body/);
});

function fiches() {
  const out = [];
  for (const s of SECTIONS) {
    for (const d of readdirSync(join(DIST, s), { withFileTypes: true })) {
      if (d.isDirectory() && existsSync(join(DIST, s, d.name, 'index.html'))) out.push(`/${s}/${d.name}/`);
    }
  }
  return out;
}

for (const width of [390, 1440]) {
  test(`R4 — toutes les fiches @${width}px : .entry-body non vide et vide ≥ 16 px entre deux paragraphes voisins`, { timeout: 300_000 }, async (t) => {
    const env = await setupBrowser(t);
    if (!env) return;
    const page = await env.browser.newPage({ viewport: { width, height: 900 } });
    const urls = fiches();
    assert.ok(urls.length >= 60, `fiches trouvées : ${urls.length}`);
    for (const url of urls) {
      await page.goto(`${env.base}${url}`, { waitUntil: 'load' });
      const m = await page.evaluate(() => {
        const body = document.querySelector('article .entry-body');
        const ps = body ? [...body.querySelectorAll(':scope > p')] : [];
        return {
          present: !!body,
          texte: body ? body.textContent.trim().length : 0,
          gaps: ps.slice(1).map((p, i) => p.getBoundingClientRect().top - ps[i].getBoundingClientRect().bottom),
        };
      });
      assert.ok(m.present, `${url} : pas de .entry-body`);
      assert.ok(m.texte > 0, `${url} : .entry-body vide`);
      for (const g of m.gaps) assert.ok(g >= 16, `${url} : vide ${g.toFixed(1)} px entre deux paragraphes`);
    }
  });
}

test('R7 — expectations.md décrit /videos/ et /clans/ (lien d\'évitement, repères nommés, voile, 320 px) et les pages construites les portent', (t) => {
  const md = readFileSync(DOC, 'utf8');
  for (const chemin of ['/videos/', '/clans/']) {
    const bloc = section(md, chemin);
    assert.match(bloc, /^- (shows|never): /m, `section « ## ${chemin} » absente ou sans attendu`);
    assert.match(bloc, /Aller au contenu/, `${chemin} : lien d'évitement`);
    assert.match(bloc, /aria-label/, `${chemin} : repères nommés`);
    assert.match(bloc, /320/, `${chemin} : 320 px sans débordement`);
    assert.match(bloc, /scrollWidth/, `${chemin} : mesure du débordement`);
  }
  assert.match(section(md, '/videos/'), /codex-text-veil/, 'voile des intros de /videos/');
  assert.doesNotMatch(md, /Non couvert :[^]*`\/videos\/`/, '/videos/ n\'est plus « non couvert »');
  if (!existsSync(dist('videos')) || !existsSync(dist('clans'))) return t.skip('frontend/dist absent : lancer le build');
  const videos = readFileSync(dist('videos'), 'utf8');
  assert.match(videos, /Aller au contenu/);
  assert.equal([...videos.matchAll(/class="vid-section-intro codex-text-veil"/g)].length, 3, 'trois intros voilées');
  assert.match(readFileSync(dist('clans'), 'utf8'), /Aller au contenu/);
});
