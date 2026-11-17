// L59 — choix du Node pour la CLI Astro (Astro 7 exige >= 22.23.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { atLeast, pickNode } from './lib/astro-node.mjs';

const base = { min: '22.23.4', nvmrc: '22.23.5\n', nvmDir: '/nvm', exists: (p) => p === '/nvm/versions/node/v22.23.5/bin/node' };

test('atLeast compare les trois nombres, pas le texte', () => {
  assert.equal(atLeast('v22.23.4', '22.23.4'), true);
  assert.equal(atLeast('v22.23.10', '22.23.4'), true);
  assert.equal(atLeast('v24.0.0', '22.23.4'), true);
  assert.equal(atLeast('v22.22.3', '22.23.4'), false);
  assert.equal(atLeast('v20.20.2', '22.23.4'), false);
});

test('un Node courant assez récent est gardé', () => {
  assert.equal(pickNode({ ...base, current: 'v22.23.5' }), null);
  assert.equal(pickNode({ ...base, current: 'v24.22.2' }), null);
});

test('un Node trop ancien cède la place au Node de .nvmrc installé par nvm', () => {
  assert.equal(pickNode({ ...base, current: 'v22.22.3' }), '/nvm/versions/node/v22.23.5/bin/node');
});

test('sans Node acceptable, erreur claire au lieu d\'un lancement trop ancien', () => {
  assert.throws(() => pickNode({ ...base, current: 'v22.22.3', exists: () => false }), /trop ancien.*nvm install/);
  assert.throws(() => pickNode({ ...base, current: 'v22.22.3', nvmrc: '22' }), /trop ancien/);
  assert.throws(() => pickNode({ ...base, current: 'v22.22.3', nvmrc: '22.22.0', exists: () => true }), /trop ancien/);
});
