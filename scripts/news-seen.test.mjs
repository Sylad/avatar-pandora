// Pastille « Nouveautés » : entrées non vues depuis la dernière visite (localStorage).
// Module pur frontend/src/lib/news-seen.ts, importé tel quel (Node ≥ 22.18 retire les types
// TypeScript à la volée). L21 : mémoire de tous les slugs vus (entrée antidatée encore
// nouvelle), mémoire de base dès la première page, place du séparateur — repris
// d'evatosorus ; l'ancien format (en production depuis L14) reste lu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NEWS_SEEN_KEY, badgeLabel, countUnseen, ensureBaseline, isUnseen, markAllSeen, readSeen,
  seenSeparatorIndex, seenSeparatorLabel, sinceLabel, unseenLabel,
} from '../frontend/src/lib/news-seen.ts';

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const E = [
  { slug: 'c', date: '2026-10-02' },
  { slug: 'b', date: '2026-10-01' },
  { slug: 'a', date: '2026-10-01' },
  { slug: 'z', date: '2026-09-28' },
];

test('clé de stockage inchangée depuis L14 : eywa.news.seen-v1', () => {
  assert.equal(NEWS_SEEN_KEY, 'eywa.news.seen-v1');
});

test('premier visiteur (rien en mémoire) : aucune entrée « nouvelle »', () => {
  assert.equal(readSeen(store()), null);
  assert.equal(countUnseen(E, null), 0);
});

test('mémoire illisible ou mal formée : ignorée ; champs invalides écartés', () => {
  for (const raw of ['{', '"x"', '{"date":"hier","slugs":[]}', '{"date":"2026-10-01"}', 'null']) {
    assert.equal(readSeen(store({ [NEWS_SEEN_KEY]: raw })), null, raw);
  }
  assert.equal(readSeen(null), null);
  assert.deepEqual(readSeen(store({ [NEWS_SEEN_KEY]: JSON.stringify({ date: '2026-10-01', slugs: ['b', 3], at: 42, all: 'oui' }) })), { date: '2026-10-01', slugs: ['b'] });
});

test('markAllSeen retient TOUS les slugs vus (all: true), la date la plus récente et l’instant de visite', () => {
  const s = store();
  const seen = markAllSeen(s, E, new Date('2026-10-02T20:15:00Z'));
  assert.deepEqual(seen, { date: '2026-10-02', slugs: ['a', 'b', 'c', 'z'], at: '2026-10-02T20:15:00.000Z', all: true });
  assert.deepEqual(readSeen(s), seen);
  assert.equal(countUnseen(E, seen), 0);
  assert.equal(markAllSeen(s, []), null);
});

test('entrée antidatée (plus ancienne que la dernière vue) mais jamais vue : nouvelle', () => {
  const s = store();
  markAllSeen(s, E);
  const later = [{ slug: 'neuf', date: '2026-10-03' }, ...E, { slug: 'vieux', date: '2026-08-01' }];
  assert.deepEqual(later.filter((e) => isUnseen(e, readSeen(s))).map((e) => e.slug), ['neuf', 'vieux']);
});

test('ancien format (L14, en production : sans all, slugs de la date la plus récente) : règle de date conservée, rien d’ancien ne redevient nouveau', () => {
  const seen = { date: '2026-10-01', slugs: ['a'] };
  assert.deepEqual(E.filter((e) => isUnseen(e, seen)).map((e) => e.slug), ['c', 'b']);
  const s = store({ [NEWS_SEEN_KEY]: JSON.stringify({ date: '2026-10-01', slugs: ['a', 'b'], at: '2026-10-01T20:00:00.000Z' }) });
  assert.equal(countUnseen(E, readSeen(s)), 1, 'seule « c », postérieure');
  // La visite suivante passe au nouveau format.
  markAllSeen(s, E);
  assert.equal(readSeen(s).all, true);
});

test('dates comparées en millisecondes, pas en chaînes (instant à secondes ou sans)', () => {
  const seen = { date: '2026-10-01T13:15Z', slugs: ['x'] };
  assert.equal(isUnseen({ slug: 'y', date: '2026-10-01T13:15:00Z' }, seen), true);
  assert.equal(isUnseen({ slug: 'y', date: '2026-10-01T13:14:59Z' }, seen), false);
});

test('mémoire de base : première page vue (n’importe laquelle) → tout le publié compte comme vu ; les entrées suivantes la lèvent', () => {
  const s = store();
  assert.equal(ensureBaseline(s, E, new Date('2026-10-02T08:00:00Z')), true);
  assert.equal(countUnseen(E, readSeen(s)), 0);
  assert.equal(readSeen(s).at, '2026-10-02T08:00:00.000Z');
  const later = [{ slug: 'neuf', date: '2026-10-03' }, ...E];
  assert.equal(countUnseen(later, readSeen(s)), 1);
  // Une mémoire existante n'est jamais écrasée (ni l'ancien format).
  assert.equal(ensureBaseline(s, later), false);
  assert.equal(countUnseen(later, readSeen(s)), 1);
  const old = store({ [NEWS_SEEN_KEY]: JSON.stringify({ date: '2026-09-01', slugs: [] }) });
  assert.equal(ensureBaseline(old, E), false);
  assert.equal(countUnseen(E, readSeen(old)), 4);
});

test('mémoire de base sans aucune nouveauté publiée : la première publiée ensuite est nouvelle', () => {
  const s = store();
  assert.equal(ensureBaseline(s, []), true);
  assert.equal(countUnseen([{ slug: 'premiere', date: '2026-10-02' }], readSeen(s)), 1);
});

test('stockage absent ou en panne : pas d’exception, rien d’écrit', () => {
  const broken = { getItem() { throw new Error('quota'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  assert.equal(readSeen(broken), null);
  assert.doesNotThrow(() => markAllSeen(broken, E));
  assert.equal(ensureBaseline(null, E), false);
  assert.equal(ensureBaseline({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} }, E), false);
});

test('séparateur « Déjà vu » : avant la première entrée vue seulement si les nouvelles sont toutes au-dessus', () => {
  assert.equal(seenSeparatorIndex([true, true, false, false]), 2);
  assert.equal(seenSeparatorIndex([true, false, true, false]), -1, 'nouvelles non contiguës : pas de séparateur trompeur');
  assert.equal(seenSeparatorIndex([false, false]), -1, 'rien de nouveau');
  assert.equal(seenSeparatorIndex([true, true]), -1, 'rien de déjà vu');
  assert.equal(seenSeparatorIndex([]), -1);
});

test('libellés : pastille « 9+ » au-delà de 9, textes accordés (lecteur d’écran, bandeau), vides à zéro', () => {
  assert.equal(badgeLabel(0), '');
  assert.equal(badgeLabel(3), '3');
  assert.equal(badgeLabel(12), '9+');
  assert.equal(unseenLabel(0), '');
  assert.equal(unseenLabel(1), '1 nouveauté non vue');
  assert.equal(unseenLabel(4), '4 nouveautés non vues');
  assert.equal(sinceLabel(0), '');
  assert.equal(sinceLabel(1), '1 nouveauté depuis ta dernière visite');
  assert.equal(sinceLabel(3), '3 nouveautés depuis ta dernière visite');
});

test('texte du séparateur : formateur commun (« 1er »), tutoiement, repli sans instant', () => {
  assert.equal(seenSeparatorLabel('2026-10-01T08:30:00.000Z', 'Europe/Paris'), 'Déjà vu lors de ta visite du 1er octobre 2026 à 10\u00a0h\u00a030');
  assert.equal(seenSeparatorLabel(undefined), 'Déjà vu lors d’une visite précédente');
});

test('journal réel (nouveautes.json) : visite puis relecture → pastille éteinte', () => {
  const data = JSON.parse(readFileSync(new URL('../frontend/public/nouveautes-data/nouveautes.json', import.meta.url), 'utf8'));
  const s = store();
  markAllSeen(s, data.entries);
  assert.equal(badgeLabel(countUnseen(data.entries, readSeen(s))), '');
});
