/**
 * L51 — texte alternatif d'une capture des Nouveautés. Module pur, testé par node --test
 * (scripts/news-alt.test.mjs).
 */

/** Texte alternatif de la capture `index` : celui déclaré dans l'entrée (`alts`, même ordre que
 *  `captures`) s'il n'est pas vide, sinon un repli construit sur le titre. */
export function captureAlt(
  entry: { title: string; captures: readonly string[]; alts?: readonly string[] },
  index: number,
): string {
  const declared = entry.alts?.[index]?.trim();
  if (declared) return declared;
  return entry.captures.length > 1
    ? `Capture d'écran ${index + 1} sur ${entry.captures.length} : ${entry.title}`
    : `Capture d'écran : ${entry.title}`;
}
