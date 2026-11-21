// L32 — logique pure de la mousse qui s'allume au toucher (frontend/src/lib/bio-moss.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOSS_LIFE_MS, MOSS_SPREAD_MS, MOSS_STEP_MS, MOSS_STEP_PX, MOSS_TAP_LIFE_MS, MOSS_TAP_MS, MOSS_TAP_PX,
  SHIELD_FADE_PX, SHIELD_FEATHER, SHIELD_PAD_PX, isTap, mossKeyframes, mossLevel, mossSprite, seededRandom, shieldMask, shouldSpawn,
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

test('tache du toucher : points sur tout le disque, même graine même dessin', () => {
  const a = mossSprite(20, [95, 255, 230], { spread: true });
  assert.equal(a, mossSprite(20, [95, 255, 230], { spread: true }));
  assert.equal((a.match(/<circle /g) ?? []).length, 151);
  // Au moins un tiers des points dans l'anneau extérieur (rayon > 80 sur 128) : visibles autour du doigt.
  const far = [...a.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].filter(([, x, y]) => Math.hypot(x - 128, y - 128) > 80);
  assert.ok(far.length >= 50, `${far.length} points loin du centre`);
});

// Revue UX L32 (m1) : un glissement du doigt (défilement) allumait une tache.
test('toucher : bref et immobile seulement ; tache plus longue que celle de la souris', () => {
  const down = { x: 100, y: 100, t: 0 };
  assert.equal(isTap(down, { x: 103, y: 104, t: 120 }), true);
  assert.equal(isTap(down, { x: 100, y: 100 + MOSS_TAP_PX, t: 120 }), false, 'glissé');
  assert.equal(isTap(down, { x: 100, y: 100, t: MOSS_TAP_MS + 1 }), false, 'appui long');
  assert.ok(MOSS_TAP_LIFE_MS > MOSS_LIFE_MS && MOSS_TAP_LIFE_MS <= 5000);
});

// Revue UX L32 (B1) : la mousse passait sous le menu du codex. Masque noir sous chaque boîte protégée.
test('masque : noir plein sous les boîtes protégées qui touchent la tache, bord fondu ; rien sinon', () => {
  const cell = { x: 100, y: 200, w: 300, h: 300 };
  assert.equal(shieldMask(cell, []), null);
  assert.equal(shieldMask(cell, [{ x: 0, y: 0, w: 50, h: 50 }]), null, 'boîte loin de la tache');
  const svg = shieldMask(cell, [{ x: 150, y: 250, w: 100, h: 20 }, { x: 900, y: 900, w: 10, h: 10 }]);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="300\.0" height="300\.0"/);
  assert.match(svg, /<rect width="100%" height="100%" fill="#fff"\/><g fill="#000">/);
  // Dernière couche (dessinée au-dessus) : noir plein, boîte agrandie de SHIELD_PAD_PX.
  const layers = [...svg.matchAll(/<g opacity="([\d.]+)">(.*?)<\/g>/g)];
  assert.equal(layers.length, SHIELD_FEATHER.length + 1);
  const [, op, inner] = layers.at(-1);
  assert.equal(Number(op), 1);
  const rects = [...inner.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)];
  assert.equal(rects.length, 1, 'seule la boîte qui touche la tache');
  assert.deepEqual(rects[0].slice(1).map(Number), [50 - SHIELD_PAD_PX, 50 - SHIELD_PAD_PX, 100 + 2 * SHIELD_PAD_PX, 20 + 2 * SHIELD_PAD_PX]);
  // Le fondu est hors de la marge pleine, et sans filtre (rastérisé sur le fil principal).
  assert.ok(SHIELD_PAD_PX >= 4 && SHIELD_FEATHER.every(([d, o]) => d > SHIELD_PAD_PX && o < 1));
  assert.doesNotMatch(svg, /filter|feGaussianBlur/);
});

// D-6 : le fondu à deux paliers (2 px) laissait des aplats à bord net. Éclat de la mousse gardé à
// chaque distance du bord de la boîte = produit des transparences des couronnes qui la couvrent.
test('masque : fondu doux de 10 à 16 px, sans marche visible, union des boîtes sans surcharge', () => {
  const keep = (r) => SHIELD_FEATHER.reduce((k, [d, o]) => (r <= d ? k * (1 - o) : k), 1);
  assert.ok(SHIELD_FADE_PX >= 10 && SHIELD_FADE_PX <= 16, `largeur du fondu : ${SHIELD_FADE_PX} px`);
  assert.ok(keep(SHIELD_PAD_PX + 0.5) < 0.06, 'presque noir au sortir de la marge pleine');
  assert.ok(keep(SHIELD_PAD_PX + SHIELD_FADE_PX + 0.01) === 1, 'mousse entière au-delà du fondu');
  let prev = 0, worst = 0;
  for (let r = SHIELD_PAD_PX; r <= SHIELD_PAD_PX + SHIELD_FADE_PX + 1; r += 0.25) {
    const k = keep(r);
    assert.ok(k >= prev - 1e-9, `fondu monotone (${r} px)`);
    worst = Math.max(worst, k - prev);
    prev = k;
  }
  // Plus grande marche entre deux couronnes voisines : ≤ 20 % de l'éclat (deux paliers : 40 % puis 60 %).
  assert.ok(worst <= 0.2, `marche de ${(worst * 100).toFixed(0)} % au bord du masque`);
  // Couronnes en `opacity` de groupe (union) : deux lignes qui se recouvrent ne font pas un noir plus dense.
  const svg = shieldMask({ x: 0, y: 0, w: 200, h: 200 }, [{ x: 20, y: 50, w: 100, h: 20 }, { x: 20, y: 72, w: 100, h: 20 }]);
  assert.doesNotMatch(svg, /fill-opacity/);
  assert.equal([...svg.matchAll(/<g opacity=/g)].length, SHIELD_FEATHER.length + 1);
});
