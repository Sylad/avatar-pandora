/**
 * Ikrans dans le ciel (L34, « Pandora vivant 3 », prototype validé par Sylvain le 10-10) :
 * logique pure, sans DOM — dessin, battement d'ailes, trajectoire et bande de ciel.
 *
 * L'ikran est vu de dessous : corps horizontal (tête à droite), DEUX paires d'ailes (avant,
 * grande ; arrière, plus petite), longue queue fine terminée par une palette. Jamais un dragon
 * européen (ni pattes, ni cou épais, ni ailes de chauve-souris uniques).
 *
 * Battement (« moins raide » que le prototype, qui écrasait les ailes d'un bloc avec une
 * cosinusoïde et passait sec du battement au plané) :
 *  - l'aile tourne autour de l'épaule : son envergure vue de dessous vaut cos(angle) ;
 *  - abattée rapide (40 % du coup), relevée lente ; vitesse nulle aux deux bouts (pas d'à-coup) ;
 *  - à la relevée, l'aile se replie un peu (envergure réduite) et ses pointes filent vers
 *    l'arrière (cisaillement), puis se redéploient : la main suit le bras avec retard ;
 *  - les ailes arrière suivent les ailes avant avec un décalage de phase et moins d'amplitude ;
 *  - la queue ondule en retard sur le battement ;
 *  - quelques battements puis un plané, avec une montée et une descente d'amplitude douces.
 */

const part = (cls: string, paths: string) =>
  `<div class="${cls}"><svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${paths}</svg></div>`;

/**
 * Dessin de l'ikran (viewBox 200×200, tête vers la droite), une couche HTML par partie mobile.
 * Chaque aile et la queue sont des <div> (pas des <g> SVG) : leurs transformations tournent alors
 * sur le compositeur. Animées sur des groupes SVG, elles faisaient recalculer et repeindre l'ikran
 * à chaque image sur le fil principal, et les transitions des cartes du Bestiaire (L33) n'avaient
 * plus fini dans leur délai. Classes : voir IkranSky.astro.
 */
export const IKRAN_SVG = [
  part('ikran__wing ikran__wing--rear-up', '<path class="ikran__skin" d="M90 97C88 82 80 70 66 60C69 70 65 77 58 81C66 89 73 95 78 98Z"/><path class="ikran__stripe ikran__stripe--orange" d="M84 95C81 84 75 75 68 68"/>'),
  part('ikran__wing ikran__wing--rear-down', '<path class="ikran__skin" d="M90 103C88 118 80 130 66 140C69 130 65 123 58 119C66 111 73 105 78 102Z"/><path class="ikran__stripe ikran__stripe--orange" d="M84 105C81 116 75 125 68 132"/>'),
  part('ikran__tail', '<path class="ikran__tail-line" d="M56 100C42 99 28 101 14 100"/><path class="ikran__body" d="M18 100L7 93L0 100L7 107Z"/>'),
  part('ikran__wing ikran__wing--front-up', '<path class="ikran__skin" d="M124 96C134 70 130 38 112 5C104 20 94 27 82 30C88 42 84 54 72 60C82 72 88 86 92 97Z"/><path class="ikran__stripe" d="M119 94C121 70 119 44 111 16"/><path class="ikran__stripe ikran__stripe--orange" d="M104 95C103 78 96 60 86 45"/>'),
  part('ikran__wing ikran__wing--front-down', '<path class="ikran__skin" d="M124 104C134 130 130 162 112 195C104 180 94 173 82 170C88 158 84 146 72 140C82 128 88 114 92 103Z"/><path class="ikran__stripe" d="M119 106C121 130 119 156 111 184"/><path class="ikran__stripe ikran__stripe--orange" d="M104 105C103 122 96 140 86 155"/>'),
  part('ikran__trunk', '<path class="ikran__body" d="M54 100C72 93 110 92 140 95C152 92 167 94 186 99.5C167 106 152 108 140 105C110 108 72 107 54 100Z"/><path class="ikran__body" d="M162 97L141 89L150 98ZM162 103L141 111L150 102Z"/>'),
].join('');

/** Épaules et base de la queue, en unités du viewBox (origines des transformations). */
export const IKRAN_PIVOTS = { front: [108, 100], rear: [84, 100], tail: [56, 100] } as const;

export interface FlapOptions {
  /** Durée d'un battement (ms). */
  period: number;
  /** Battements par salve. */
  flaps: number;
  /** Plané après la salve (ms). */
  glide: number;
}

export const FLAP_DEFAULT: FlapOptions = { period: 1000, flaps: 3, glide: 2600 };
/** Part du coup consacrée à l'abattée (plus rapide que la relevée). */
export const DOWNSTROKE = 0.4;
/** Angle maximal de l'aile avant (degrés). */
export const STROKE_DEG = 52;
/** Retard des ailes arrière sur les ailes avant (part d'un battement) et leur amplitude relative. */
export const REAR_LAG = 0.16;
export const REAR_GAIN = 0.75;
/** Cisaillement maximal des pointes à la relevée (degrés). */
export const SWEEP_DEG = 14;

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export const cycleMs = (o: FlapOptions = FLAP_DEFAULT) => o.flaps * o.period + o.glide;

/**
 * Amplitude du battement à l'instant t de la salve : montée sur le premier demi-battement,
 * descente sur le dernier, nulle pendant le plané.
 */
export function flapEnvelope(t: number, o: FlapOptions = FLAP_DEFAULT): number {
  const c = cycleMs(o);
  const u = ((t % c) + c) % c;
  const active = o.flaps * o.period;
  if (u >= active) return 0;
  const half = o.period / 2;
  return smoothstep(u / half) * smoothstep((active - u) / half);
}

export interface WingPose {
  /** Envergure vue de dessous (1 = déployée). */
  span: number;
  /** Cisaillement des pointes vers l'arrière (degrés, ≥ 0). */
  sweep: number;
}

/**
 * Pose d'une aile à l'instant t (ms) : `lag` en part de battement, `gain` sur l'amplitude.
 * Abattée : l'aile passe de +θ à −θ ; relevée : retour, aile un peu repliée et pointes en arrière.
 */
export function wingPose(t: number, o: FlapOptions = FLAP_DEFAULT, lag = 0, gain = 1): WingPose {
  const tl = t - lag * o.period;
  const env = flapEnvelope(tl, o) * gain;
  if (env <= 0) return { span: 1, sweep: 0 };
  const p = (((tl / o.period) % 1) + 1) % 1;
  let theta: number;
  let fold = 0;
  if (p < DOWNSTROKE) {
    theta = Math.cos((Math.PI * p) / DOWNSTROKE);
  } else {
    const q = (p - DOWNSTROKE) / (1 - DOWNSTROKE);
    theta = -Math.cos(Math.PI * q);
    fold = Math.sin(Math.PI * q);
  }
  const angle = (theta * STROKE_DEG * env * Math.PI) / 180;
  return {
    span: Math.cos(angle) * (1 - 0.16 * fold * env),
    sweep: SWEEP_DEG * fold * env,
  };
}

/** Angle de la queue (degrés) : elle ondule en retard sur le battement, et doucement au plané. */
export function tailAngle(t: number, o: FlapOptions = FLAP_DEFAULT): number {
  const env = flapEnvelope(t - 0.3 * o.period, o);
  const beat = Math.sin(2 * Math.PI * (t / o.period - 0.3));
  const drift = Math.sin((2 * Math.PI * t) / cycleMs(o));
  return 5 * env * beat + 2.5 * drift;
}

type Frame = { transform: string; offset: number };
const f3 = (n: number) => Number(n.toFixed(3));

/**
 * Images clés (Web Animations) d'une salve complète, pour chaque aile et la queue. `side` :
 * +1 aile du haut, −1 aile du bas (le cisaillement les ramène toutes deux vers l'arrière).
 */
export function flapKeyframes(o: FlapOptions = FLAP_DEFAULT, perFlap = 24) {
  const c = cycleMs(o);
  const n = Math.ceil((c / o.period) * perFlap);
  const wing = (lag: number, gain: number, side: 1 | -1): Frame[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const pose = wingPose((i / n) * c, o, lag, gain);
      return { offset: f3(i / n), transform: `skewX(${f3(side * pose.sweep)}deg) scaleY(${f3(pose.span)})` };
    });
  return {
    frontUp: wing(0, 1, 1),
    frontDown: wing(0, 1, -1),
    rearUp: wing(REAR_LAG, REAR_GAIN, 1),
    rearDown: wing(REAR_LAG, REAR_GAIN, -1),
    tail: Array.from({ length: n + 1 }, (_, i) => ({
      offset: f3(i / n),
      transform: `rotate(${f3(tailAngle((i / n) * c, o))}deg)`,
    })),
    duration: c,
  };
}

export interface Flight {
  /** Largeur de la bannière (px). */
  width: number;
  /** Côté de l'ikran (px) : envergure et longueur. */
  size: number;
  /** Altitude du centre (px depuis le haut de la bannière). */
  y: number;
  /** +1 vers la droite, −1 vers la gauche. */
  dir: 1 | -1;
  /** Vitesse (px/ms). */
  speed: number;
  /** Opacité en plein vol. */
  opacity: number;
  /** Amplitude de l'ondulation verticale (px). */
  sway: number;
  /** Phase de l'ondulation (radians). */
  phase?: number;
}

/**
 * Longueur du fondu d'entrée et de sortie, en tailles d'ikran : calée sur la position, pas sur une
 * part du trajet. L'ikran commence à paraître quand sa boîte touche le bord, et n'atteint sa pleine
 * opacité qu'une fois entré (sur un téléphone, 10 % du trajet le laissaient presque opaque à moitié
 * hors du cadre).
 */
export const FLIGHT_FADE_SIZES = 1.3;
/** Jamais plus de cette part du trajet par fondu (bannière à peine plus large que l'ikran). */
export const FLIGHT_FADE_MAX = 0.45;
/** Images clés par fondu : un smoothstep lisse, pas deux ou trois points reliés en ligne droite. */
const FADE_SAMPLES = 8;

/** Part du trajet couverte par chaque fondu. */
export const flightFadeU = (width: number, size: number) =>
  Math.min(FLIGHT_FADE_MAX, (FLIGHT_FADE_SIZES * size) / (width + size));

/**
 * Traversée complète : l'ikran entre hors champ d'un côté, sort de l'autre, en fondu aux deux
 * bouts ; il ondule et s'incline selon sa pente. Transform et opacity seulement.
 */
export function flightKeyframes(f: Flight, steps = 24) {
  const from = f.dir > 0 ? -f.size : f.width;
  const to = f.dir > 0 ? f.width : -f.size;
  const duration = Math.abs(to - from) / f.speed;
  const ph = f.phase ?? 0;
  const waves = Math.max(0.6, duration / 7000);
  const fu = flightFadeU(f.width, f.size);
  // Pas réguliers, plus des images clés serrées dans chaque fondu.
  const us = new Set<number>();
  for (let i = 0; i <= steps; i++) us.add(f3(i / steps));
  for (let k = 0; k <= FADE_SAMPLES; k++) {
    us.add(f3((fu * k) / FADE_SAMPLES));
    us.add(f3(1 - (fu * k) / FADE_SAMPLES));
  }
  const frames = [...us].sort((p, q) => p - q).map((u) => {
    const a = 2 * Math.PI * waves * u + ph;
    const x = from + (to - from) * u;
    const y = f.y - f.size / 2 + Math.sin(a) * f.sway;
    const tilt = -Math.cos(a) * 4 * f.dir;
    const fade = smoothstep(u / fu) * smoothstep((1 - u) / fu);
    return {
      offset: u,
      opacity: f3(f.opacity * fade),
      transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${f3(tilt)}deg) scaleX(${f.dir})`,
    };
  });
  return { frames, duration };
}

/** Amplitude de l'ondulation verticale d'un ikran (px). */
export const swayOf = (height: number, size: number) => Math.min(height * 0.04, size * 0.18);

/**
 * Bande d'altitude (centre de l'ikran) : ailes et ondulation comprises, sous le haut de la bannière
 * et au-dessus du texte quand il reste du ciel. Au téléphone le texte remplit presque toute la
 * bannière : l'ikran vole alors dans le tiers haut, DERRIÈRE le texte (le calque est sous le voile
 * et sous le texte).
 */
export function skyBand(height: number, textTop: number, size: number): [number, number] {
  const margin = size * 0.5 + swayOf(height, size) + 2;
  const clear = textTop - margin - 4;
  if (clear - margin >= size * 0.25) return [margin, clear];
  const lo = Math.min(margin, height * 0.2);
  return [lo, Math.max(lo, height * 0.34)];
}

/** Taille d'un ikran selon sa profondeur (0 loin, 1 près) et la largeur de la bannière. */
export function ikranSize(depth: number, width: number): number {
  const k = Math.min(1.1, Math.max(0.55, width / 1000));
  return (56 + depth * 96) * k;
}

/** Vitesse (px/ms) : les ikrans proches vont plus vite (parallaxe). */
export function ikranSpeed(depth: number, width: number): number {
  const k = Math.min(1.2, Math.max(0.75, width / 1000));
  return (0.05 + depth * 0.065) * k;
}

/** Attente avant le prochain passage spontané (ms) : « de temps en temps ». */
export const FIRST_PASS_MS = 2500;
export const PASS_MIN_MS = 7000;
export const PASS_MAX_MS = 16000;
export const nextPassDelay = (r: number) => PASS_MIN_MS + r * (PASS_MAX_MS - PASS_MIN_MS);

/** Au plus autant d'ikrans à la fois (passages spontanés ; un toucher peut en ajouter un). */
export const MAX_IKRANS = 3;
export const MAX_WITH_TAPS = 4;
