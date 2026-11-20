// L32 — logique pure de la mousse qui s'allume au toucher (frontend/src/lib/bio-moss.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOSS_LIFE_MS, MOSS_SPREAD_MS, MOSS_STEP_MS, MOSS_STEP_PX, mossKeyframes, mossLevel, mossSprite, seededRandom,
  shouldSpawn,
} from '../frontend/src/lib/bio-moss.ts';

test('une tache s’étend puis s’éteint en ~3 s', () => {
  assert.ok(MOSS_LIFE_MS >= 2500 && MOSS_LIFE_MS <= 3500);
  assert.deepEqual(mossLevel(-5), mossLevel(0), 'image horodatée juste avant la naissance');
  assert.equal(mossLevel(MOSS_LIFE_MS), null);
  const start = mossLevel(0);
  assert.equal(start.alpha, 0);
  assert.ok(start.scale < 0.5);
  const full = mossLevel(MOSS_SPREAD_MS);
  assert.equal(full.alpha, 1);
  assert.equal(full.scale, 1);
  // Le rayon ne fait que croître, l'intensité ne fait que baisser après l'extension.
  let prev = mossLevel(0);
  for (let age = 50; age < MOSS_LIFE_MS; age += 50) {
    const lv = mossLevel(age);
    assert.ok(lv.scale >= prev.scale);
    if (age > MOSS_SPREAD_MS) assert.ok(lv.alpha <= prev.alpha);
    prev = lv;
  }
  assert.ok(mossLevel(MOSS_LIFE_MS - 1).alpha < 0.001);
});

test('la souris allume une tache après assez de chemin et de temps', () => {
  const a = { x: 0, y: 0, t: 0 };
  assert.equal(shouldSpawn(null, a), true);
  assert.equal(shouldSpawn(a, { x: MOSS_STEP_PX, y: 0, t: MOSS_STEP_MS - 1 }), false, 'trop tôt');
  assert.equal(shouldSpawn(a, { x: MOSS_STEP_PX - 1, y: 0, t: 1000 }), false, 'trop près');
  assert.equal(shouldSpawn(a, { x: MOSS_STEP_PX, y: 0, t: MOSS_STEP_MS }), true);
});

test('mousse au repos : même tirage pour la même graine', () => {
  const [a, b] = [seededRandom(32), seededRandom(32)];
  const xs = Array.from({ length: 20 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('images clés : de l’allumage à l’extinction, intensité bornée par la force du geste', () => {
  const kf = mossKeyframes(0.75);
  assert.equal(kf[0].offset, 0);
  assert.equal(kf.at(-1).offset, 1);
  assert.equal(kf[0].opacity, 0);
  assert.equal(kf.at(-1).opacity, 0, 'éteinte à la fin');
  assert.ok(kf.every((f) => f.opacity >= 0 && f.opacity <= 0.75));
  assert.ok(Math.max(...kf.map((f) => f.opacity)) === 0.75);
  assert.ok(kf.every((f) => /^scale\(\d\.\d{3}\)$/.test(f.transform)), 'transform seulement (compositeur)');
});

test('tache SVG : même graine, même dessin ; couleurs du site, aucune ressource externe', () => {
  const a = mossSprite(10, [95, 255, 230]);
  assert.equal(a, mossSprite(10, [95, 255, 230]));
  assert.notEqual(a, mossSprite(11, [95, 255, 230]));
  assert.match(a, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(a, /rgb\(95,255,230\)/);
  assert.equal((a.match(/<circle /g) ?? []).length, 91);
  assert.doesNotMatch(a, /href|<image|<script/);
});
