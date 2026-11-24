// L74 — texte des fiches du codex et des Nouveautés (frontend/src/lib/prose-breaks.ts). Chromium ne césure pas un mot
// collé à une espace insécable (« « bioluminescente » » cassé sans trait, « bioluminescen|te », à 320 px texte
// 200 %) : ce mot est isolé dans un `<span>`. Intertitres : boîtes de mots comme les titres (L73), en deux versions
// (texte d'origine hors du gabarit étroit), nom accessible sans U+00AD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSON_NAMES, proseHtml, proseSegments } from '../frontend/src/lib/prose-breaks.ts';
import { EXCEPTIONS } from '../frontend/src/lib/title-breaks.ts';

const SHY = '­';
const seg = (t) => proseSegments(t).map((s) => (s.word ? `[${s.text}]` : s.text)).join('');

test('proseSegments : mots de 7 lettres ou plus collés à une espace insécable, isolés', () => {
  assert.equal(seg('la nuit « bioluminescente » de Pandora'), 'la nuit « [bioluminescente] » de Pandora');
  assert.equal(seg('Personnages : le bandeau'), '[Personnages] : le bandeau');
  assert.equal(seg('« court »'), '« court »'); // moins de 7 lettres : il tient toujours
  assert.equal(seg("l'apostrophe « d'Omatikaya »"), "l'apostrophe « [d'Omatikaya] »");
  assert.equal(seg('rien de collé'), 'rien de collé');
  assert.equal(seg(''), '');
  assert.equal(proseSegments('a b').map((s) => s.text).join(''), 'a b');
});

test('proseHtml : texte courant, mots collés en <span> ; attributs, code et entités intacts', () => {
  assert.equal(proseHtml('<p>la «&nbsp;bioluminescente&nbsp;» nuit</p>'), '<p>la « <span>bioluminescente</span> » nuit</p>');
  assert.equal(proseHtml('<p>A &amp; B &lt;c&gt;</p>'), '<p>A &amp; B &lt;c&gt;</p>');
  const alt = '<p><img alt="la « bioluminescente »" src="x.webp"></p>';
  assert.equal(proseHtml(alt), alt);
  const code = '<pre><code>« bioluminescente »</code></pre>';
  assert.equal(proseHtml(code), code);
});

test('proseHtml : intertitre en deux versions, boîtes de mots coupables, nom accessible sans U+00AD', () => {
  const out = proseHtml('<h2>Morphologie</h2><p>texte</p>');
  assert.match(out, /^<h2 aria-label="Morphologie"><span class="title-plain">Morphologie<\/span><span class="title-boxed"><span class="title-word">Mor­pho­lo­gie<\/span><\/span><\/h2><p>texte<\/p>$/);
  // Un intertitre sans coupure reste tel quel, sans aria-label.
  assert.equal(proseHtml('<h3>Vie</h3>'), '<h3>Vie</h3>');
  // Balise dans l'intertitre gardée, nom accessible = texte.
  const em = proseHtml('<h2>La <em>bioluminescence</em></h2>');
  assert.match(em, /aria-label="La bioluminescence"/);
  assert.match(em, /<span class="title-boxed">La <em><span class="title-word">bio/);
  assert.ok(!/aria-label="[^"]*­/.test(em));
  // Nom de personne jamais coupé.
  assert.equal(proseHtml('<h2>Neytiri</h2>'), '<h2>Neytiri</h2>');
  assert.ok(!proseHtml('<h2>Neytiri</h2>').includes(SHY));
});

// L74 r1 (revue UX, M1) : la césure du navigateur coupait les noms de personnes du texte courant (« Qua-ritch »,
// « Ron-gloa » dans l'entrée L74 elle-même, à 320 px texte 200 %).
const names = (t) => proseSegments(t).map((s) => (s.name ? `{${s.text}}` : s.word ? `[${s.text}]` : s.text)).join('');

test('proseSegments : noms de personnes isolés comme noms, mot entier seulement', () => {
  assert.equal(names("l'arc dramatique de Quaritch, puis Neytiri"), "l'arc dramatique de {Quaritch}, puis {Neytiri}");
  assert.equal(names("Tsu'tey te Rongloa Ateyo'itan"), "{Tsu'tey} te {Rongloa} {Ateyo'itan}");
  assert.equal(names('Tsu’tey et d’Eytukan'), '{Tsu’tey} et d’{Eytukan}'); // apostrophe typographique, élision
  assert.equal(names('Spiderman, Parkers, quaritch'), 'Spiderman, Parkers, quaritch'); // jamais un morceau de mot
  // Collé à une espace insécable : nom, pas simple mot à césurer.
  assert.equal(names('«\u202FPayakan\u202F»'), '«\u202F{Payakan}\u202F»');
  assert.equal(names('«\u202Fbioluminescente\u202F» de Quaritch'), '«\u202F[bioluminescente]\u202F» de {Quaritch}');
});

test('proseHtml : nom de personne en <span class="prose-name">, hors des attributs et des intertitres', () => {
  assert.equal(proseHtml('<p>la mère de Neytiri</p>'), '<p>la mère de <span class="prose-name">Neytiri</span></p>');
  const alt = '<p><img alt="Neytiri" src="x.webp"></p>';
  assert.equal(proseHtml(alt), alt);
  assert.equal(proseHtml('<h2>Neytiri</h2>'), '<h2>Neytiri</h2>');
});

test('PERSON_NAMES : tous les noms de personnes jamais coupés des titres (EXCEPTIONS) y sont', () => {
  const listed = new Set(PERSON_NAMES.map((n) => n.toLowerCase()));
  const nonPersons = new Set(['tskaha']);
  const missing = Object.entries(EXCEPTIONS).filter(([k, v]) => !v.includes('-') && !nonPersons.has(k) && !listed.has(k)).map(([k]) => k);
  assert.deepEqual(missing, []);
});

// L77 (revue de code r2 de L74) : un nom élidé collé à une espace insécable (« « d'Eytukan » ») était pris
// par la sous-expression des mots collés, qui commence à « d' » : simple `<span>`, césurable.
test('proseSegments : nom élidé collé à une espace insécable, toujours un nom', () => {
  assert.equal(names("« d'Eytukan »"), "« d'{Eytukan} »");
  assert.equal(names('l’ombre d’Ateyo’itan'), '[l’ombre] d’{Ateyo’itan}');
  assert.equal(names("« Quaritch's »"), "« {Quaritch}'s »");
  assert.equal(proseHtml("<p>«&nbsp;d'Eytukan&nbsp;»</p>"), "<p>«\u00A0d'<span class=\"prose-name\">Eytukan</span>\u00A0»</p>");
});

// L77 : noms de 8 lettres ou plus du texte des fiches, absents de la liste à la revue UX r2 de L74.
test('PERSON_NAMES : noms des fiches ajoutés après L74, reconnus dans le texte', () => {
  for (const n of ['Rodriguez', 'Flatters', 'Michelle', 'Giovanni', "Mo'at'ite"]) assert.ok(PERSON_NAMES.includes(n), n);
  assert.equal(names('Interprétée par Michelle Rodriguez.'), 'Interprétée par {Michelle} {Rodriguez}.');
  assert.equal(names('Jamie Flatters, Giovanni Ribisi'), 'Jamie {Flatters}, {Giovanni} Ribisi');
  assert.equal(names('Neytiri te Tskaha Mo’at’ite'), '{Neytiri} te Tskaha {Mo’at’ite}');
});
