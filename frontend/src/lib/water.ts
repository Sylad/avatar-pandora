/**
 * Eau vivante (L36, « Pandora vivant 5 », prototype validé par Sylvain le 10-10) — logique pure de
 * l'ondulation des bandeaux « océan » (components/WaterRipple.astro).
 *
 * Un anneau naît au point touché, s'élargit en ralentissant et s'éteint : dans sa bande, l'image est
 * réfractée (déplacée le long du rayon par plusieurs crêtes) et un liseré clair suit la crête. Le
 * plancton lumineux dérive vers la surface et s'écarte de chaque anneau.
 *
 * Ce qui coûte (rendu WebGL, components/WaterRipple.astro) et ses bornes :
 *  • le nombre de pixels du canevas (un fragment par pixel et par image) : densité bornée à WATER_DPR_MAX,
 *    largeur du canevas bornée à WATER_CANVAS_MAX_PX ;
 *  • les anneaux, une boucle par fragment : au plus MAX_RIPPLES (les plus anciens cèdent la place) ;
 *  • la texture de l'image : une seule, TEXTURE_W × TEXTURE_H (2 Mo, 2,7 Mo avec les mipmaps) ;
 *  • le plancton : PLANKTON_COUNT points (PLANKTON_COUNT_SMALL sous 600 px de large), mis à jour en JS ;
 *  • la boucle d'animation ne tourne que bandeau visible, onglet affiché, ambiance non en pause.
 */

/** Anneaux vivants au plus (uniformes du shader). */
export const MAX_RIPPLES = 8;
/** Texture de l'image : puissance de deux (mipmaps aussi en WebGL 1), quel que soit l'écran. */
export const TEXTURE_W = 1024;
export const TEXTURE_H = 512;
/** Densité de pixels du canevas, au plus. */
export const WATER_DPR_MAX = 1.5;
/** Largeur du canevas en pixels réels, au plus. */
export const WATER_CANVAS_MAX_PX = 1600;
/** Plancton : nombre de points selon la largeur du bandeau. */
export const PLANKTON_COUNT = 48;
export const PLANKTON_COUNT_SMALL = 30;
export const PLANKTON_SMALL_BELOW_PX = 600;

/** Durée de vie d'un anneau fort (toucher, clic, goutte) et d'un anneau léger (souris qui passe). */
export const STRONG_LIFE_MS = 2600;
export const LIGHT_LIFE_MS = 1700;
/** Déplacement maximal de l'image dans la bande, en px CSS (le prototype ne dépassait pas ~3 px : trop discret). */
export const STRONG_AMP_PX = 14;
export const LIGHT_AMP_PX = 7;
/** Portée finale de l'anneau, en part du petit côté du bandeau. */
export const STRONG_REACH = 0.62;
export const LIGHT_REACH = 0.32;

/** Souris : un anneau léger tous les MOVE_STEP_PX parcourus. */
export const MOVE_STEP_PX = 48;
/** Sans geste depuis IDLE_AFTER_MS, une goutte tombe toutes les DROP_EVERY_MS. */
export const IDLE_AFTER_MS = 5000;
export const DROP_EVERY_MS = 3400;
/** Première goutte après l'arrivée sur la page. */
export const FIRST_DROP_MS = 1800;

export interface Ripple {
  x: number;
  y: number;
  born: number;
  strong: boolean;
}

export interface RippleLevel {
  /** Rayon de la crête, en px CSS. */
  radius: number;
  /** Demi-largeur de la bande déformée, en px CSS. */
  band: number;
  /** Déplacement maximal de l'image, en px CSS. */
  amp: number;
  /** Intensité (liseré, fondu), de 1 à 0. */
  alpha: number;
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

export const rippleLife = (strong: boolean) => (strong ? STRONG_LIFE_MS : LIGHT_LIFE_MS);

/**
 * État d'un anneau né il y a `age` ms sur un bandeau dont le petit côté vaut `base` px ;
 * null quand il est éteint. Un âge négatif vaut un anneau qui naît.
 */
export function rippleLevel(age: number, strong: boolean, base: number): RippleLevel | null {
  const life = rippleLife(strong);
  if (age >= life) return null;
  const k = Math.max(0, age) / life;
  const fade = 1 - k;
  const reach = strong ? STRONG_REACH : LIGHT_REACH;
  return {
    radius: 6 + base * reach * easeOutCubic(k),
    band: (strong ? 14 : 9) + (strong ? 22 : 12) * fade,
    amp: (strong ? STRONG_AMP_PX : LIGHT_AMP_PX) * fade * fade,
    alpha: fade,
  };
}

/** Ajoute un anneau ; les plus anciens cèdent la place au-delà de MAX_RIPPLES. */
export function pushRipple(list: Ripple[], r: Ripple): Ripple[] {
  list.push(r);
  if (list.length > MAX_RIPPLES) list.splice(0, list.length - MAX_RIPPLES);
  return list;
}

/** Retire les anneaux éteints à l'instant `now`. */
export function pruneRipples(list: Ripple[], now: number): Ripple[] {
  for (let i = list.length - 1; i >= 0; i--) if (now - list[i].born >= rippleLife(list[i].strong)) list.splice(i, 1);
  return list;
}

/** Une souris qui passe fait un anneau léger seulement après assez de chemin. */
export function shouldRippleOnMove(prev: { x: number; y: number } | null, next: { x: number; y: number }): boolean {
  return !prev || Math.hypot(next.x - prev.x, next.y - prev.y) >= MOVE_STEP_PX;
}

/** Une goutte tombe-t-elle à `now` ? (aucun geste depuis IDLE_AFTER_MS, et l'heure de la suivante passée). */
export function dropDue(now: number, lastInteract: number, nextDrop: number): boolean {
  return now - lastInteract >= IDLE_AFTER_MS && now >= nextDrop;
}

/**
 * Image en « object-fit: cover » : échelle et décalage des coordonnées de texture, pour qu'un point du
 * canevas (0..1) lise le même pixel que l'<img> affichée. uv = p × scale + offset.
 */
export function coverUv(imgW: number, imgH: number, boxW: number, boxH: number) {
  const s = Math.max(boxW / imgW, boxH / imgH);
  const sx = boxW / (imgW * s), sy = boxH / (imgH * s);
  return { scale: [sx, sy] as [number, number], offset: [(1 - sx) / 2, (1 - sy) / 2] as [number, number] };
}

/** Taille du canevas en pixels réels : densité et largeur bornées. */
export function canvasSize(cssW: number, cssH: number, dpr: number) {
  let k = Math.min(dpr || 1, WATER_DPR_MAX);
  if (cssW * k > WATER_CANVAS_MAX_PX) k = WATER_CANVAS_MAX_PX / cssW;
  return { width: Math.max(1, Math.round(cssW * k)), height: Math.max(1, Math.round(cssH * k)), scale: k };
}

export const planktonCount = (cssW: number) => (cssW < PLANKTON_SMALL_BELOW_PX ? PLANKTON_COUNT_SMALL : PLANKTON_COUNT);

export interface Mote {
  /** Position en part du bandeau (0..1). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Taille du point en px CSS. */
  size: number;
  /** 0 cyan, 1 rose, 2 blanc d'écume. */
  hue: 0 | 1 | 2;
  phase: number;
}

export function makePlankton(n: number, rand: () => number): Mote[] {
  return Array.from({ length: n }, () => {
    const h = rand();
    return {
      x: rand(), y: rand(), vx: 0, vy: 0,
      size: 1.4 + rand() * 2.8,
      hue: (h < 0.6 ? 0 : h < 0.8 ? 1 : 2) as Mote['hue'],
      phase: rand() * Math.PI * 2,
    };
  });
}

/** Rayon (px CSS) dans lequel un anneau qui naît écarte le plancton. */
export const PUSH_RADIUS_PX = 170;

/** Le plancton s'écarte du point touché (force décroissante avec la distance). */
export function pushPlankton(motes: Mote[], x: number, y: number, strong: boolean, W: number, H: number): void {
  for (const m of motes) {
    const dx = m.x * W - x, dy = m.y * H - y;
    const d = Math.hypot(dx, dy) || 1;
    if (d >= PUSH_RADIUS_PX) continue;
    const f = (1 - d / PUSH_RADIUS_PX) * (strong ? 0.0009 : 0.00035);
    m.vx += (dx / d) * f * (H / W);
    m.vy += (dy / d) * f;
  }
}

/** Avance le plancton de `dt` ms : dérive lente vers le haut, élan amorti, retour par le bord opposé. */
export function stepPlankton(motes: Mote[], dt: number, t: number, rand: () => number): void {
  const damp = Math.pow(0.96, dt / 16.7);
  for (const m of motes) {
    m.x += (m.vx + Math.sin(t * 0.0005 + m.phase) * 0.000012) * dt;
    m.y += (m.vy - 0.000014) * dt;
    m.vx *= damp;
    m.vy *= damp;
    if (m.y < -0.03) { m.y = 1.03; m.x = rand(); }
    if (m.y > 1.03) m.y = -0.03;
    if (m.x < -0.03) m.x = 1.03;
    if (m.x > 1.03) m.x = -0.03;
  }
}

/**
 * Diamètre du halo d'un point, par unité de `size` (px CSS) : 6,4 comme le prototype sur un bandeau large,
 * réduit jusqu'à 4,2 sur un bandeau de téléphone (~310 px), où les halos couvraient l'image.
 */
export const moteScale = (cssW: number) => 4.2 + 2.2 * Math.min(1, Math.max(0, (cssW - 320) / 440));

/** Éclat d'un point de plancton à l'instant t (0,1 à 0,8) : il palpite doucement. */
export const moteGlow = (m: Mote, t: number) => 0.45 + 0.35 * Math.sin(t * 0.0012 + m.phase);
