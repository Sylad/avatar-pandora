/**
 * L52 — adresses des miniatures YouTube d'une vidéo. Module pur, testé par node --test
 * (scripts/video-thumb.test.mjs).
 */

/** Miniature de base : celle déclarée dans la fiche, sinon hqdefault (toujours servie, 480×360). */
export function thumbFor(videoId: string, override?: string): string {
  return override ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** Adresse de la haute définition à sonder côté navigateur ; `undefined` si la fiche déclare
 *  `maxres: false` : l'adresse n'est alors jamais demandée (elle répond 404, erreur en console). */
export function maxresFor(videoId: string, maxres?: boolean): string | undefined {
  return maxres === false ? undefined : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}
