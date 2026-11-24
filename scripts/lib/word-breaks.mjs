// Mots cassés au milieu dans une page (WCAG 1.4.4 : texte agrandi), partagé par les tests du codex (L69, L70).
// Un mot (sans trait d'union ni tiret) dont les morceaux tiennent sur deux lignes est cassé, SAUF s'il est coupé à un
// point de césure, dans un élément en `hyphens: auto` ou `manual` (titres du codex depuis L72, coupures U+00AD seules) :
// le navigateur rend alors un trait (L70, titres du codex).
// Toute autre coupure — lettre à lettre par `overflow-wrap`, sans trait — reste un mot cassé.

// Points de césure qu'offre le navigateur pour `word` dans la police et la langue de `host` : le mot est posé dans une
// sonde, avec le `hyphens` et le `hyphenate-limit-chars` de `host`, sans `overflow-wrap`, qui ne peut alors passer à la
// ligne qu'à une césure ; chaque changement de ligne donne un indice de coupure. La sonde prend des largeurs de plus en
// plus étroites, de la largeur du mot à 2 px (L74) : Chromium ne césure en `hyphens: auto` que là où le morceau tient
// sur la ligne, et dans une sonde de 1 px seule il ne coupait presque jamais (« recon-naissance », bien rendu avec son
// trait, était compté cassé). En `manual`, il coupe à tout U+00AD dès la plus étroite.
function hyphenationPoints(word, host) {
  const cs = getComputedStyle(host);
  const probe = document.createElement('span');
  probe.lang = host.closest('[lang]')?.lang || 'fr';
  Object.assign(probe.style, {
    position: 'absolute', left: '-10000px', top: '0', display: 'block', inlineSize: 'max-content',
    fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
    letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
    hyphens: cs.hyphens, hyphenateLimitChars: cs.hyphenateLimitChars, overflowWrap: 'normal', wordBreak: 'normal', whiteSpace: 'normal',
  });
  probe.textContent = word;
  document.body.append(probe);
  const text = probe.firstChild;
  const points = new Set();
  const full = probe.getBoundingClientRect().width;
  for (let width = Math.floor(full); width >= 1; width = width > 8 ? Math.floor(width * 0.9) : width - 2) {
    probe.style.inlineSize = `${width}px`;
    let top = null;
    for (let i = 0; i < word.length; i++) {
      const r = document.createRange();
      r.setStart(text, i);
      r.setEnd(text, i + 1);
      const t = [...r.getClientRects()].filter((x) => x.width > 0.1).at(-1)?.top;
      if (t === undefined) continue;
      if (top !== null && t > top + 1) points.add(i);
      top = t;
    }
  }
  probe.remove();
  return points;
}

// Colonnes de la grille et mots cassés au milieu dans le contenu (un mot dont les morceaux tiennent sur deux lignes).
// Un mot coupé à un point de césure, dans un élément en `hyphens: auto` ou `manual`, porte son trait : il est compté
// à part (`hyphenated`), pas comme cassé. Toute autre coupure (lettre à lettre, sans trait) est un mot cassé.
// Renvoie { broken, hyphenated } pour le texte sous `rootId` (mots, coupure au besoin marquée « - »).
export async function wordBreaks(page, rootId = 'contenu') {
  // La sonde est passée par son source : page.evaluate n'emporte pas les fonctions du module.
  return page.evaluate(`(() => { const hyphenationPoints = ${hyphenationPoints}; return (${(rootId) => {
    const broken = [];
    const hyphenated = [];
    const walker = document.createTreeWalker(document.getElementById(rootId), NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const [k, n] of nodes.entries()) {
      const host = n.parentElement;
      if (!host || host.closest('svg, script, style, .sr-only')) continue;
      const cs = getComputedStyle(host);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      for (const m of n.textContent.matchAll(/[^\s\-‐–—\/]+/gu)) {
        if (m[0].length < 2) continue;
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        // Deux morceaux sur des lignes différentes : l'un commence sous le milieu de l'autre.
        const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
        if (!rects.some((a) => rects.some((b) => b.top > a.top + a.height / 2))) continue;
        // Indices où le mot change de ligne.
        const cuts = [];
        let top = null;
        for (let i = 0; i < m[0].length; i++) {
          const r = document.createRange();
          r.setStart(n, m.index + i);
          r.setEnd(n, m.index + i + 1);
          // Dernier rectangle non vide (comme title-lines.mjs, L74) : autour d'une césure qui sert, la lettre qui suit
          // reçoit aussi le rectangle du trait, en fin de ligne précédente, et getBoundingClientRect les réunissait — le
          // mot paraissait coupé une lettre plus loin, hors de son point de césure (« perma|nent » lu « perman|ent »).
          const rect = [...r.getClientRects()].filter((x) => x.width >= 0.5).at(-1);
          if (!rect) continue;
          if (top !== null && rect.top > top + rect.height / 2) cuts.push(i);
          top = rect.top;
        }
        const word = m[0].replaceAll('\u00AD', '');
        // Mot partagé entre deux nœuds de texte (L74 : « Pandora » mis en lueur par le script des termes, dans
        // « Pandorapedia ») : la sonde reçoit le mot entier, le fragment seul n'a pas les mêmes césures.
        // Lettres seules : « *Pandora » (astérisques d'un résumé) n'a pas les césures de « Pandora ».
        const prefix = m.index === 0 && /\p{L}$/u.test(m[0][0] ? nodes[k - 1]?.data ?? '' : '') && /^\p{L}/u.test(m[0]) ? (nodes[k - 1].data.match(/[\p{L}'’]+$/u)?.[0] ?? '') : '';
        const suffix = m.index + m[0].length === n.data.length && /\p{L}$/u.test(m[0]) ? (nodes[k + 1]?.data.match(/^[\p{L}'’]+/u)?.[0] ?? '') : '';
        const points = cs.hyphens !== 'none'
          ? new Set([...hyphenationPoints(prefix + m[0] + suffix, host)].map((i) => i - prefix.length))
          : new Set();
        if (cuts.length && cuts.every((i) => points.has(i))) {
          hyphenated.push(`${cuts.reduceRight((w, i) => `${w.slice(0, i)}-${w.slice(i)}`, m[0]).replaceAll('\u00AD', '')} (${host.className.split(' ')[0]})`);
        } else broken.push(`${word} (coupé à ${cuts.join(', ') || '?'})`);
      }
    }
    return { broken, hyphenated };
  }})(${JSON.stringify(rootId)}); })()`);
}
