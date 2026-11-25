/**
 * Texte copié sans coupures conditionnelles (L72, revue UX r2 de L70, m2). Les titres du codex portent des U+00AD
 * (lib/title-breaks.ts) ; copiés tels quels, « Les peu­ples de Pan­dora » collé dans un moteur de recherche, un
 * tableur ou un terminal garde des caractères invisibles qui font échouer une recherche exacte. Un seul écouteur
 * `copy` sur le document (posé une fois : le ClientRouter garde `document`) réécrit le texte et le HTML copiés
 * quand la sélection en contient, et laisse le navigateur faire sinon.
 *
 * L79 (revue de code de L78) : un titre `dual` (components/TitleText.astro) porte deux versions, `.title-plain` et
 * `.title-boxed`, dont une seule est affichée. Le texte de la sélection ne lit que l'affichée, mais son HTML cloné
 * gardait les deux : au collage riche, le titre était doublé. La version masquée est retirée du HTML copié.
 */
export const SOFT_HYPHEN = '­';

/** Le texte ou le HTML sans U+00AD (ni l'entité `&shy;`). */
export const stripSoftHyphens = (s: string) => s.replace(/­|&shy;/g, '');

/** Les deux versions d'un titre `dual` (TitleText). */
export const DUAL_VERSIONS = '.title-plain, .title-boxed';

/**
 * Contenu d'une plage, sans la version masquée d'un titre `dual`. Les versions de la page qui coupent la plage sans
 * la contenir tout entière (ancêtres exclus) sont clonées dans le même ordre par `cloneContents` : la i-ième du clone
 * est la copie de la i-ième de la page, dont on lit l'affichage. Une plage tout entière DANS une version n'en clone
 * que le texte, affiché puisqu'il est sélectionné.
 */
export function cloneShown(range: Range): DocumentFragment {
  const fragment = range.cloneContents();
  const root = range.commonAncestorContainer;
  const scope = root instanceof Element ? root : root.parentElement;
  if (!scope) return fragment;
  const live = [...scope.querySelectorAll<HTMLElement>(DUAL_VERSIONS)].filter((el) => range.intersectsNode(el));
  const copies = [...fragment.querySelectorAll(DUAL_VERSIONS)];
  if (live.length !== copies.length) return fragment;
  live.forEach((el, i) => {
    if (getComputedStyle(el).display === 'none') copies[i].remove();
  });
  return fragment;
}

/** Écouteur `copy` : texte et HTML de la sélection, purgés, quand elle contient une coupure ou un titre `dual`. */
export function cleanCopy(event: ClipboardEvent): void {
  const selection = event.target instanceof Node ? event.target.ownerDocument?.getSelection() : document.getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return;
  const text = selection.toString();
  const holder = document.createElement('div');
  for (let i = 0; i < selection.rangeCount; i++) holder.append(cloneShown(selection.getRangeAt(i)));
  const html = holder.innerHTML;
  const dual = holder.querySelector(DUAL_VERSIONS) !== null;
  if (!dual && stripSoftHyphens(text) === text && stripSoftHyphens(html) === html) return;
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
