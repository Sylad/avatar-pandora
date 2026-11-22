// L35 — « Pandora vivant 4 » : jour et nuit, logique pure (frontend/src/lib/day-night.ts).
// Critères tirés de la consigne du lot et du prototype validé le 10-10 (section 04), pas du code :
//  - l'ambiance suit l'heure du visiteur : plein jour l'après-midi, nuit noire la nuit, la nuit
//    tombe progressivement le soir (et se lève à l'aube), sans saut ;
//  - réglage manuel jour / nuit / auto (auto par défaut, toute valeur inconnue = auto) ;
//  - la forêt s'illumine à mesure que la nuit tombe : filtres et points bioluminescents suivent les
//    formules du prototype (luminosité 1 − 0,66 n, teinte, crépuscule, lueur, points) ;
//  - libellés du prototype (Plein jour … Nuit noire).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_NIGHT, SKY_STORAGE_KEY, nightOf, nightOfHour, nowLabel, parseMode, phaseLabel, skyBoot, skyLayers, skySpots, smooth,
} from '../frontend/src/lib/day-night.ts';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg} : ${a} ≠ ${b}`);

test('l’heure du visiteur : jour l’après-midi, nuit noire la nuit, transitions sans saut', () => {
  for (const h of [8, 10, 12, 13.75, 16, 17]) assert.equal(nightOfHour(h), 0, `${h} h`);
  for (const h of [22, 23, 0, 2, 4.9]) assert.equal(nightOfHour(h), 1, `${h} h`);
  // Le soir, la nuit tombe (croissant strict) ; à l'aube, elle se lève (décroissant strict).
  let prev = 0;
  for (let h = 17.25; h < 22; h += 0.25) { const n = nightOfHour(h); assert.ok(n > prev, `soir ${h} h`); prev = n; }
  prev = 1;
  for (let h = 5.25; h < 8; h += 0.25) { const n = nightOfHour(h); assert.ok(n < prev, `aube ${h} h`); prev = n; }
  // Pas de saut d'une minute à l'autre sur 24 h.
  for (let m = 0; m < 24 * 60; m++) {
    const d = Math.abs(nightOfHour((m + 1) / 60) - nightOfHour(m / 60));
    assert.ok(d < 0.02, `saut à ${Math.floor(m / 60)} h ${m % 60} : ${d}`);
  }
  assert.equal(nightOfHour(24 + 13), 0);
  assert.equal(nightOfHour(-1), 1);
});

test('réglage : auto par défaut, jour et nuit fixes quelle que soit l’heure', () => {
  for (const raw of [null, undefined, '', 'Nuit', 'soir', 42]) assert.equal(parseMode(raw), 'auto');
  assert.equal(parseMode('jour'), 'jour');
  assert.equal(parseMode('nuit'), 'nuit');
  const midi = new Date(2026, 10, 22, 13, 0);
  const minuit = new Date(2026, 10, 22, 23, 30);
  assert.equal(nightOf('auto', midi), 0);
  assert.equal(nightOf('auto', minuit), 1);
  assert.equal(nightOf('nuit', midi), 1);
  assert.equal(nightOf('jour', minuit), 0);
  assert.deepEqual(MANUAL_NIGHT, { jour: 0, nuit: 1 });
});

test('libellés du prototype, et phrase d’état « 13 h 05 chez toi : plein jour »', () => {
  assert.deepEqual([0, 0.3, 0.5, 0.72, 0.95].map(phaseLabel), ['Plein jour', 'Fin d’après-midi', 'Crépuscule', 'Tombée de la nuit', 'Nuit noire']);
  assert.equal(nowLabel(new Date(2026, 10, 22, 13, 5), 0), '13 h 05 chez toi : plein jour');
  assert.equal(nowLabel(new Date(2026, 10, 22, 23, 40), 1), '23 h 40 chez toi : nuit noire');
});

test('calques : formules du prototype (section 04), rien de jour, tout la nuit', () => {
  const proto = (n) => ({
    shade: 1 - (1 - 0.66 * n), // brightness(1 − 0,66 n) = voile noir d'opacité 0,66 n
    tint: smooth(0.25, 1, n) * 0.8,
    dusk: Math.max(0, 1 - Math.abs(n - 0.45) / 0.25),
    glow: smooth(0.4, 1, n) * 0.5,
    spots: smooth(0.32, 0.92, n),
  });
  for (let n = 0; n <= 1.0001; n += 0.05) {
    const got = skyLayers(n);
    for (const [k, v] of Object.entries(proto(n))) near(got[k], v, `${k} à n = ${n.toFixed(2)}`);
  }
  assert.deepEqual(skyLayers(0), { shade: 0, tint: 0, dusk: 0, glow: 0, spots: 0 });
  const nuit = skyLayers(1);
  assert.ok(nuit.spots === 1 && nuit.glow === 0.5 && nuit.dusk === 0, JSON.stringify(nuit));
  // Le crépuscule culmine au milieu de la tombée de la nuit.
  assert.equal(skyLayers(0.45).dusk, 1);
});

test('script de démarrage autonome : mêmes valeurs que la logique, posées sur <html>', () => {
  const src = String(skyBoot);
  // Sérialisé tel quel dans la page : aucun import ni variable du module.
  for (const name of ['smooth', 'nightOfHour', 'skyLayers', 'parseMode', 'SKY_STORAGE_KEY']) {
    assert.ok(!new RegExp(`\\b${name}\\b`).test(src), `skyBoot dépend de ${name}`);
  }
  assert.ok(src.includes(`'${SKY_STORAGE_KEY}'`) || src.includes(`"${SKY_STORAGE_KEY}"`), 'clé de stockage différente');

  const run = (stored, hours, minutes) => {
    const props = {};
    const dataset = {};
    const listeners = {};
    const fakeDoc = {
      documentElement: { style: { setProperty: (k, v) => { props[k] = v; } }, dataset },
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
    };
    const RealDate = Date;
    const g = globalThis;
    const saved = { window: g.window, document: g.document, localStorage: g.localStorage, Date: g.Date, setInterval: g.setInterval };
    g.window = {};
    g.document = fakeDoc;
    g.localStorage = { getItem: () => stored };
    g.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [2026, 10, 22, hours, minutes])); } };
    g.setInterval = () => 0;
    try { new Function(`(${src})()`)(); } finally { Object.assign(g, saved); }
    return { props, dataset, listeners };
  };
  for (const [stored, h, m] of [[null, 13, 0], [null, 19, 30], [null, 21, 10], [null, 6, 15], [null, 23, 0], ['jour', 23, 0], ['nuit', 13, 0]]) {
    const { props, dataset, listeners } = run(stored, h, m);
    const mode = parseMode(stored);
    const n = nightOf(mode, new Date(2026, 10, 22, h, m));
    near(Number(props['--sky-n']), n, `n ${stored} ${h} h ${m}`);
    for (const [k, v] of Object.entries(skyLayers(n))) near(Number(props[`--sky-${k}`]), v, `${k} ${stored} ${h} h ${m}`);
    assert.equal(dataset.skyMode, mode);
    assert.equal('skyLit' in dataset, skyLayers(n).spots > 0.001, `points ${stored} ${h} h ${m}`);
    assert.equal(typeof listeners['astro:after-swap'], 'function', 'pas de reprise après une navigation');
  }
});

test('points bioluminescents : ceux du prototype, stables d’un build à l’autre, dans l’image', () => {
  const a = skySpots();
  assert.deepEqual(a, skySpots());
  assert.ok(a.length >= 30 && a.length <= 60, `${a.length} points`);
  for (const s of a) {
    assert.ok(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100, JSON.stringify(s));
    assert.ok(s.r >= 5 && s.r <= 15);
    assert.match(s.rgb, /^\d+,\d+,\d+$/);
  }
  // Surtout dans la moitié basse (là où pousse la forêt), comme dans le prototype.
  assert.ok(a.filter((s) => s.y >= 50).length / a.length > 0.6);
  // Toutes les couleurs du prototype, le cyan en tête.
  const counts = {};
  for (const s of a) counts[s.rgb] = (counts[s.rgb] ?? 0) + 1;
  assert.equal(Object.keys(counts).length, 4);
  assert.equal(Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0], '95,255,230');
  // Plusieurs groupes de pouls, à peu près égaux.
  const groups = new Set(a.map((s) => s.group));
  assert.ok(groups.size >= 3);
});
