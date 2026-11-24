/**
 * Texte copié sans coupures conditionnelles (L72, revue UX r2 de L70, m2). Les titres du codex portent des U+00AD
 * (lib/title-breaks.ts) ; copiés tels quels, « Les peu­ples de Pan­dora » collé dans un moteur de recherche, un
 * tableur ou un terminal garde des caractères invisibles qui font échouer une recherche exacte. Un seul écouteur
 * `copy` sur le document (posé une fois : le ClientRouter garde `document`) réécrit le texte et le HTML copiés
 * quand la sélection en contient, et laisse le navigateur faire sinon.
 */
export const SOFT_HYPHEN = '­';

/** Le texte ou le HTML sans U+00AD (ni l'entité `&shy;`). */
export const stripSoftHyphens = (s: string) => s.replace(/­|&shy;/g, '');

/** Écouteur `copy` : texte et HTML de la sélection, purgés, quand elle contient une coupure conditionnelle. */
export function cleanCopy(event: ClipboardEvent): void {
  const selection = event.target instanceof Node ? event.target.ownerDocument?.getSelection() : document.getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return;
  const text = selection.toString();
  const holder = document.createElement('div');
  for (let i = 0; i < selection.rangeCount; i++) holder.append(selection.getRangeAt(i).cloneContents());
  const html = holder.innerHTML;
  if (stripSoftHyphens(text) === text && stripSoftHyphens(html) === html) return;
  event.clipboardData.setData('text/plain', stripSoftHyphens(text));
  event.clipboardData.setData('text/html', stripSoftHyphens(html));
  event.preventDefault();
}

let installed = false;
/** Pose l'écouteur une seule fois. */
export function installCleanCopy(doc: Document = document): void {
  if (installed) return;
  installed = true;
  doc.addEventListener('copy', cleanCopy);
}
