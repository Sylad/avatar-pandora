/**
 * Coupures des titres du codex (L70, WCAG 1.4.4). Les titres grandissent avec le texte (tailles en rem) ; dans un
 * cadre plus étroit que le plus long mot, ils passaient en `hyphens: auto` (`manual` depuis L72). Mais le dictionnaire français de Chromium
 * refuse de rejeter une syllabe muette finale (« peu-ples », « œu-vres », « ar-bres », « jun-gle », « plan-tes ») et
 * ignore les noms na'vi (« Ateyo'i-tan ») : à 390 px texte 200 %, « œuvres, » fait 330 px dans un bandeau de 318, et
 * sans point de coupure le mot se cassait lettre à lettre, sans trait.
 *
 * `titleBreaks` pose une coupure conditionnelle (U+00AD, rendue par un trait) entre les syllabes de chaque mot, par
 * les règles de base de la division française : jamais entre deux voyelles, une consonne seule passe avec la voyelle
 * qui suit, deux consonnes se séparent sauf groupe inséparable (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, vr),
 * ch, ph, th, gn, qu et gu (devant e, i) comptent pour une consonne ; au moins 3 lettres de chaque côté (L72 ; après
 * l'élision : « d'Oma-ti-kaya ») ; rien contre une apostrophe ; table EXCEPTIONS pour les mots anglais et les noms
 * na'vi. Les titres sont en `hyphens: manual` (L72) : le navigateur ne coupe qu'à ces U+00AD, jamais à son
 * dictionnaire (« Ts-kaha », mot sans coupure permise, n'est plus coupé).
 *
 * Les coupures sont inertes tant que le titre est en `hyphens: none` (réglage normal : rendu inchangé). Elles ne sortent
 * jamais du titre : son nom accessible est le titre sans U+00AD (`aria-label`), et le texte copié en est purgé
 * (`lib/soft-hyphen-copy.ts`, L72, revue UX r2 de L70 : « Les peu­ples de Pan­dora » dans le presse-papier).
 */
export const SOFT_HYPHEN = '­';

const VOWELS = 'aeiouyàâäéèêëìîïôöùûüÿœæ'; // « ì » : na'vi (Tsahìk, Angtsìk)
const isVowel = (c: string) => VOWELS.includes(c.toLowerCase());
const isApostrophe = (c: string) => c === "'" || c === '’';
const DIGRAPHS = new Set(['ch', 'ph', 'th', 'gn']);
const INSEPARABLE_SECOND = new Set(['l', 'r']);
const INSEPARABLE_FIRST = new Set(['b', 'c', 'd', 'f', 'g', 'p', 't', 'v', 'ch', 'ph', 'th']);
const NOT_BEFORE_L = new Set(['d', 't', 'v']); // « dl », « tl », « vl » se séparent
/** Au moins 3 lettres de chaque côté d'une coupure (L72, revue UX r2 de L70 : « di- », « in- », « en-tre »). */
export const MIN_BEFORE = 3;
export const MIN_AFTER = 3;

/**
 * Mots que la division française coupe mal (L72) : mots anglais et composés, coupés à leurs vraies frontières
 * (« dire-horse », pas « di-re-horse » ; « gun-ship », pas « guns-hip »), noms na'vi aux digraphes de la langue
 * (« ng », « ts » : « Rong-loa », « Ang-tsìk »), et « inter-stel-laire » (préfixe). Clé en minuscules ; « - » marque
 * chaque coupure permise, un mot sans « - » n'est jamais coupé. La règle des 3 lettres s'applique aussi ici.
 */
export const EXCEPTIONS: Record<string, string> = {
  direhorse: 'dire-horse',
  woodsprites: 'wood-sprites',
  gunship: 'gun-ship',
  banshee: 'ban-shee',
  hometree: 'home-tree',
  unobtainium: 'unob-tain-ium',
  tiltrotor: 'tilt-ro-tor',
  skimwing: 'skim-wing',
  crabsuit: 'crab-suit',
  sturmbeest: 'sturm-beest',
  selfridge: 'self-ridge',
  // L73 (revue UX de L72, m2) : noms de personnes jamais coupés (usage typographique français ; « Qua-ritch » se lisait
  // contre la prononciation). Ils tiennent dans la carte à 320 px texte 200 % (R1 de codex-grid-text).
  spellman: 'spellman',
  quaritch: 'quaritch',
  chacon: 'chacon',
  scorpion: 'scor-pion',
  interstellaire: 'inter-stel-laire',
  rongloa: 'rong-loa',
  angtsìk: 'ang-tsìk',
  tskaha: 'tskaha',
  // L73 : nom de chaîne en un mot (/videos/), coupé à ses mots ; « plectroscope » à ses racines (revue UX r1 de L73, m2 :
  // la division française donnait « Plectros-cope »).
  linksthesun: 'links-the-sun',
  plectroscope: 'plec-tro-scope',
};

/**
 * Titres en anglais (`lang: 'en'`, titres des vidéos anglaises de /videos/, revue UX r1 de L73, m2) : la division
 * française y coupait à faux (« Unders-tands », « Filmma-kers », « Minu-tes », « Came-ron »). Un mot anglais ne se
 * coupe qu'aux frontières de cette table (césure anglaise des dictionnaires, 3 lettres de chaque côté), ou à celles de
 * EXCEPTIONS (mots composés, noms na'vi) ; tout autre mot anglais n'est jamais coupé. Le possessif suit son nom
 * (« Cam-eron's »). Clé en minuscules, « - » marque chaque coupure permise.
 */
export const EN_EXCEPTIONS: Record<string, string> = {
  understands: 'under-stands',
  filmmakers: 'film-mak-ers',
  minutes: 'min-utes',
  cameron: 'cam-eron',
  encyclopaedia: 'encyclo-pae-dia',
  everything: 'every-thing',
  biology: 'biol-ogy',
  official: 'offi-cial',
  sigourney: 'sig-our-ney',
  winning: 'win-ning',
  pandora: 'pan-dora',
  avatar: 'ava-tar',
  tedxusc: 'tedx-usc', // « (TEDxUSC) », marque et université : coupé entre les deux
};

type Unit = { text: string; at: number; kind: 'V' | 'C' | 'A' };

function units(word: string): Unit[] {
  const chars = [...word];
  const out: Unit[] = [];
  let at = 0;
  for (let i = 0; i < chars.length; ) {
    const c = chars[i];
    const pair = (c + (chars[i + 1] ?? '')).toLowerCase();
    let text = c;
    let kind: Unit['kind'] = isApostrophe(c) ? 'A' : isVowel(c) ? 'V' : 'C';
    if (kind === 'C' && DIGRAPHS.has(pair)) text = c + chars[i + 1];
    else if (kind === 'C' && pair === 'qu' && chars[i + 2] && isVowel(chars[i + 2])) text = c + chars[i + 1];
    else if (kind === 'C' && pair === 'gu' && chars[i + 2] && 'eiyéèêë'.includes(chars[i + 2].toLowerCase())) text = c + chars[i + 1];
    else if (kind === 'V') {
      let j = i + 1;
      while (j < chars.length && isVowel(chars[j])) j++;
      text = chars.slice(i, j).join('');
    }
    out.push({ text, at, kind });
    at += text.length;
    i += [...text].length;
  }
  return out;
}

const inseparable = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return INSEPARABLE_SECOND.has(y) && INSEPARABLE_FIRST.has(x) && !(y === 'l' && NOT_BEFORE_L.has(x));
};

/**
 * Repli des titres de bandeau (L72) : un mot de section qui n'a aucune coupure à 3 lettres (« ré-seaux », « sa-crées »,
 * « hu-maine », « œu-vres », « ar-bres ») est plus large que le bandeau à 320–1024 px texte agrandi et s'y cassait
 * sans trait (L71). Pour ce seul mot, s'il a au moins 6 lettres, la première coupure qui laisse 2 lettres avant (minimum de la typographie
 * française, `lefthyphenmin` 2 de TeX) est permise. Jamais pour les cartes, qui n'en ont pas besoin.
 */
export type BreakOptions = { fallbackBefore?: number; lang?: 'fr' | 'en' };

/** Indices (en unités UTF-16 de `word`) où une coupure est permise. */
export function syllableBreaks(word: string, { fallbackBefore, lang = 'fr' }: BreakOptions = {}): number[] {
  const key = word.toLowerCase();
  const stem = lang === 'en' ? key.replace(/['’]s$/, '') : key;
  const known = (lang === 'en' ? EN_EXCEPTIONS[stem] : undefined) ?? EXCEPTIONS[key];
  if (known) return withinLimits(word, [...known].reduce<number[]>((acc, c, i) => (c === '-' ? [...acc, i - acc.length] : acc), []), 0);
  if (lang === 'en') return [];
  const raw = rawBreaks(word);
  const elision = word.match(/^(?:qu|\p{L}{1,2})['’]/iu)?.[0].length ?? 0;
  const strict = withinLimits(word, raw, elision);
  // Un mot de 5 lettres tient toujours dans le bandeau (« seaux », 238 px dans 248 à 320 px texte 200 %) : pas de repli.
  if (strict.length || !fallbackBefore || [...word].length < 6) return strict;
  return withinLimits(word, raw, elision, fallbackBefore).slice(0, 1);
}

function rawBreaks(word: string): number[] {
  const u = units(word);
  const breaks: number[] = [];
  let prevVowel = u.findIndex((x) => x.kind === 'V');
  if (prevVowel < 0) return breaks;
  for (let i = prevVowel + 1; i < u.length; i++) {
    if (u[i].kind === 'A') { prevVowel = -1; continue; } // rien de part et d'autre d'une apostrophe
    if (u[i].kind !== 'V') continue;
    if (prevVowel >= 0) {
      const cluster = u.slice(prevVowel + 1, i);
      let cut: Unit | undefined;
      if (cluster.length === 1) cut = cluster[0];
      else if (cluster.length >= 2) {
        const [a, b] = cluster.slice(-2);
        cut = inseparable(a.text, b.text) ? a : b;
      }
      if (cut) breaks.push(cut.at);
    }
    prevVowel = i;
  }
  return breaks;
}

/**
 * Les coupures qui laissent au moins `minBefore` lettres avant et MIN_AFTER après. Lettres avant comptées après une
 * élision (« d'O-matikaya » laisserait une lettre seule) ; une apostrophe au milieu d'un nom na'vi (coup de glotte,
 * « Ateyo'itan ») ne compte pour rien ; « œ » compte pour deux lettres (o et e liés).
 */
function withinLimits(word: string, breaks: number[], elision: number, minBefore = MIN_BEFORE): number[] {
  const count = (part: string) => [...part].reduce((n, c) => n + (isApostrophe(c) ? 0 : /[œæ]/i.test(c) ? 2 : 1), 0);
  return breaks.filter((at) => count(word.slice(elision, at)) >= minBefore && count(word.slice(at)) >= MIN_AFTER);
}

/** Le titre avec une coupure conditionnelle entre les syllabes de chaque mot. */
export function titleBreaks(title: string, options: BreakOptions = {}): string {
  return title.replace(/[\p{L}'’]+/gu, (word) => {
    const breaks = syllableBreaks(word, options);
    return breaks.reduceRight((w, at) => w.slice(0, at) + SOFT_HYPHEN + w.slice(at), word);
  });
}

/**
 * L73 — titres hors des listes du codex (/langue/, /videos/, À propos, Nouveautés, Plan de travail, 404) et mots du
 * repli des bandeaux. Le navigateur remplit chaque ligne au plus loin : avec des U+00AD actifs, il coupe un mot qui
 * tiendrait seul sur la ligne suivante (« Les ar- / bres- / ré- / seaux », revue UX de L72, m1). Chaque mot qui porte
 * une coupure est rendu dans une boîte `inline-block` (`.title-word`, global.css) : le mot passe d'abord entier à la
 * ligne, et ne se coupe, à ses U+00AD, que s'il est plus large qu'une ligne entière. Au réglage normal, où tout mot
 * tient sur une ligne, le rendu ne change pas.
 *
 * Un « mot » va d'une espace à l'autre, ponctuation comprise (« Nouveautés, », « (Palulukan) ») ; un mot composé se
 * sépare après son trait d'union (« arbres- » | « réseaux »), où la ligne peut toujours passer. Tout mot qui a une
 * coupure est en boîte, bandeaux du codex compris (revue UX r1 de L73, m1 : hors boîte, « plantes » et « sacrées » se
 * coupaient alors qu'ils tenaient entiers sur la ligne, « et plan- / tes sa- / crées »).
 *
 * Ponctuation haute (« : », « ; », « ! », « ? ») : l'espace qui la précède devient insécable (U+00A0 devant « : »,
 * U+202F fine devant les autres, typographie française) pour qu'elle ne soit jamais rejetée seule en début de ligne
 * (« Personnages / : le bandeau », revue UX r1 de L73). Pas dans un titre anglais (`lang: 'en'`), qui n'a pas d'espace.
 */
export type TitleSegment = { text: string; word: boolean };
export type SegmentOptions = BreakOptions;

export function frenchSpaces(title: string): string {
  return title.replace(/ +([:;!?])/g, (_, p: string) => (p === ':' ? '\u00A0' : '\u202F') + p);
}

export function titleSegments(title: string, options: SegmentOptions = {}): TitleSegment[] {
  const out: TitleSegment[] = [];
  const push = (text: string, word: boolean) => {
    const last = out.at(-1);
    if (last && !last.word && !word) last.text += text;
    else if (text) out.push({ text, word });
  };
  const text = options.lang === 'en' ? title : frenchSpaces(title);
  for (const token of text.split(/( +)/)) {
    if (/^ *$/.test(token)) { push(token, false); continue; }
    for (const part of token.split(/(?<=[-‐])(?=.)/u)) {
      const broken = titleBreaks(part, options);
      push(broken, broken !== part);
    }
  }
  return out;
}
