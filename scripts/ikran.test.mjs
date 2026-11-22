// L34 — logique pure des ikrans dans le ciel (frontend/src/lib/ikran.ts). Critères tirés de la
// consigne du lot : silhouette à 4 ailes et longue queue (jamais un dragon européen), battement
// d'ailes moins raide que le prototype du 10-10, traversée en fondu, rien sur le texte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOWNSTROKE, FLAP_DEFAULT, FLIGHT_FADE, IKRAN_SVG, MAX_IKRANS, MAX_WITH_TAPS, PASS_MAX_MS, PASS_MIN_MS,
  REAR_GAIN, REAR_LAG, cycleMs, flapEnvelope, flapKeyframes, flightKeyframes, ikranSize, ikranSpeed, nextPassDelay,
  skyBand, swayOf, tailAngle, wingPose,
} from '../frontend/src/lib/ikran.ts';

test('silhouette : quatre ailes, une longue queue, rien d’un dragon européen', () => {
  const wings = IKRAN_SVG.match(/class="ikran__wing ikran__wing--[a-z-]+"/g) ?? [];
  assert.deepEqual(wings.map((w) => w.match(/--([a-z-]+)/)[1]).sort(), ['front-down', 'front-up', 'rear-down', 'rear-up']);
  assert.match(IKRAN_SVG, /class="ikran__tail"/);
  // Queue : de la base (x = 56) jusqu'à la palette (x = 0), plus longue que l'envergure d'une demi-aile arrière.
  const tail = IKRAN_SVG.match(/ikran__tail-line" d="M(\d+) [\d.]+C[\d .]+ (\d+) [\d.]+"/);
  assert.ok(tail && Number(tail[1]) - Number(tail[2]) >= 40, 'queue trop courte');
  assert.match(IKRAN_SVG, /aria-hidden="true"/);
});

// Envergure vue de dessous d'une aile, échantillonnée à 60 images/s sur une salve.
const FRAME = 1000 / 60;
const sample = (pose, ms) => Array.from({ length: Math.ceil(ms / FRAME) + 1 }, (_, i) => pose(i * FRAME));
const rough = (s) => {
  const steps = s.slice(1).map((v, i) => Math.abs(v - s[i]));
  const acc = steps.slice(1).map((v, i) => Math.abs(v - steps[i]));
  return { step: Math.max(...steps), acc: Math.max(...acc) };
};
// Le prototype du 10-10 (« raide ») : un cosinus sur 1,5 s puis plané, ailes arrière décalées de 0,7 rad.
const proto = (rear) => (t) => {
  const cyc = (t * 0.001) % 4.4;
  if (cyc >= 1.5) return 1;
  const k = (cyc / 1.5) * Math.PI * 4;
  return rear ? 0.78 + 0.22 * Math.cos(k - 0.7) : 0.72 + 0.28 * Math.cos(k);
};

test('battement moins raide : aucune cassure d’une image à l’autre, ni à l’entrée ou la sortie du plané', () => {
  const before = rough(sample(proto(true), 4400));
  // Le prototype sautait d'un coup de 0,05 à 0,07 d'envergure en une image (ailes arrière).
  assert.ok(before.step > 0.07);
  for (const [lag, gain] of [[0, 1], [REAR_LAG, REAR_GAIN]]) {
    const now = rough(sample((t) => wingPose(t, FLAP_DEFAULT, lag, gain).span, cycleMs() * 2));
    assert.ok(now.step < 0.055, `pas maximal ${now.step.toFixed(3)}`);
    // Accélération bornée : la vitesse ne change jamais de valeur d'un coup (au plus le quart du saut du prototype).
    assert.ok(now.acc < before.step / 4, `à-coup ${now.acc.toFixed(4)}`);
  }
  // La boucle se referme : fin de salve = début.
  assert.ok(Math.abs(wingPose(cycleMs()).span - wingPose(0).span) < 1e-9);
  assert.equal(flapEnvelope(0), 0);
});

test('abattée rapide, relevée lente et repliée, ailes arrière en retard', () => {
  assert.ok(DOWNSTROKE < 0.5);
  const o = FLAP_DEFAULT;
  const mid = o.period * 1; // deuxième battement, amplitude pleine
  // Pointes vers l'arrière seulement à la relevée.
  assert.equal(wingPose(mid + o.period * DOWNSTROKE * 0.5).sweep, 0);
  assert.ok(wingPose(mid + o.period * (DOWNSTROKE + (1 - DOWNSTROKE) / 2)).sweep > 5);
  // Aile repliée à la relevée : plus courte qu'au même angle pendant l'abattée.
  assert.ok(wingPose(mid + o.period * (DOWNSTROKE + (1 - DOWNSTROKE) / 2)).span
    < wingPose(mid + o.period * DOWNSTROKE / 2).span);
  // Ailes arrière : la pose avant, décalée de REAR_LAG, moins ample.
  const front = wingPose(mid, o);
  const rear = wingPose(mid + REAR_LAG * o.period, o, REAR_LAG, 1);
  assert.ok(Math.abs(front.span - rear.span) < 1e-9);
  assert.ok(REAR_GAIN < 1);
  // Plané : ailes déployées, immobiles.
  const glide = o.flaps * o.period + o.glide / 2;
  assert.deepEqual(wingPose(glide), { span: 1, sweep: 0 });
  // Queue : elle ondule (amplitude visible) sans fouetter.
  const tail = Array.from({ length: 200 }, (_, i) => tailAngle((i / 200) * cycleMs()));
  assert.ok(Math.max(...tail) > 3 && Math.max(...tail.map(Math.abs)) < 10);
});

test('images clés : transform seulement, et la salve se referme', () => {
  const k = flapKeyframes();
  for (const frames of [k.frontUp, k.frontDown, k.rearUp, k.rearDown, k.tail]) {
    assert.equal(frames[0].offset, 0);
    assert.equal(frames.at(-1).offset, 1);
    assert.equal(frames[0].transform, frames.at(-1).transform);
    for (const f of frames) assert.deepEqual(Object.keys(f).sort(), ['offset', 'transform']);
  }
  assert.equal(k.duration, cycleMs());
  // Ailes du haut et du bas : cisaillement opposé (les deux pointes filent vers l'arrière).
  const i = k.frontUp.findIndex((f) => !f.transform.startsWith('skewX(0deg)'));
  assert.ok(i > 0);
  assert.equal(k.frontUp[i].transform.replace('skewX(', 'skewX(-'), k.frontDown[i].transform);
});

test('traversée : entre et sort hors champ, en fondu, transform et opacity seulement', () => {
  for (const dir of [1, -1]) {
    const { frames, duration } = flightKeyframes({ width: 1000, size: 120, y: 100, dir, speed: 0.1, opacity: 0.9, sway: 10 });
    assert.ok(Math.abs(duration - (1000 + 120) / 0.1) < 1e-6);
    assert.equal(frames[0].opacity, 0);
    assert.equal(frames.at(-1).opacity, 0);
    assert.ok(Math.max(...frames.map((f) => f.opacity)) === 0.9);
    const x = (f) => Number(f.transform.match(/translate3d\(([-\d.]+)px/)[1]);
    assert.equal(x(frames[0]), dir > 0 ? -120 : 1000);
    assert.equal(x(frames.at(-1)), dir > 0 ? 1000 : -120);
    for (const f of frames) assert.deepEqual(Object.keys(f).sort(), ['offset', 'opacity', 'transform']);
    // Fondu sur FLIGHT_FADE du trajet à chaque bout, pleine opacité au milieu.
    const mid = frames.filter((f) => f.offset >= FLIGHT_FADE && f.offset <= 1 - FLIGHT_FADE);
    assert.ok(mid.every((f) => f.opacity === 0.9));
  }
});

test('bande de ciel : au-dessus du texte quand il reste du ciel, sinon tiers haut', () => {
  // Grand écran : bandeau de 430 px, texte à partir de 250 px.
  const [lo, hi] = skyBand(430, 250, 140);
  const reach = 70 + swayOf(430, 140); // demi-envergure + ondulation
  assert.ok(lo >= reach, 'l’ikran sortirait par le haut du bandeau');
  assert.ok(hi + reach <= 250, 'l’ikran toucherait le texte');
  // Téléphone : le texte remplit le bandeau ; l'ikran reste dans le tiers haut.
  const [plo, phi] = skyBand(230, 40, 60);
  assert.ok(plo >= 0 && phi <= 230 * 0.34 + 1e-9 && plo <= phi);
});

test('de temps en temps, et jamais une nuée', () => {
  assert.equal(nextPassDelay(0), PASS_MIN_MS);
  assert.equal(nextPassDelay(1), PASS_MAX_MS);
  assert.ok(PASS_MIN_MS >= 5000);
  assert.ok(MAX_IKRANS <= 3 && MAX_WITH_TAPS <= 4);
  // Plus près = plus grand et plus rapide (parallaxe) ; plus petit au téléphone.
  assert.ok(ikranSize(1, 1000) > ikranSize(0, 1000));
  assert.ok(ikranSpeed(1, 1000) > ikranSpeed(0, 1000));
  assert.ok(ikranSize(1, 358) < 90);
});
