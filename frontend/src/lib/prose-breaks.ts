/**
 * L74 — coupures du texte des fiches du codex et des Nouveautés (WCAG 1.4.4, 1.4.10).
 *
 * Intertitres (`h2` à `h4` du Markdown, `proseHtml`) : même règle que les titres hors codex (L73, `titleSegments`) — chaque mot qui
 * porte une coupure est une boîte `.title-word`, qui ne se coupe à ses U+00AD (avec un trait, 3 lettres de chaque côté)
 * que s'il est plus large que la ligne ; nom accessible sans U+00AD par `aria-label`. Avant L74, à 320 px texte 175 et
 * 200 %, « overflow-wrap: anywhere » les cassait lettre à lettre (« Morpholog|ie », « propulsi|on »).
 *
 * Texte courant : la césure française du navigateur (`hyphens: auto`, global.css et nouveautes.astro, seulement dans
 * un gabarit très étroit pour son texte). Mais Chromium ne césure pas un mot collé à une espace insécable : entre
 * guillemets (« «\u202Fbioluminescente\u202F» », 246 px de ligne à 320 px texte 200 %) il était cassé sans trait,
 * « bioluminescen|te ». Isolé dans un `<span>` sans style, le même mot se coupe à sa syllabe, avec son trait (mesuré :
 * « biolumines-|cente »). `proseSegments` isole donc chaque mot de 7 lettres ou plus qui touche une espace insécable ;
 * un `<span>` nu ne change rien au rendu quand la césure est éteinte (réglage normal).
 *
 * Les espaces avant « : ; ! ? » du texte courant restent telles quelles : les rendre insécables (comme les titres depuis
 * L73) déplaçait des passages à la ligne au réglage normal (« froideur / : c'est », /personnages/tonowari-ronal/ à
 * 1440 px), que L74 ne doit pas changer.
 */
import { titleSegments } from './title-breaks.ts'; // extension : les tests (node --test) importent ce module tel quel

export type ProseSegment = { text: string; word: boolean };

const GLUED = /[\p{L}\p{N}'’]{7,}(?=[\u00A0\u202F])|(?<=[\u00A0\u202F])[\p{L}\p{N}'’]{7,}/gu;

/** Le texte courant en morceaux : `word` = mot à isoler dans un `<span>` (collé à une espace insécable). */
export function proseSegments(text: string): ProseSegment[] {
  const out: ProseSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(GLUED)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length || !out.length) out.push({ text: text.slice(last), word: false });
  return out;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|#39);/gi, (all, e: string) => {
    const k = e.toLowerCase();
    if (k === 'nbsp') return ' ';
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return all;
  });

/**
 * Le HTML rendu d'une fiche du codex (`entry.rendered.html`) ou d'une entrée des Nouveautés (rendu par cadence), posé par
 * `set:html`, avec ces règles : intertitres `h2` à `h4` en boîtes de mots coupables (`titleSegments`, `aria-label` = leur
 * texte), texte courant avec ses mots collés isolés (`proseSegments`). Le texte entre les balises seulement (jamais un
 * attribut : les `alt` des captures gardent leur texte), rien dans `<code>`, `<pre>`, `<script>`, `<style>`, `<svg>`.
 * Pas de plugin Markdown : Sätteri, le moteur Markdown d'Astro 7, n'accepte pas les plugins rehype sans une dépendance
 * de plus (`@astrojs/markdown-remark`).
 */
export function proseHtml(html: string): string {
  let skip = 0;
  let heading: { open: string; tag: string; parts: string[] } | null = null;
  let out = '';
  for (const [, tag, text] of html.matchAll(/(<[^>]*>)|([^<]+)/g)) {
    if (tag) {
      const name = tag.match(/^<\/?([a-z0-9]+)/i)?.[1]?.toLowerCase() ?? '';
      const closing = tag.startsWith('</');
      if (SKIP.has(name) && !tag.endsWith('/>')) skip = closing ? Math.max(0, skip - 1) : skip + 1;
      if (!skip && HEADINGS.has(name) && !closing) { heading = { open: tag, tag: name, parts: [] }; continue; }
      if (heading && closing && name === heading.tag) { out += headingHtml(heading.open, heading.parts) + tag; heading = null; continue; }
      if (heading) heading.parts.push(tag);
      else out += tag;
      continue;
    }
    if (heading) { heading.parts.push(text); continue; }
    out += skip ? text : proseTextHtml(text);
  }
  return out;
}

const HEADINGS = new Set(['h2', 'h3', 'h4']);
const SKIP = new Set(['code', 'pre', 'script', 'style', 'svg']);

function proseTextHtml(text: string): string {
  const plain = decode(text);
  const segments = proseSegments(plain);
  if (segments.length === 1 && !segments[0].word && segments[0].text === plain) return text;
  return segments.map((s) => (s.word ? `<span>${escapeHtml(s.text)}</span>` : escapeHtml(s.text))).join('');
}

/** Un intertitre : chaque morceau de texte en boîtes de mots (L73), nom accessible = texte du titre sans U+00AD ; le texte
 * d'origine à côté, affiché hors du gabarit étroit (`.title-plain` / `.title-boxed`, global.css). */
function headingHtml(open: string, parts: string[]): string {
  const label = parts.filter((p) => !p.startsWith('<')).map(decode).join('').replace(/\s+/g, ' ').trim();
  const inner = parts
    .map((p) => (p.startsWith('<') ? p : titleSegments(decode(p)).map((s) => (s.word ? `<span class="title-word">${escapeHtml(s.text)}</span>` : escapeHtml(s.text))).join('')))
    .join('');
  const plain = parts.join('');
  if (inner === plain) return open + inner;
  const withLabel = /\saria-label=/.test(open) ? open : open.replace(/^<([a-z0-9]+)/i, `<$1 aria-label="${escapeHtml(label).replace(/"/g, '&quot;')}"`);
  // Deux versions, comme le titre de la fiche (TitleText `dual`, global.css) : l'original hors du gabarit étroit.
  return `${withLabel}<span class="title-plain">${plain}</span><span class="title-boxed">${inner}</span>`;
}
