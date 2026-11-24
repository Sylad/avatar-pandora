// L77 — suites de lignes finies par une coupure dans le texte courant (usage typographique : 3 au plus de suite).
// Chromium ignore `hyphenate-limit-lines` : la mesure se fait sur le rendu. Pour chaque bloc (paragraphe, élément de
// liste, résumé…) sous `selector`, chaque mot (suite de caractères sans espace) dont les morceaux tiennent sur deux
// lignes ou plus finit une ligne par une coupure — césure avec trait, trait d'union d'un mot composé ou mot cassé : la
// ligne se lit pareil. Les lignes du bloc sont numérotées par leur position verticale ; une suite = des lignes
// consécutives du bloc qui finissent toutes par une coupure.
// Renvoie [{ block, length, words }] pour chaque suite d'au moins `min` lignes.
export async function hyphenRuns(page, selector, min = 1) {
  return page.evaluate(([sel, least]) => {
    const isBlock = (el) => /^(block|list-item|flow-root|table-cell)$/.test(getComputedStyle(el).display);
    const blocks = new Map();
    for (const root of document.querySelectorAll(sel)) {
      if (!root.checkVisibility()) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const host = n.parentElement;
        if (!host || !host.checkVisibility() || host.closest('svg, script, style, .sr-only, pre, code')) continue;
        let block = host;
        while (block !== root && !isBlock(block)) block = block.parentElement;
        if (!blocks.has(block)) blocks.set(block, { tops: [], cuts: [] });
        const b = blocks.get(block);
        for (const m of n.data.matchAll(/\S+/gu)) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
          if (!rects.length) continue;
          for (const r of rects) b.tops.push(r);
          const first = rects[0];
          const later = rects.filter((r) => r.top > first.top + first.height / 2);
          if (later.length) {
            // Chaque passage à la ligne dans le mot : la ligne du morceau qui précède finit par une coupure.
            const lines = [];
            for (const r of rects) if (!lines.some((t) => Math.abs(t.top - r.top) < r.height / 2)) lines.push(r);
            for (const r of lines.slice(0, -1)) b.cuts.push({ rect: r, word: m[0].replaceAll('­', '') });
          }
        }
      }
    }
    const out = [];
    for (const [block, { tops, cuts }] of blocks) {
      if (!cuts.length) continue;
      // Lignes du bloc : positions verticales distinctes (à une demi-ligne près).
      const lines = [];
      for (const r of [...tops].sort((a, b) => a.top - b.top)) {
        const last = lines.at(-1);
        if (!last || r.top > last.top + last.height / 2) lines.push({ top: r.top, height: r.height });
      }
      const lineOf = (r) => lines.findIndex((l) => Math.abs(l.top - r.top) < Math.max(l.height, r.height) / 2);
      const cut = new Map();
      for (const c of cuts) cut.set(lineOf(c.rect), c.word);
      const idx = [...cut.keys()].sort((a, b) => a - b);
      let run = [];
      const flush = () => {
        if (run.length >= least) {
          out.push({ block: (block.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60), length: run.length, words: run.map((i) => cut.get(i)) });
        }
        run = [];
      };
      for (const i of idx) {
        if (run.length && i !== run.at(-1) + 1) flush();
        run.push(i);
      }
      flush();
    }
    return out;
  }, [selector, min]);
}
