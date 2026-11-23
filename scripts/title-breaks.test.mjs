// L70 — coupures des titres du codex (frontend/src/lib/title-breaks.ts). Revue UX de L70 : titres en rem, césure
// française ; les mots que le dictionnaire de Chromium ne coupe pas (syllabe muette finale, noms na'vi) se cassaient
// lettre à lettre à 390 px texte 200 %. Attendu : les coupures de la division syllabique française, entre deux
// lettres, au moins 2 lettres avant et 3 après, jamais entre deux voyelles ni contre une apostrophe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOFT_HYPHEN, syllableBreaks, titleBreaks } from '../frontend/src/lib/title-breaks.ts';

const show = (s) => s.replaceAll(SOFT_HYPHEN, '-');

test('mots que Chromium ne coupe pas : coupés à leurs syllabes', () => {
  assert.equal(show(titleBreaks('Trois œuvres, vingt-cinq ans de Pandora')), 'Trois œu-vres, vingt-cinq ans de Pan-dora');
  assert.equal(show(titleBreaks('Les peuples')), 'Les peu-ples');
  assert.equal(show(titleBreaks('Arbres, réseaux et plantes sacrées')), 'Ar-bres, ré-seaux et plan-tes sa-crées');
  assert.equal(show(titleBreaks('jungle')), 'jun-gle');
  assert.equal(show(titleBreaks("Ateyo'itan")), "Ateyo'i-tan");
});

test('digraphes et groupes inséparables', () => {
  assert.equal(show(titleBreaks('technologie')), 'tech-no-lo-gie');
  assert.equal(show(titleBreaks('hélicoptères')), 'hé-li-cop-tè-res');
  assert.equal(show(titleBreaks('aquatique')), 'aqua-ti-que');
  assert.equal(show(titleBreaks('Recombinants')), 'Re-com-bi-nants');
  assert.equal(show(titleBreaks('Montagnes')), 'Mon-ta-gnes');
  assert.equal(show(titleBreaks('Atmosphère')), 'At-mos-phère');
  assert.equal(show(titleBreaks('Woodsprites')), 'Woods-pri-tes');
});

test('rien entre deux voyelles, contre une apostrophe, ni pour une syllabe de moins de 3 lettres en fin', () => {
  assert.equal(show(titleBreaks('bioluminescente')), 'bio-lu-mi-nes-cente'); // « io » reste entier, « te » trop court
  assert.equal(titleBreaks('Eywa'), 'Eywa');
  assert.equal(show(titleBreaks("d'Omatikaya")), "d'Oma-ti-kaya");
  assert.deepEqual(syllableBreaks("Ateyo'a"), []);
  assert.equal(titleBreaks('Avatar'), 'Ava­tar');
  assert.equal(titleBreaks('Metkayina'), 'Met­kayina');
});
