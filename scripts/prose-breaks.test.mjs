// L74 — texte des fiches du codex et des Nouveautés (frontend/src/lib/prose-breaks.ts). Chromium ne césure pas un mot
// collé à une espace insécable (« « bioluminescente » » cassé sans trait, « bioluminescen|te », à 320 px texte
// 200 %) : ce mot est isolé dans un `<span>`. Intertitres : boîtes de mots comme les titres (L73), en deux versions
// (texte d'origine hors du gabarit étroit), nom accessible sans U+00AD.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proseHtml, proseSegments } from '../frontend/src/lib/prose-breaks.ts';

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
