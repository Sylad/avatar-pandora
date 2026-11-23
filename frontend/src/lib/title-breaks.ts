/**
 * Coupures des titres du codex (L70, WCAG 1.4.4). Les titres grandissent avec le texte (tailles en rem) ; dans un
 * cadre plus étroit que le plus long mot, ils passent en `hyphens: auto`. Mais le dictionnaire français de Chromium
 * refuse de rejeter une syllabe muette finale (« peu-ples », « œu-vres », « ar-bres », « jun-gle », « plan-tes ») et
 * ignore les noms na'vi (« Ateyo'i-tan ») : à 390 px texte 200 %, « œuvres, » fait 330 px dans un bandeau de 318, et
 * sans point de coupure le mot se cassait lettre à lettre, sans trait.
 *
 * `titleBreaks` pose une coupure conditionnelle (U+00AD, rendue par un trait) entre les syllabes de chaque mot, par
 * les règles de base de la division française : jamais entre deux voyelles, une consonne seule passe avec la voyelle
 * qui suit, deux consonnes se séparent sauf groupe inséparable (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, vr),
 * ch, ph, th, gn, qu et gu (devant e, i) comptent pour une consonne ; au moins 2 lettres avant la première coupure
 * et 3 après la dernière (après l'élision : « d'Oma-ti-kaya ») ; rien contre une apostrophe. Toutes les syllabes et pas une seule : un mot qui porte une
 * coupure conditionnelle perd les césures automatiques du navigateur (CSS Text 3, § 5.4).
 *
 * Les coupures sont inertes tant que le titre est en `hyphens: none` (réglage normal : rendu inchangé). Lecteurs
 * d'écran et recherche dans la page ignorent U+00AD.
 */
export const SOFT_HYPHEN = '­';

const VOWELS = 'aeiouyàâäéèêëîïôöùûüÿœæ';
const isVowel = (c: string) => VOWELS.includes(c.toLowerCase());
const isApostrophe = (c: string) => c === "'" || c === '’';
const DIGRAPHS = new Set(['ch', 'ph', 'th', 'gn']);
const INSEPARABLE_SECOND = new Set(['l', 'r']);
const INSEPARABLE_FIRST = new Set(['b', 'c', 'd', 'f', 'g', 'p', 't', 'v', 'ch', 'ph', 'th']);
const NOT_BEFORE_L = new Set(['d', 't', 'v']); // « dl », « tl », « vl » se séparent
const MIN_BEFORE = 2;
const MIN_AFTER = 3;

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

/** Indices (en unités UTF-16 de `word`) où une coupure est permise. */
export function syllableBreaks(word: string): number[] {
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
  // Lettres avant la coupure comptées après une élision (« d'O-matikaya » laisserait une lettre seule) ; une
  // apostrophe au milieu d'un nom na'vi (coup de glotte, « Ateyo'itan ») ne compte que pour elle-même.
  const elision = word.match(/^(?:qu|\p{L}{1,2})['’]/iu)?.[0].length ?? 0;
  const lettersBefore = (at: number) => [...word.slice(elision, at)].filter((c) => !isApostrophe(c)).length;
  const lettersAfter = (at: number) => [...word.slice(at)].filter((c) => !isApostrophe(c)).length;
  return breaks.filter((at) => lettersBefore(at) >= MIN_BEFORE && lettersAfter(at) >= MIN_AFTER);
}

/** Le titre avec une coupure conditionnelle entre les syllabes de chaque mot. */
export function titleBreaks(title: string): string {
  return title.replace(/[\p{L}'’]+/gu, (word) => {
    const breaks = syllableBreaks(word);
    return breaks.reduceRight((w, at) => w.slice(0, at) + SOFT_HYPHEN + w.slice(at), word);
  });
}
