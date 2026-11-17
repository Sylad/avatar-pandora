// Lance la CLI Astro avec un Node qu'elle accepte (L59).
// Astro 7 refuse de démarrer avant Node 22.23.4. Le Node du PATH peut être plus ancien (porte de tests des
// vagues, Node par défaut de la machine) : on relance alors avec le Node épinglé par `.nvmrc`, installé par nvm.
// Sur Cloudflare Pages, NODE_VERSION fournit déjà un Node récent : lancement direct, nvm inutile.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** « v22.23.5 » ou « 22.23.5 » → [22, 23, 5]. */
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  return m ? m.slice(1).map(Number) : null;
}

/** Vrai si `version` ≥ `min` (les deux en « x.y.z »). */
export function atLeast(version, min) {
  const [a, b] = [parseVersion(version), parseVersion(min)];
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/**
 * Choisit le binaire Node : `null` = le Node courant convient ; sinon le chemin du Node de `.nvmrc`.
 * Lève une erreur claire si aucun Node acceptable n'est disponible (jamais de lancement silencieux trop ancien).
 */
export function pickNode({ current, min, nvmrc, nvmDir, exists }) {
  if (atLeast(current, min)) return null;
  const pinned = parseVersion(nvmrc) ? `v${parseVersion(nvmrc).join('.')}` : null;
  if (pinned && atLeast(pinned, min)) {
    const bin = join(nvmDir, 'versions', 'node', pinned, 'bin', 'node');
    if (exists(bin)) return bin;
  }
  throw new Error(
    `Node ${current} est trop ancien pour Astro (>= ${min}) et le Node de .nvmrc (${String(nvmrc).trim() || 'absent'}) ` +
      `n'est pas installé sous ${nvmDir} : « nvm install » dans le dépôt.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const frontend = join(root, 'frontend');
  const astroPkg = JSON.parse(readFileSync(join(frontend, 'node_modules', 'astro', 'package.json'), 'utf8'));
  const min = astroPkg.engines.node.replace(/^>=\s*/, '');
  const nvmrcPath = join(root, '.nvmrc');
  let bin;
  try {
    bin = pickNode({
      current: process.version,
      min,
      nvmrc: existsSync(nvmrcPath) ? readFileSync(nvmrcPath, 'utf8') : '',
      nvmDir: process.env.NVM_DIR || join(homedir(), '.nvm'),
      exists: existsSync,
    }) ?? process.execPath;
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (bin !== process.execPath) console.error(`astro-node : Node ${process.version} trop ancien pour Astro, relance avec ${bin}`);
  const cli = join(frontend, 'node_modules', 'astro', 'bin', 'astro.mjs');
  // Le Node choisi passe en tête du PATH : les sous-processus d'Astro (et de Vite) l'utilisent aussi.
  const env = { ...process.env, PATH: `${join(bin, '..')}:${process.env.PATH ?? ''}` };
  const r = spawnSync(bin, [cli, ...process.argv.slice(2)], { stdio: 'inherit', cwd: process.cwd(), env });
  process.exit(r.status ?? 1);
}
