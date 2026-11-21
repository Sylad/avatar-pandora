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
 *
 * `spread` (toucher, revue UX L32 M1) : points semés sur tout le disque et halo plus vif, pour
 * que la tache se voie autour du doigt — dans les marges et entre les paragraphes — quand le
 * texte, protégé, en efface le centre.
 */
export function mossSprite(seed: number, [r, g, b]: Rgb, { spread = false } = {}): string {
  const rand = seededRandom(seed);
  const core = `rgb(${Math.min(255, r + 60)},${g},${Math.min(255, b + 20)})`;
  const col = `rgb(${r},${g},${b})`;
  const dots: string[] = [];
  const count = spread ? 150 : 90;
  for (let i = 0; i < count; i++) {
    const d = spread ? 122 * Math.sqrt(rand()) : 118 * Math.sqrt(rand()) * (0.4 + 0.6 * rand());
    const a = rand() * Math.PI * 2;
    const s = 1.2 + rand() * 3.2;
    const k = spread ? 0.75 + 0.25 * rand() : 0.55 + 0.45 * (1 - d / 128);
    dots.push(`<circle cx="${(128 + Math.cos(a) * d).toFixed(1)}" cy="${(128 + Math.sin(a) * d).toFixed(1)}" r="${(s * 2).toFixed(1)}" fill="url(#d)" opacity="${k.toFixed(2)}"/>`);
  }
  const [h0, h1] = spread ? ['.45', '.25'] : ['.3', '.12'];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
    + `<defs><radialGradient id="h"><stop offset="0" stop-color="${col}" stop-opacity="${h0}"/><stop offset=".55" stop-color="${col}" stop-opacity="${h1}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="d"><stop offset="0" stop-color="${core}"/><stop offset=".4" stop-color="${col}" stop-opacity=".45"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>`
    + `<circle cx="128" cy="128" r="128" fill="url(#h)"/>${dots.join('')}</svg>`;
}

/* ── Ni texte ni menu sous la mousse (revue UX L32 : B1, M1, m1) ─────────────────────────────
   La mousse passe au-dessus du fond des cartes (sinon, au téléphone, la fiche opaque la cachait
   sous le doigt), mais un masque l'efface sous chaque ligne de texte, image, contrôle et sous le
   menu du codex : rien de lisible n'est jamais posé sur elle. */

/** Boîte en pixels, dans le repère du calque de mousse (document entier). */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * Marge noire pleine autour d'une ligne de texte ou d'un contrôle (SHIELD_PAD_PX), puis fondu doux
 * du noir vers la mousse sur SHIELD_FADE_PX (D-6 : les deux paliers de 2 px laissaient des aplats à
 * bord net). Pas de flou SVG : rastérisé sur le fil principal, il retardait chaque page
 * (feGaussianBlur sur ~30 masques : test R7 d'illustrations 5,6 s → 47 s). Le fondu est fait de
 * SHIELD_FADE_STEPS couronnes de 1,5 px, chacune un groupe à `opacity` (l'union de ses boîtes, sans
 * assombrir là où deux lignes se recouvrent), dont le produit suit une courbe en S.
 */
export const SHIELD_PAD_PX = 5;
export const SHIELD_FADE_PX = 12;
export const SHIELD_FADE_STEPS = 8;

/**
 * Couronnes du fondu, de l'intérieur vers l'extérieur : [distance au bord de la boîte (px), opacité
 * du noir]. Entre les couronnes j-1 et j, la mousse garde la part smoothstep((j - ½) / n) de son
 * éclat (produit des transparences des couronnes j..n) ; au-delà de la dernière, toute.
 */
export const SHIELD_FEATHER: readonly [number, number][] = (() => {
  const n = SHIELD_FADE_STEPS;
  const keep = (j: number) => {
    if (j > n) return 1;
    const t = (j - 0.5) / n;
    return t * t * (3 - 2 * t);
  };
  return Array.from({ length: n }, (_, i) => {
    const j = i + 1;
    return [SHIELD_PAD_PX + (j * SHIELD_FADE_PX) / n, 1 - keep(j) / keep(j + 1)] as [number, number];
  });
})();

/** Toucher : une tache par toucher bref et presque immobile ; un glissement (défilement) n'allume rien. */
export const MOSS_TAP_PX = 12;
export const MOSS_TAP_MS = 700;
/** Toucher et clic : tache plus grande et plus longue que celle de la souris qui passe. */
export const MOSS_TAP_LIFE_MS = 4200;

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inflate = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });

/** Un doigt posé puis levé au même endroit, assez vite : un toucher (pas un défilement). */
export function isTap(down: MossStep, up: MossStep): boolean {
  return up.t - down.t <= MOSS_TAP_MS && Math.hypot(up.x - down.x, up.y - down.y) < MOSS_TAP_PX;
}

/**
 * Masque (SVG, blanc = mousse visible) d'une tache posée dans `cell` : noir sous chaque boîte
 * protégée qui la touche, agrandie de SHIELD_PAD_PX et fondue. null si rien ne la touche.
 * Les boîtes ne sont écrites qu'une fois (<defs>) : chaque couronne les reprend (<use>) avec un
 * trait arrondi d'épaisseur 2·d, qui agrandit chaque boîte de d, coins arrondis de rayon d. Écrire
 * les boîtes dans chacune des 9 couronnes triplait le coût de pose d'une tache (porte rouge, D-6).
 */
export function shieldMask(cell: Box, shields: Box[]): string | null {
  const outer = Math.max(SHIELD_PAD_PX, ...SHIELD_FEATHER.map(([d]) => d));
  const hit = shields.filter((s) => intersects(inflate(s, outer), cell));
  if (!hit.length) return null;
  const f = (n: number) => n.toFixed(1);
  const boxes = hit.map((s) => `<rect x="${f(s.x - cell.x)}" y="${f(s.y - cell.y)}" width="${f(s.w)}" height="${f(s.h)}"/>`).join('');
  const layer = (d: number, op: number) => `<use href="#b" stroke-width="${f(2 * d)}" opacity="${op.toFixed(3)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(cell.w)}" height="${f(cell.h)}" viewBox="0 0 ${f(cell.w)} ${f(cell.h)}">`
    + `<defs><g id="b">${boxes}</g></defs>`
    + '<rect width="100%" height="100%" fill="#fff"/><g fill="#000" stroke="#000" stroke-linejoin="round">'
    + SHIELD_FEATHER.map(([d, op]) => layer(d, op)).join('') + layer(SHIELD_PAD_PX, 1)
    + '</g></svg>';
}
