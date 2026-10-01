// L14 — pastille « Nouveautés » : entrées non vues depuis la dernière visite de
// /nouveautes/ (localStorage). Module pur frontend/src/lib/news-seen.ts, importé tel quel
// (Node ≥ 22.18 retire les types TypeScript à la volée).
import test from 'node:test';
import assert from 'node:assert/strict';
import { NEWS_SEEN_KEY, badgeLabel, countUnseen, isUnseen, markAllSeen, readSeen, unseenLabel } from '../frontend/src/lib/news-seen.ts';

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

test('premier visiteur (rien en mémoire) : aucune entrée « nouvelle »', () => {
  assert.equal(readSeen(store()), null);
  assert.equal(countUnseen(E, null), 0);
});

test('mémoire illisible ou mal formée : ignorée', () => {
  for (const raw of ['{', '"x"', '{"date":"hier","slugs":[]}', '{"date":"2026-10-01"}', 'null']) {
    assert.equal(readSeen(store({ [NEWS_SEEN_KEY]: raw })), null, raw);
  }
  assert.equal(readSeen(null), null);
});

test('markAllSeen retient la date la plus récente, ses slugs et l’instant de visite', () => {
  const s = store();
  const seen = markAllSeen(s, E, new Date('2026-10-02T20:15:00Z'));
  assert.deepEqual(seen, { date: '2026-10-02', slugs: ['c'], at: '2026-10-02T20:15:00.000Z' });
  assert.deepEqual(readSeen(s), seen);
  assert.equal(countUnseen(E, seen), 0);
});

test('nouvelle = postérieure à la date vue, ou de la même date mais slug non vu', () => {
  const seen = { date: '2026-10-01', slugs: ['a'] };
  assert.deepEqual(E.filter((e) => isUnseen(e, seen)).map((e) => e.slug), ['c', 'b']);
  assert.equal(countUnseen(E, seen), 2);
});

test('dates comparées en millisecondes, pas en chaînes (instant à secondes ou sans)', () => {
  const seen = { date: '2026-10-01T13:15Z', slugs: ['x'] };
  assert.equal(isUnseen({ slug: 'y', date: '2026-10-01T13:15:00Z' }, seen), true);
  assert.equal(isUnseen({ slug: 'y', date: '2026-10-01T13:14:59Z' }, seen), false);
});

test('libellés : pastille « 9+ » au-delà de 9, texte lu par les lecteurs d’écran', () => {
  assert.equal(badgeLabel(0), '');
  assert.equal(badgeLabel(3), '3');
  assert.equal(badgeLabel(12), '9+');
  assert.equal(unseenLabel(1), '1 nouveauté non vue');
  assert.equal(unseenLabel(4), '4 nouveautés non vues');
});

test('stockage indisponible : pas d’exception', () => {
  const broken = { getItem() { throw new Error('quota'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  assert.equal(readSeen(broken), null);
  assert.doesNotThrow(() => markAllSeen(broken, E));
});
