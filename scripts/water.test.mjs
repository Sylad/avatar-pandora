// L36 — logique pure de l'eau vivante (frontend/src/lib/water.ts). Critères tirés de la consigne du lot
// et du prototype validé le 10-10 : un anneau qui naît au point touché, s'élargit puis s'éteint ; une
// ondulation PLUS visible que le prototype ; le plancton s'écarte du doigt ; une goutte tombe quand on ne
// fait rien ; et un coût borné (texture, pixels, anneaux, particules) quel que soit l'écran.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DROP_EVERY_MS, IDLE_AFTER_MS, LIGHT_AMP_PX, MAX_RIPPLES, MOVE_STEP_PX, PLANKTON_COUNT, PLANKTON_COUNT_SMALL,
  PUSH_RADIUS_PX, STRONG_AMP_PX, STRONG_LIFE_MS, TEXTURE_H, TEXTURE_W, WATER_CANVAS_MAX_PX, WATER_DPR_MAX,
  canvasSize, coverUv, dropDue, makePlankton, moteGlow, moteScale, planktonCount, pruneRipples, pushPlankton,
  pushRipple, rippleLevel, shouldRippleOnMove, stepPlankton,
} from '../frontend/src/lib/water.ts';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('un anneau naît au point touché, s’élargit en ralentissant, puis s’éteint', () => {
  const base = 330;
  const at = (ms) => rippleLevel(ms, true, base);
  assert.ok(at(0).radius < 10, 'l’anneau part du point touché');
  assert.equal(at(0).alpha, 1);
  let prev = at(0);
  let prevStep = Infinity;
  for (let ms = 200; ms < STRONG_LIFE_MS; ms += 200) {
    const lv = at(ms);
    assert.ok(lv.radius > prev.radius, `rayon qui grandit à ${ms} ms`);
    assert.ok(lv.radius - prev.radius <= prevStep + 1e-9, `élargissement qui ralentit à ${ms} ms`);
    assert.ok(lv.alpha < prev.alpha && lv.amp <= prev.amp, `fondu à ${ms} ms`);
    prevStep = lv.radius - prev.radius;
    prev = lv;
  }
  assert.equal(at(STRONG_LIFE_MS), null, 'éteint au bout de sa vie');
  assert.equal(rippleLevel(-50, true, base).alpha, 1, 'âge négatif = anneau qui naît');
  // Un passage de souris fait un anneau plus petit et plus bref qu'un toucher.
  assert.ok(rippleLevel(800, false, base).radius < at(800).radius);
  assert.equal(rippleLevel(1700, false, base), null);
});

test('ondulation plus visible que le prototype du 10-10', () => {
  // Prototype : l'image était agrandie de 4,5 % au plus dans la bande, soit ~3 px de déplacement à 60 px
  // du centre, et ~0 au point touché. Ici l'image est réfractée le long du rayon, sur toute la crête.
  assert.ok(STRONG_AMP_PX >= 12, `déplacement au toucher : ${STRONG_AMP_PX} px`);
  assert.ok(LIGHT_AMP_PX >= 6, `déplacement au passage de la souris : ${LIGHT_AMP_PX} px`);
  // Bande déformée plus large que le liseré du prototype (8 à 24 px de part et d'autre).
  assert.ok(rippleLevel(0, true, 330).band >= 30);
  // La moitié de la vie passée, la déformation reste nette (≥ 3 px).
  assert.ok(rippleLevel(STRONG_LIFE_MS / 2, true, 330).amp >= 3);
});

test('au plus MAX_RIPPLES anneaux (les plus anciens cèdent la place), les éteints sont retirés', () => {
  const list = [];
  for (let i = 0; i < MAX_RIPPLES + 5; i++) pushRipple(list, { x: i, y: 0, born: i * 10, strong: true });
  assert.equal(list.length, MAX_RIPPLES);
  assert.equal(list[0].x, 5, 'les plus anciens sont partis');
  pruneRipples(list, 5 * 10 + STRONG_LIFE_MS);
  assert.equal(list.length, MAX_RIPPLES - 1);
  pruneRipples(list, 1e9);
  assert.equal(list.length, 0);
});

test('souris : un anneau léger tous les MOVE_STEP_PX parcourus, pas à chaque mouvement', () => {
  assert.ok(shouldRippleOnMove(null, { x: 0, y: 0 }));
  assert.ok(!shouldRippleOnMove({ x: 0, y: 0 }, { x: MOVE_STEP_PX - 1, y: 0 }));
  assert.ok(shouldRippleOnMove({ x: 0, y: 0 }, { x: MOVE_STEP_PX, y: 0 }));
});

test('sans geste, une goutte tombe de temps en temps ; jamais pendant qu’on touche l’eau', () => {
  assert.ok(!dropDue(IDLE_AFTER_MS - 1, 0, 0), 'trop tôt après un geste');
  assert.ok(dropDue(IDLE_AFTER_MS, 0, 0));
  assert.ok(!dropDue(10_000, -Infinity, 10_001), 'avant l’heure de la suivante');
  assert.ok(DROP_EVERY_MS >= 2000 && DROP_EVERY_MS <= 6000, 'de temps en temps, ni rafale ni silence');
});

test('le plancton s’écarte du point touché, plus fort au toucher qu’au passage, et pas au loin', () => {
  const W = 750, H = 320;
  const make = () => [
    { x: 0.5 + 40 / W, y: 0.5, vx: 0, vy: 0, size: 2, hue: 0, phase: 0 },
    { x: 0.5, y: 0.5 - 30 / H, vx: 0, vy: 0, size: 2, hue: 0, phase: 0 },
    { x: 0.5 + (PUSH_RADIUS_PX + 5) / W, y: 0.5, vx: 0, vy: 0, size: 2, hue: 0, phase: 0 },
  ];
  const strong = make(), light = make();
  pushPlankton(strong, W / 2, H / 2, true, W, H);
  pushPlankton(light, W / 2, H / 2, false, W, H);
  assert.ok(strong[0].vx > 0, 'à droite du doigt : part vers la droite');
  assert.ok(strong[1].vy < 0, 'au-dessus : part vers le haut');
  assert.ok(strong[0].vx > light[0].vx, 'plus fort au toucher');
  assert.deepEqual([strong[2].vx, strong[2].vy], [0, 0], 'hors de portée : immobile');
  // Il s'éloigne vraiment (et l'élan s'amortit) : 1 s plus tard, à plus de 30 px de plus, et l'élan est tombé.
  const x0 = strong[0].x * W, v0 = strong[0].vx;
  for (let t = 0; t < 1000; t += 16) stepPlankton(strong, 16, t, seq([0.5]));
  assert.ok(strong[0].x * W - x0 > 30, `écart : ${(strong[0].x * W - x0).toFixed(1)} px`);
  assert.ok(Math.abs(strong[0].vx) < v0 / 5, 'élan amorti');
});

test('le plancton dérive vers la surface et revient par le bas', () => {
  const m = [{ x: 0.5, y: -0.0299, vx: 0, vy: 0, size: 2, hue: 0, phase: 0 }];
  stepPlankton(m, 50, 0, seq([0.25]));
  assert.ok(m[0].y > 1, 'ressort par le bas');
  assert.equal(m[0].x, 0.25);
  const p = makePlankton(100, Math.random);
  for (const q of p) {
    assert.ok(q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1 && q.size > 1 && q.size < 4.3);
    const g = moteGlow(q, 1234);
    assert.ok(g >= 0.1 && g <= 0.8);
  }
});

test('coût borné : texture fixe, densité et largeur du canevas plafonnées, plancton compté', () => {
  // Texture : puissance de deux (mipmaps en WebGL 1), 2 Mo en RGBA quel que soit l'écran.
  for (const v of [TEXTURE_W, TEXTURE_H]) assert.equal(v & (v - 1), 0, `${v} n’est pas une puissance de deux`);
  assert.ok(TEXTURE_W * TEXTURE_H * 4 <= 2 * 1024 * 1024);
  // Téléphone à densité 3 : 1,5 au plus.
  assert.deepEqual(canvasSize(311, 133, 3), { width: 467, height: 200, scale: WATER_DPR_MAX });
  // Grand écran à densité 2 : largeur plafonnée.
  const big = canvasSize(1400, 600, 2);
  assert.equal(big.width, WATER_CANVAS_MAX_PX);
  assert.ok(big.width * big.height <= WATER_CANVAS_MAX_PX * WATER_CANVAS_MAX_PX * 0.5);
  assert.equal(planktonCount(311), PLANKTON_COUNT_SMALL);
  assert.equal(planktonCount(752), PLANKTON_COUNT);
  assert.ok(PLANKTON_COUNT <= 64 && MAX_RIPPLES <= 8);
  // Halos plus petits au téléphone (ils couvraient l'image du bandeau de ~130 px).
  assert.ok(moteScale(311) < moteScale(752));
  assert.equal(moteScale(1200), moteScale(760));
});

test('« cover » : un point du canevas lit le même pixel que l’image affichée', () => {
  // Même rapport (21:9) : toute l'image.
  assert.deepEqual(coverUv(1344, 576, 752.5, 322.5), { scale: [1, 1], offset: [0, 0] });
  // Cadre plus haut que l'image : coupée à gauche et à droite, centrée.
  const c = coverUv(2000, 500, 400, 200);
  assert.ok(Math.abs(c.scale[0] - 0.5) < 1e-9 && c.scale[1] === 1);
  assert.ok(Math.abs(c.offset[0] - 0.25) < 1e-9 && c.offset[1] === 0);
});
