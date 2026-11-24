// Coupures des titres du codex ligne par ligne (L72, revue UX r2 de L70, m3). Pour chaque titre (bandeau
// `.section-hero__title`, cartes `.entry-card__title`), relève où il passe à la ligne et comment : à une espace ou un
// tiret (normal), à une coupure conditionnelle U+00AD (trait affiché), ou ailleurs (mot coupé par le navigateur : à
// son dictionnaire en `hyphens: auto`, ou lettre à lettre). Les caractères U+00AD eux-mêmes ne sont pas mesurés : leur
// rectangle est posé en fin de ligne quand ils servent, ce qui décalait d'une lettre le détecteur commun.
// Renvoie [{ sel, title, lines, cuts: [{ kind: 'shy' | 'other', word, before, after }], hyphenRun }] : `lines` donne le
// texte de chaque ligne (trait ajouté), `hyphenRun` le plus grand nombre de lignes de suite finies par une coupure (trait
// de U+00AD), `dashRun` le même en comptant aussi les traits d'union du texte (« arbres- / réseaux »).
export async function titleLines(page, selectors = ['.section-hero__title', '#contenu .entry-card__title']) {
  return page.evaluate((sels) => {
    const SHY = '­';
    const out = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        // Texte affiché seulement (L74) : un titre de fiche porte deux versions, l'une en `display: none`
        // (`.title-plain` / `.title-boxed`) ; avec textContent, « Morphologie » se lisait « MorphologieMorpho-logie ».
        const nodes = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.parentElement.checkVisibility()) nodes.push(n);
        const text = nodes.map((n) => n.data).join('');
        const chars = [];
        let offset = 0;
        for (const n of nodes) {
          for (let i = 0; i < n.data.length; i++) {
            const c = n.data[i];
            if (c !== SHY && !/\s/.test(c)) {
              const r = document.createRange();
              r.setStart(n, i);
              r.setEnd(n, i + 1);
              // Dernier rectangle non vide : autour d'un U+00AD qui sert, la lettre d'avant reçoit aussi un rectangle vide au
              // début de la ligne suivante, celle d'après le trait affiché en fin de ligne précédente, et
              // getBoundingClientRect les réunit.
              const rect = [...r.getClientRects()].filter((x) => x.width > 0.1).at(-1);
              if (rect && rect.width > 0.1) chars.push({ c, at: offset + i, top: rect.top, h: rect.height });
            }
          }
          offset += n.data.length;
        }
        const lines = [[]];
        const cuts = [];
        const wordAround = (at) => {
          let s = at;
          let e = at;
          while (s > 0 && /[\p{L}\p{N}'’­()]/u.test(text[s - 1])) s--;
          while (e < text.length && /[\p{L}\p{N}'’­()]/u.test(text[e])) e++;
          return { s, e };
        };
        // Lettres comptées comme titleBreaks : « œ » et « æ » pour deux (o et e liés).
        const letters = (str) => [...str.replaceAll(SHY, '')].reduce((n, c) => n + (/[œæ]/i.test(c) ? 2 : /\p{L}/u.test(c) ? 1 : 0), 0);
        for (let i = 0; i < chars.length; i++) {
          const prev = chars[i - 1];
          const cur = chars[i];
          if (prev && cur.top > prev.top + prev.h / 2) {
            const between = text.slice(prev.at + 1, cur.at);
            if (/\s/.test(between) || /[-‐–—]/.test(prev.c)) {
              if (/[-‐]/.test(prev.c)) lines[lines.length - 1].dash = true;
              lines.push([]);
            } else {
              const kind = between.includes(SHY) ? 'shy' : 'other';
              const { s, e } = wordAround(cur.at);
              cuts.push({
                kind,
                word: `${text.slice(s, cur.at)}-${text.slice(cur.at, e)}`.replaceAll(SHY, ''),
                before: letters(text.slice(s, cur.at)),
                after: letters(text.slice(cur.at, e)),
              });
              lines[lines.length - 1].push('-');
              lines[lines.length - 1].hyphen = true;
              lines.push([]);
            }
          } else if (prev && /\s/.test(text.slice(prev.at + 1, cur.at))) lines[lines.length - 1].push(' ');
          lines[lines.length - 1].push(cur.c);
        }
        let run = 0;
        let dashed = 0;
        let hyphenRun = 0;
        let dashRun = 0;
        for (const l of lines) {
          run = l.hyphen ? run + 1 : 0;
          dashed = l.hyphen || l.dash ? dashed + 1 : 0;
          hyphenRun = Math.max(hyphenRun, run);
          dashRun = Math.max(dashRun, dashed);
        }
        out.push({ sel, title: text.replaceAll(SHY, ''), lines: lines.map((l) => l.join('')), cuts, hyphenRun, dashRun });
      }
    }
    return out;
  }, selectors);
}
