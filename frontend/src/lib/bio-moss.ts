/**
 * Lumière au toucher (L32, « Pandora vivant 1 ») — logique pure de la mousse
 * bioluminescente qui s'allume sous le doigt ou la souris (components/BioMoss.astro).
 *
 * Une tache naît au point touché, s'étend en ~0,9 s puis s'éteint : rien ne reste
 * allumé au-delà de MOSS_LIFE_MS. Au repos, quelques taches très faibles restent
 * posées une fois pour toutes (image fixe, aucune animation).
 */

/** Durée de vie d'une tache, de l'allumage à l'extinction complète. */
export const MOSS_LIFE_MS = 3000;
/** Fin de l'extension de la tache ; elle reste pleine jusque-là, puis s'éteint. */
export const MOSS_SPREAD_MS = 900;
const FADE_IN_MS = 180;
/** Rayon de départ, en part du rayon final. */
const START_SCALE = 0.35;

/** Souris : une nouvelle tache tous les MOSS_STEP_PX parcourus, au plus une par MOSS_STEP_MS. */
export const MOSS_STEP_PX = 70;
export const MOSS_STEP_MS = 90;
/** Taches vivantes au plus (les plus anciennes cèdent la place). */
export const MOSS_MAX = 36;

export interface MossLevel {
  /** Rayon courant, en part du rayon final (0,35 → 1). */
  scale: number;
  /** Intensité lumineuse (0 → 1 → 0). */
  alpha: number;
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

/**
 * État d'une tache née il y a `age` ms ; null quand elle est éteinte. Un âge négatif
 * (l'horodatage d'une image peut précéder la naissance) vaut une tache qui naît.
 */
export function mossLevel(age: number): MossLevel | null {
  if (age >= MOSS_LIFE_MS) return null;
  age = Math.max(0, age);
  const scale = START_SCALE + (1 - START_SCALE) * easeOutCubic(Math.min(1, age / MOSS_SPREAD_MS));
  let alpha: number;
  if (age < FADE_IN_MS) alpha = age / FADE_IN_MS;
  else if (age < MOSS_SPREAD_MS) alpha = 1;
  else alpha = (1 - (age - MOSS_SPREAD_MS) / (MOSS_LIFE_MS - MOSS_SPREAD_MS)) ** 2;
  return { scale, alpha };
}

export interface MossStep {
  x: number;
  y: number;
  t: number;
}

/** Une souris qui se déplace allume une tache seulement après assez de chemin et de temps. */
export function shouldSpawn(prev: MossStep | null, next: MossStep): boolean {
  if (!prev) return true;
  if (next.t - prev.t < MOSS_STEP_MS) return false;
  return Math.hypot(next.x - prev.x, next.y - prev.y) >= MOSS_STEP_PX;
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : même mousse au repos à chaque visite. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Images clés (Web Animations) d'une tache : échantillons de mossLevel, intensité × `strength`. */
export function mossKeyframes(strength: number, samples = 16): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= samples; i++) {
    const offset = i / samples;
    const lv = mossLevel(Math.min(offset * MOSS_LIFE_MS, MOSS_LIFE_MS - 1))!;
    frames.push({ offset, transform: `scale(${lv.scale.toFixed(3)})`, opacity: +(lv.alpha * strength).toFixed(3) });
  }
  frames[samples].opacity = 0;
  return frames;
}

export type Rgb = [number, number, number];

/**
 * Une tache de mousse en SVG (256 × 256) : halo doux + semis de points lumineux, plus
 * denses et plus vifs au centre. Même graine, même tache.
 */
export function mossSprite(seed: number, [r, g, b]: Rgb): string {
  const rand = seededRandom(seed);
  const core = `rgb(${Math.min(255, r + 60)},${g},${Math.min(255, b + 20)})`;
  const col = `rgb(${r},${g},${b})`;
  const dots: string[] = [];
  for (let i = 0; i < 90; i++) {
    const d = 118 * Math.sqrt(rand()) * (0.4 + 0.6 * rand());
    const a = rand() * Math.PI * 2;
    const s = 1.2 + rand() * 3.2;
    const k = 0.55 + 0.45 * (1 - d / 128);
    dots.push(`<circle cx="${(128 + Math.cos(a) * d).toFixed(1)}" cy="${(128 + Math.sin(a) * d).toFixed(1)}" r="${(s * 2).toFixed(1)}" fill="url(#d)" opacity="${k.toFixed(2)}"/>`);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
    + `<defs><radialGradient id="h"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset=".45" stop-color="${col}" stop-opacity=".12"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="d"><stop offset="0" stop-color="${core}"/><stop offset=".4" stop-color="${col}" stop-opacity=".45"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>`
    + `<circle cx="128" cy="128" r="128" fill="url(#h)"/>${dots.join('')}</svg>`;
}
