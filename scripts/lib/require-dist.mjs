// Garde de `npm run test:scripts` (L59, 17-11-2026) : les tests navigateur lisent le site construit.
// Sans frontend/dist, ils échouaient par dizaines (158 sur 246) avec des messages trompeurs
// (« vignettes : 0 », délais dépassés) ; on s'arrête ici en une ligne qui dit quoi faire.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const index = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));
if (!existsSync(index)) {
  console.error('frontend/dist absent : lancer `npm run build` dans frontend/ avant `npm run test:scripts`.');
  process.exit(1);
}
