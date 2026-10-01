import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Clip d'ambiance lu par <AmbientAudio /> (chemin public). */
export const AMBIENT_AUDIO_SRC = '/audio/eywa-ambient.mp3';

/**
 * Vrai si le clip existe dans public/ AU MOMENT DU BUILD. Tant qu'il n'y est pas,
 * le bouton d'ambiance sonore n'est pas rendu du tout (un bouton qui ne joue rien
 * trompait le visiteur) ; il réapparaît tout seul au build qui suit le dépôt du
 * fichier. Le build tourne depuis frontend/ (Cloudflare Pages ou npm run build).
 */
export function hasAmbientAudio(root: string = process.cwd()): boolean {
  return existsSync(join(root, 'public', AMBIENT_AUDIO_SRC));
}

export const HAS_AMBIENT_AUDIO = hasAmbientAudio();
