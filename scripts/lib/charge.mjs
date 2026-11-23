// L68 — charge CPU provoquée, pour éprouver la porte de tests sous charge (stress-ng n'est pas installé sur Big-Blue).
// `node scripts/lib/charge.mjs <fils> <secondes>` : <fils> fils qui calculent sans arrêt pendant <secondes>, à la
// priorité normale (comme les autres runs qui chargeaient Big-Blue le 23-11), puis s'arrêtent seuls.
// Exemple (32 cœurs, charge 40 à 70 attendue) : `node scripts/lib/charge.mjs 48 1800 &` puis la porte.
// Hors de la suite : ce fichier n'est pas un `*.test.mjs`.
import { Worker, isMainThread, workerData } from 'node:worker_threads';

if (isMainThread) {
  const threads = Number(process.argv[2] ?? 48);
  const seconds = Number(process.argv[3] ?? 600);
  const until = Date.now() + seconds * 1000;
  for (let i = 0; i < threads; i++) new Worker(new URL(import.meta.url), { workerData: until });
  console.log(`charge (pid ${process.pid}) : ${threads} fils jusqu'à ${new Date(until).toLocaleTimeString('fr-FR')}`);
} else {
  let x = 0;
  while (Date.now() < workerData) for (let i = 0; i < 1e6; i++) x = (x * 1103515245 + 12345) % 2147483648;
}
