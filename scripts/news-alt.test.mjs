// L51 — texte alternatif d'une capture des Nouveautés : celui déclaré dans l'entrée prime,
// le texte généré à partir du titre n'est qu'un repli.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureAlt } from '../frontend/src/lib/news-alt.ts';

const e = (captures, alts) => ({ title: 'Un titre', captures, alts });

test('R1 — le texte alternatif déclaré dans l’entrée est celui de l’image', () => {
  assert.equal(captureAlt(e(['a.png'], ['Le haut de la page Clans']), 0), 'Le haut de la page Clans');
});

test('R2 — plusieurs captures : chacune reçoit son propre texte, dans l’ordre', () => {
  const x = e(['a.png', 'b.png'], ['Première', 'Seconde']);
  assert.equal(captureAlt(x, 0), 'Première');
  assert.equal(captureAlt(x, 1), 'Seconde');
});

test('R3 — sans texte déclaré (clé absente), repli sur le titre : une seule capture', () => {
  assert.equal(captureAlt({ title: 'Un titre', captures: ['a.png'] }, 0), 'Capture d\'écran : Un titre');
});

test('R4 — repli numéroté quand il y a plusieurs captures', () => {
  assert.equal(captureAlt(e(['a.png', 'b.png'], []), 1), 'Capture d\'écran 2 sur 2 : Un titre');
});

test('R5 — texte vide ou blanc ou absent pour cette capture seule → repli, les autres gardent le leur', () => {
  const x = e(['a.png', 'b.png', 'c.png'], ['Déclaré', '   ', '']);
  assert.equal(captureAlt(x, 0), 'Déclaré');
  assert.equal(captureAlt(x, 1), 'Capture d\'écran 2 sur 3 : Un titre');
  assert.equal(captureAlt(x, 2), 'Capture d\'écran 3 sur 3 : Un titre');
});

test('R6 — le texte déclaré est rendu tel quel, sans rognage de ses guillemets', () => {
  assert.equal(captureAlt(e(['a.png'], [' « Aller au contenu » ']), 0), '« Aller au contenu »');
});
