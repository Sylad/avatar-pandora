// L52 — miniature d'une vidéo : la haute définition n'est demandée que si la vidéo en a une.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { thumbFor, maxresFor } from '../frontend/src/lib/video-thumb.ts';

const id = 'muEMyQAJreg';

test('R1 — une vidéo sans haute définition (maxres: false) n\'en demande jamais l\'adresse', () => {
  assert.equal(maxresFor(id, false), undefined);
  assert.equal(thumbFor(id, undefined), `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
});

test('R2 — par défaut (maxres absent) l\'amélioration vers maxresdefault reste proposée', () => {
  assert.equal(maxresFor(id, undefined), `https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
  assert.equal(maxresFor(id, true), `https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
});

test('R3 — une miniature déclarée dans la fiche prime sur hqdefault', () => {
  assert.equal(thumbFor(id, 'https://exemple.test/a.jpg'), 'https://exemple.test/a.jpg');
});

test('R4 — la vidéo muEMyQAJreg (maxresdefault en 404) est déclarée maxres: false dans sa fiche', () => {
  const dir = new URL('../frontend/src/content/videos-list/', import.meta.url);
  const f = readdirSync(dir).find((n) => readFileSync(new URL(n, dir), 'utf8').includes(`videoId: "${id}"`));
  assert.ok(f, 'fiche introuvable');
  assert.match(readFileSync(new URL(f, dir), 'utf8'), /^maxres: false$/m);
});
