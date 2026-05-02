import * as THREE from 'three';

export interface SceneZone {
  /** label for debugging only */
  label: string;
  /** scroll progress 0..1 at which this zone fully expresses */
  at: number;
  colorA: string;
  colorB: string;
  density: number; // 0..1.4, scales uDensity
  cameraZ: number; // camera moves forward over the descent
}

export const SCENE_ZONES: SceneZone[] = [
  { label: 'cold-open',    at: 0.00, colorA: '#5fffe6', colorB: '#7fdcff', density: 0.35, cameraZ: 8 },
  { label: 'forest',       at: 0.18, colorA: '#5fffe6', colorB: '#7fff8f', density: 1.0, cameraZ: 6 },
  { label: 'hometree',     at: 0.36, colorA: '#7fdcff', colorB: '#ffd07f', density: 1.2, cameraZ: 4 },
  { label: 'mountains',    at: 0.54, colorA: '#4a4a8f', colorB: '#9a7fff', density: 0.9, cameraZ: 2 },
  { label: 'ocean',        at: 0.72, colorA: '#5fffe6', colorB: '#ff5dc4', density: 1.4, cameraZ: 0 },
  { label: 'volcano',      at: 0.88, colorA: '#ff8c2a', colorB: '#ff4040', density: 1.0, cameraZ: -2 },
  { label: 'reveal',       at: 1.00, colorA: '#5fffe6', colorB: '#ff5dc4', density: 1.0, cameraZ: -4 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

export interface SceneState {
  colorA: THREE.Color;
  colorB: THREE.Color;
  density: number;
  cameraZ: number;
}

export function sampleScene(progress: number, out: SceneState): SceneState {
  const p = Math.max(0, Math.min(1, progress));
  let a = SCENE_ZONES[0];
  let b = SCENE_ZONES[SCENE_ZONES.length - 1];
  for (let i = 0; i < SCENE_ZONES.length - 1; i++) {
    if (p >= SCENE_ZONES[i].at && p <= SCENE_ZONES[i + 1].at) {
      a = SCENE_ZONES[i];
      b = SCENE_ZONES[i + 1];
      break;
    }
  }
  const span = Math.max(b.at - a.at, 1e-6);
  const t = (p - a.at) / span;
  // smoothstep for buttery transitions
  const s = t * t * (3 - 2 * t);
  tmpA.set(a.colorA);
  tmpB.set(b.colorA);
  out.colorA.copy(tmpA).lerp(tmpB, s);
  tmpA.set(a.colorB);
  tmpB.set(b.colorB);
  out.colorB.copy(tmpA).lerp(tmpB, s);
  out.density = a.density + (b.density - a.density) * s;
  out.cameraZ = a.cameraZ + (b.cameraZ - a.cameraZ) * s;
  return out;
}
