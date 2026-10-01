/**
 * Source d'image d'une fiche (champ `cover` du contenu).
 *
 * Jusqu'au 01-10-2026, `cover` était un titre de page Fandom résolu par le
 * proxy /api/wiki-image. Fandom répond désormais par un défi anti-robot et
 * Sylvain a décidé de ne pas le contourner (L16) : le proxy est retiré.
 * Seules comptent les images que le site sert lui-même (chemin « /… ») ou une
 * URL complète ; un titre Fandom donne `undefined`, et l'appelant affiche le
 * visuel par défaut (CoverFallback) — aucune requête réseau.
 * Les titres restent dans le contenu pour retrouver les sujets en L17
 * (illustrations hébergées sur le site).
 */
export function coverImageSrc(cover?: string): string | undefined {
  if (!cover) return undefined;
  if (cover.startsWith('/') || cover.startsWith('https://')) return cover;
  return undefined;
}
