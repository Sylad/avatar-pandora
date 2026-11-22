/**
 * Jour et nuit (L35, « Pandora vivant 4 », prototype validé par Sylvain le 10-10) : l'ambiance suit
 * l'heure du visiteur, la forêt des bandeaux s'illumine à mesure que la nuit tombe.
 *
 * Logique pure, sans DOM : l'heure locale donne un degré de nuit `n` (0 = plein jour, 1 = nuit
 * noire) ; `n` donne les réglages des calques, avec les formules du prototype (section 04) :
 *   image      brightness(1 − 0,66 n)            → voile noir d'opacité 0,66 n (même résultat)
 *   teinte     smooth(0,25 ; 1 ; n) × 0,8         → dégradé bleu nuit en « multiply »
 *   crépuscule 1 − |n − 0,45| / 0,25              → lueur orange et rose en « soft-light »
 *   forêt      smooth(0,4 ; 1 ; n) × 0,5          → copie de l'image en lueur cyan (« screen »)
 *   points     smooth(0,32 ; 0,92 ; n)            → points bioluminescents qui palpitent
 *
 * Réglage : « auto » (l'heure du visiteur, par défaut), « jour » ou « nuit », mémorisé dans
 * localStorage (`eywa.sky-v1`). Le script de démarrage (BaseLayout) est `skyBoot`, sérialisé tel
 * quel dans la page : il doit rester AUTONOME (aucune variable extérieure, aucun import).
 */

export type SkyMode = 'auto' | 'jour' | 'nuit';
export const SKY_MODES: readonly SkyMode[] = ['auto', 'jour', 'nuit'];
export const SKY_STORAGE_KEY = 'eywa.sky-v1';
export const SKY_EVENT = 'eywa:sky';
/** Degré de nuit des réglages manuels : plein jour, nuit noire. */
export const MANUAL_NIGHT: Record<Exclude<SkyMode, 'auto'>, number> = { jour: 0, nuit: 1 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Degré de nuit selon l'heure locale (heures décimales, 0 à 24) : jour plein de 8 h à 17 h, la nuit
 * tombe de 17 h à 22 h, nuit noire de 22 h à 5 h, l'aube de 5 h à 8 h.
 */
export function nightOfHour(h: number): number {
  const x = ((h % 24) + 24) % 24;
  if (x >= 8 && x <= 17) return 0;
  if (x > 17 && x < 22) return smooth(17, 22, x);
  if (x >= 5 && x < 8) return 1 - smooth(5, 8, x);
  return 1;
}

export function nightOf(mode: SkyMode, date: Date): number {
  if (mode === 'auto') return nightOfHour(date.getHours() + date.getMinutes() / 60);
  return MANUAL_NIGHT[mode];
}

export function parseMode(raw: unknown): SkyMode {
  return raw === 'jour' || raw === 'nuit' ? raw : 'auto';
}

/** Libellés du prototype (curseur « Heure, du plein jour à la nuit »). */
export function phaseLabel(n: number): string {
  return n < 0.18 ? 'Plein jour' : n < 0.42 ? 'Fin d’après-midi' : n < 0.62 ? 'Crépuscule' : n < 0.84 ? 'Tombée de la nuit' : 'Nuit noire';
}

/** Réglages des calques pour un degré de nuit (chaînes prêtes pour des variables CSS). */
export function skyLayers(n: number) {
  const k = clamp(n, 0, 1);
  return {
    shade: 0.66 * k,
    tint: smooth(0.25, 1, k) * 0.8,
    dusk: Math.max(0, 1 - Math.abs(k - 0.45) / 0.25),
    glow: smooth(0.4, 1, k) * 0.5,
    spots: smooth(0.32, 0.92, k),
  };
}

/** Phrase d'état du sélecteur : « 13 h 49 chez toi : plein jour ». */
export function nowLabel(date: Date, n: number): string {
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getHours()} h ${mm} chez toi : ${phaseLabel(n).toLowerCase()}`;
}

/**
 * Script de démarrage, posé `is:inline` dans le <head> (avant la première image) et rejoué après
 * chaque navigation du ClientRouter (qui remplace les attributs de <html>) et chaque minute en
 * mode auto. Pose sur <html> : data-sky-mode, data-sky-lit (points et lueur dessinés) et les
 * variables --sky-n, --sky-shade, --sky-tint, --sky-dusk, --sky-glow, --sky-spots.
 * AUTONOME : il est sérialisé par `String(skyBoot)` ; formules identiques à celles ci-dessus
 * (tests/day-night.test.mjs compare les deux).
 */
export function skyBoot(): void {
  const w = window as Window & { __eywaSky?: { apply: () => void } };
  const KEY = 'eywa.sky-v1';
  const sm = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const mode = () => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(KEY); } catch { /* stockage indisponible : auto */ }
    return raw === 'jour' || raw === 'nuit' ? raw : 'auto';
  };
  const night = (m: string) => {
    if (m === 'jour') return 0;
    if (m === 'nuit') return 1;
    const d = new Date();
    const x = d.getHours() + d.getMinutes() / 60;
    if (x >= 8 && x <= 17) return 0;
    if (x > 17 && x < 22) return sm(17, 22, x);
    if (x >= 5 && x < 8) return 1 - sm(5, 8, x);
    return 1;
  };
  const apply = () => {
    const m = mode();
    const n = night(m);
    const r = document.documentElement;
    const v: Record<string, number> = {
      n, shade: 0.66 * n, tint: sm(0.25, 1, n) * 0.8, dusk: Math.max(0, 1 - Math.abs(n - 0.45) / 0.25),
      glow: sm(0.4, 1, n) * 0.5, spots: sm(0.32, 0.92, n),
    };
    for (const k in v) r.style.setProperty(`--sky-${k}`, v[k].toFixed(3));
    r.dataset.skyMode = m;
    if (v.spots > 0.001) r.dataset.skyLit = ''; else delete r.dataset.skyLit;
  };
  if (w.__eywaSky) { w.__eywaSky.apply(); return; }
  w.__eywaSky = { apply };
  apply();
  document.addEventListener('astro:after-swap', apply);
  setInterval(() => { if (mode() === 'auto') apply(); }, 60_000);
}

/**
 * Points bioluminescents du bandeau : positions du prototype (fractions de l'image, surtout dans la
 * moitié basse, là où pousse la forêt), un sur trois, répartis en `SPOT_GROUPS` groupes qui
 * palpitent chacun à leur rythme (une animation d'opacité par groupe, pas par point). Couleurs et
 * tailles tirées d'une graine : le même ciel à chaque build.
 */
const PROTO_SPOTS: [number, number][] = [[0.125, 0.734], [0.089, 0.617], [0.022, 0.523], [0.045, 0.641], [0.129, 0.625], [0.071, 0.672], [0.147, 0.773], [0.737, 0.922], [0.246, 0.82], [0.165, 0.664], [0.629, 0.797], [0.121, 0.57], [0.188, 0.766], [0.768, 0.938], [0.759, 0.789], [0.665, 0.797], [0.812, 0.867], [0.674, 0.898], [0.277, 0.797], [0.705, 0.852], [0.277, 0.867], [0.862, 0.453], [0.759, 0.875], [0.339, 0.766], [0.196, 0.836], [0.107, 0.664], [0.058, 0.539], [0.004, 0.641], [0.272, 0.703], [0.379, 0.766], [0.214, 0.922], [0.728, 0.812], [0.076, 0.734], [0.732, 0.734], [0.304, 0.695], [0.79, 0.641], [0.777, 0.695], [0.527, 0.586], [0.482, 0.688], [0.241, 0.703], [0.196, 0.703], [0.83, 0.508], [0.893, 0.375], [0.192, 0.484], [0.116, 0.359], [0.795, 0.797], [0.781, 0.547], [0.728, 0.539], [0.705, 0.773], [0.567, 0.508], [0.246, 0.586], [0.308, 0.227], [0.638, 0.461], [0.817, 0.664], [0.312, 0.625], [0.621, 0.516], [0.433, 0.547], [0.335, 0.953], [0.272, 0.617], [0.317, 0.469], [0.433, 0.43], [0.21, 0.656], [0.58, 0.594], [0.549, 0.625], [0.464, 0.633], [0.103, 0.773], [0.527, 0.68], [0.522, 0.461], [0.647, 0.352], [0.589, 0.797], [0.388, 0.5], [0.83, 0.727], [0.554, 0.562], [0.415, 0.203], [0.357, 0.25], [0.804, 0.461], [0.089, 0.555], [0.504, 0.297], [0.826, 0.82], [0.308, 0.766], [0.406, 0.727], [0.75, 0.414], [0.018, 0.695], [0.415, 0.32], [0.795, 0.375], [0.647, 0.852], [0.848, 0.406], [0.335, 0.688], [0.665, 0.961], [0.866, 0.719], [0.879, 0.258], [0.554, 0.773], [0.853, 0.781], [0.598, 0.359], [0.371, 0.711], [0.598, 0.719], [0.897, 0.43], [0.272, 0.508], [0.487, 0.586], [0.228, 0.477], [0.772, 0.336], [0.647, 0.203], [0.754, 0.57], [0.598, 0.453], [0.237, 0.266], [0.58, 0.242], [0.384, 0.312], [0.415, 0.375], [0.348, 0.867], [0.415, 0.266], [0.616, 0.875], [0.527, 0.375], [0.237, 0.875], [0.647, 0.258], [0.504, 0.734], [0.487, 0.484], [0.71, 0.695], [0.192, 0.602], [0.987, 0.328], [0.621, 0.945], [0.027, 0.828], [0.357, 0.539], [0.201, 0.398], [0.487, 0.406], [0.473, 0.188], [0.853, 0.547], [0.768, 0.477], [0.009, 0.57], [0.156, 0.719], [0.339, 0.375]];
export const SPOT_GROUPS = 4;
/** Couleurs du prototype : cyan (moitié), vert, violet, rose. */
const SPOT_COLORS = ['95,255,230', '127,255,143', '170,130,255', '255,93,196'];

export interface SkySpot { x: number; y: number; r: number; rgb: string; group: number }

export function skySpots(): SkySpot[] {
  let seed = 35;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return PROTO_SPOTS.filter((_, i) => i % 3 === 0).map(([x, y], i) => {
    const c = rnd();
    return {
      x: x * 100,
      y: y * 100,
      r: 5 + rnd() * 10,
      rgb: SPOT_COLORS[c < 0.5 ? 0 : c < 0.75 ? 1 : c < 0.9 ? 2 : 3],
      group: i % SPOT_GROUPS,
    };
  });
}
