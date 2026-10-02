// L20 — une seule mise en forme des dates en français pour les Nouveautés, le séparateur
// « Déjà vu lors de ta visite du … » et le Plan de travail : « 1er octobre 2026 »
// (ordinal du premier du mois), jamais « 1 octobre 2026 ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, formatLongDate, formatTime } from '../frontend/src/lib/format-date.mjs';

test('formatDay (YYYY-MM-DD) : « 1er » le premier du mois, chiffre simple ensuite', () => {
  assert.equal(formatDay('2026-10-01'), '1er octobre 2026');
  assert.equal(formatDay('2026-10-02'), '2 octobre 2026');
  assert.equal(formatDay('2026-09-21'), '21 septembre 2026', '21 n’est pas « 21er »');
  assert.equal(formatDay('2026-01-11'), '11 janvier 2026');
});

test('formatLongDate (instant) : dans le fuseau demandé', () => {
  assert.equal(formatLongDate(new Date('2026-09-30T22:30:00Z'), 'Europe/Paris'), '1er octobre 2026');
  assert.equal(formatLongDate(new Date('2026-09-30T22:30:00Z'), 'UTC'), '30 septembre 2026');
});

test('formatTime : « 20 h 42 » (espaces insécables), dans le fuseau demandé', () => {
  assert.equal(formatTime(new Date('2026-10-01T08:30:00Z'), 'Europe/Paris'), '10\u00a0h\u00a030');
  assert.equal(formatTime(new Date('2026-10-01T18:42:00Z'), 'Europe/Paris'), '20\u00a0h\u00a042');
  assert.equal(formatTime(new Date('2026-10-01T06:05:00Z'), 'Europe/Paris'), '8\u00a0h\u00a005', 'heure sans zéro initial');
  assert.equal(formatTime(new Date('2026-10-01T22:00:00Z'), 'Europe/Paris'), '0\u00a0h\u00a000', 'minuit');
});
