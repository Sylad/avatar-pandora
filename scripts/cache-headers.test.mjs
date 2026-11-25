// L82 — cache des pages. Une page HTML doit être revalidée à chaque visite : jusqu'au 25-11-2026,
// la règle d'images `/films/*` de frontend/public/_headers (dossier public/films/ disparu depuis)
// servait les pages /films/…/ avec « max-age=2592000 » (30 jours), et la QA de L78 voyait en prod des
// pages de deux versions plus anciennes. Le HTML n'a donc aucune règle Cache-Control : le défaut de
// Cloudflare Pages (max-age=0, must-revalidate, ETag) s'applique. Ce test lit _headers comme Pages
// (un `*` couvre tout, `/` compris ; `:nom` couvre un segment) et l'applique à chaque page de dist/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HEADERS = join(ROOT, 'frontend/public/_headers');
const DIST = join(ROOT, 'frontend/dist');

export function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [], detach: [] });
    } else {
      // « ! Nom » détache un en-tête posé par les autres règles qui couvrent le chemin (doc Pages).
      const detach = line.trim().match(/^!\s*([^:\s]+)$/);
      const m = detach ? null : line.trim().match(/^([^:]+):\s*(.*)$/);
      assert.ok((detach || m) && rules.length, `ligne d'en-tête illisible dans _headers : « ${line} »`);
      if (detach) rules.at(-1).detach.push(detach[1].toLowerCase());
      else rules.at(-1).headers.push({ name: m[1].trim().toLowerCase(), value: m[2] });
    }
  }
  return rules;
}

function patternRegex(pattern) {
  const body = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (part.startsWith(':')) return '[^/]+';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${body}$`);
}

export function cacheControlsFor(rules, path) {
  const matching = rules.filter((r) => patternRegex(r.pattern).test(path));
  // Une règle qui détache Cache-Control efface les valeurs des AUTRES règles ; les siennes restent.
  const detachers = new Set(matching.filter((r) => r.detach.includes('cache-control')));
  return matching
    .filter((r) => detachers.size === 0 || detachers.has(r))
    .flatMap((r) => r.headers.filter((h) => h.name === 'cache-control').map((h) => ({ pattern: r.pattern, value: h.value })));
}

export function maxAge(value) {
  // Le plus grand de max-age et s-maxage (cache du CDN) : l'un ou l'autre suffit à garder une page.
  const ages = [...value.matchAll(/(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*(\d+)/gi)].map((m) => Number(m[1]));
  return ages.length ? Math.max(...ages) : null;
}

function htmlRoutes(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return htmlRoutes(p);
    if (!f.endsWith('.html')) return [];
    const rel = '/' + relative(DIST, p).split(sep).join('/');
    // Pages sert /x/index.html à /x/ (et redirige /x et /x/index.html vers /x/) : on teste les trois.
    if (rel.endsWith('/index.html')) {
      const base = rel.slice(0, -'index.html'.length);
      return base === '/' ? ['/', '/index.html'] : [base, base.slice(0, -1), rel];
    }
    return [rel, rel.slice(0, -'.html'.length)];
  });
}

// Règles globales ou HTML qui posent un Cache-Control fautif : tout Cache-Control sur /*, un max-age > 0 ailleurs.
export function htmlRuleFaults(rules) {
  return rules
    .filter((r) => ['/*', '/*.html', '/*/', '/'].includes(r.pattern))
    .flatMap((r) => r.headers.filter((h) => h.name === 'cache-control').map((h) => ({ pattern: r.pattern, value: h.value })))
    .filter((h) => (maxAge(h.value) ?? 0) > 0 || h.pattern === '/*')
    .map((h) => `${h.pattern} → ${h.value}`);
}

const rules = parseHeaders(readFileSync(HEADERS, 'utf8'));

test('C1 — aucune règle globale ni HTML ne pose un max-age > 0', () => {
  assert.deepEqual(htmlRuleFaults(rules), [], 'une règle /* ou HTML pose Cache-Control (le HTML doit garder le défaut Pages, max-age=0)');
});

test('C2 — chaque page de dist/ est revalidée à chaque visite (aucun max-age > 0)', () => {
  assert.ok(existsSync(DIST), 'frontend/dist absent : lancer le build');
  const routes = htmlRoutes(DIST);
  assert.ok(routes.length >= 80 * 2, `${routes.length} adresses de pages seulement dans dist/`);
  // Témoin du défaut vu en prod le 25-11.
  assert.ok(routes.includes('/films/avatar-2009/'), 'la page /films/avatar-2009/ manque dans dist/');
  const fautes = [];
  for (const route of routes) {
    for (const cc of cacheControlsFor(rules, route)) {
      const age = maxAge(cc.value);
      if (age === null || age > 0 || !/must-revalidate|no-cache/i.test(cc.value)) {
        fautes.push(`${route} ← ${cc.pattern} : ${cc.value}`);
      }
    }
  }
  assert.deepEqual(fautes, []);
});

test('C3 — les ressources gardent un seul Cache-Control, long pour les fichiers à empreinte', () => {
  // Pages concatène les valeurs d'un même en-tête venues de plusieurs règles : une seule par chemin.
  const attendus = {
    '/_astro/BaseLayout.Ab12Cd34.css': 31536000,
    '/_astro/client.Ef56Gh78.js': 31536000,
    '/fonts/orbitron/orbitron-latin.woff2': 2592000,
    '/illustrations/films/avatar-2009.webp': 86400,
  };
  for (const [path, age] of Object.entries(attendus)) {
    const ccs = cacheControlsFor(rules, path);
    assert.equal(ccs.length, 1, `${path} : ${ccs.length} règles Cache-Control (${ccs.map((c) => c.pattern).join(', ')})`);
    assert.equal(maxAge(ccs[0].value), age, `${path} : ${ccs[0].value}`);
  }
  assert.match(cacheControlsFor(rules, '/_astro/x.Ab12Cd34.js')[0].value, /immutable/);
});

test('C4 — le lecteur de _headers suit la règle de Pages (garde-fou du test lui-même)', () => {
  const r = parseHeaders('/films/*\n  Cache-Control: public, max-age=2592000\n/a/:slug\n  X-A: 1\n');
  assert.equal(cacheControlsFor(r, '/films/avatar-2009/').length, 1, '`*` doit couvrir les sous-dossiers');
  assert.equal(cacheControlsFor(r, '/film/x').length, 0);
  assert.ok(patternRegex('/a/:slug').test('/a/b'));
  assert.ok(!patternRegex('/a/:slug').test('/a/b/c'));
  assert.equal(maxAge('public, max-age=2592000'), 2592000);
  assert.equal(maxAge('public, max-age=0, must-revalidate'), 0);
});

test('C5 — détachement « ! Cache-Control », s-maxage et valeur nue dans C1 (revue de L82)', () => {
  // Détachement documenté par Pages : lu, et il retire les valeurs des autres règles.
  const d = parseHeaders('/fonts/*\n  Cache-Control: public, max-age=2592000\n/fonts/x.woff2\n  ! Cache-Control\n  Cache-Control: public, max-age=60\n/fonts/y.woff2\n  ! Cache-Control\n');
  assert.deepEqual(d[1].detach, ['cache-control']);
  assert.deepEqual(cacheControlsFor(d, '/fonts/x.woff2').map((c) => c.value), ['public, max-age=60']);
  assert.deepEqual(cacheControlsFor(d, '/fonts/y.woff2'), []);
  assert.equal(cacheControlsFor(d, '/fonts/z.woff2').length, 1);
  assert.throws(() => parseHeaders('/a\n  pas un en-tête\n'), /illisible/);
  // s-maxage (cache du CDN) est lu, et compte s'il dépasse max-age.
  assert.equal(maxAge('public, s-maxage=600'), 600);
  assert.equal(maxAge('public, max-age=0, s-maxage=600'), 600);
  assert.equal(maxAge('s-max-age=600'), null);
  // C1 lit une valeur qui commence par max-age=, sans « public, » devant.
  assert.deepEqual(htmlRuleFaults(parseHeaders('/*.html\n  Cache-Control: max-age=300\n')), ['/*.html → max-age=300']);
  assert.deepEqual(htmlRuleFaults(parseHeaders('/*.html\n  Cache-Control: max-age=0, must-revalidate\n')), []);
  assert.equal(htmlRuleFaults(parseHeaders('/*\n  Cache-Control: no-cache\n')).length, 1);
});
