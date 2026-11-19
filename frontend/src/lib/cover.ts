/**
 * Source d'image d'une fiche (champ `cover` du contenu).
 *
 * Jusqu'au 01-10-2026, `cover` était un titre de page Fandom résolu par le
 * proxy /api/wiki-image. Fandom répond désormais par un défi anti-robot et
 * Sylvain a décidé de ne pas le contourner (L16) : le proxy est retiré.
 * Seules comptent les images que le site sert lui-même (chemin « /… ») ou une
 * URL complète ; un titre Fandom donne `undefined`, et l'appelant affiche le
 * visuel par défaut (CoverFallback) — aucune requête réseau.
 *
 * L17 : illustrations propres au site, dans `public/illustrations/`. Chacune
 * existe en deux tailles (cf. scripts/illustrations/) :
 *   /illustrations/<section>/<fiche>.webp        bandeau de la fiche, 21:9
 *   /illustrations/<section>/<fiche>-carte.webp  carte de la liste, 4:3
 * Une fiche sans illustration garde son titre Fandom (sujet à illustrer) et
 * le visuel par défaut.
 */

/** Dimensions des deux tailles d'une illustration du site (pixels). */
export const ILLUSTRATION_SIZES = {
  fiche: { width: 1344, height: 576 },
  carte: { width: 640, height: 480 },
} as const;

const ILLUSTRATION = /^\/illustrations\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;

export function coverImageSrc(cover?: string): string | undefined {
  if (!cover) return undefined;
  if (cover.startsWith('/') || cover.startsWith('https://')) return cover;
  return undefined;
}

/** Vrai si `cover` désigne une illustration du site (deux tailles servies). */
export function isIllustration(cover?: string): boolean {
  return !!cover && ILLUSTRATION.test(cover);
}

/** Image de la carte : la taille 4:3 d'une illustration, sinon l'image elle-même. */
export function coverCardSrc(cover?: string): string | undefined {
  const src = coverImageSrc(cover);
  if (!src || !isIllustration(src)) return src;
  return src.replace(/\.webp$/, '-carte.webp');
}
