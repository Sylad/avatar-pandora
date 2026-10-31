# Attendus QA — Eywa

Ce que le visiteur anonyme doit trouver sur le site public https://avatar-pandora-12q.pages.dev.
Brouillon écrit le 29-10-2026 (lot L43) à partir de la QA de L42 ; lu par l'agent `qa-reviewer` de cadence
après chaque livraison. Site 100 % statique : pas d'API, donc aucune ligne `api:`. Valeurs « mesuré le 29-10 » :
ordres de grandeur du jour sur `frontend/dist` (Chromium sans tête, 1440×900 et 390×900), pas des seuils —
l'attendu est la forme décrite. Les seuils chiffrés des fiches (16 px, `.entry-body` non vide) sont rejoués à chaque
build par `scripts/qa-expectations.test.mjs` (`cd frontend && npm run test:scripts`). Non couvert : l'ambiance
de l'accueil (boucle de 75 s, particules WebGL), `/langue/`, `/videos/`, `/plan-de-travail/` (couverts
par leurs propres tests de `scripts/`).

## *
- never: défilement horizontal de la page (scrollWidth == clientWidth) à 390 et à 1440 px (mesuré le 29-10 sur `/` et `/nouveautes/`)
- never: « undefined », « [object Object] », « NaN » dans le texte visible

## /
- shows: le titre de l'onglet « Eywa — Codex de Pandora » ; un seul `h1` dont le logo (svg `role=img`, nom « Eywa ») donne le nom
- shows: les deux boutons d'entrée vers `/pandora/intro/` et `/about/`, puis la rangée « Suivre le codex » avec Nouveautés (`/nouveautes/`) et Plan de travail (`/plan-de-travail/`), le tout visible sans défilement à 1440×900 et à 390×844
- shows: les liens de la phrase d'accroche vers `/pandora/eywa/`, `/clans/`, `/bestiaire/` et `/langue/`
- never: ChatGPT cité nulle part (règle du projet, même pour le nier)

## /nouveautes/
- shows: le titre de l'onglet « Nouveautés — Eywa » ; un `h1` « Ce qui a changé » ; au moins une entrée (`article` avec son `h2`, 10 le 29-10) en ordre antichronologique
- shows: sur chaque entrée un `article` avec `id=<slug>` (cible de `/nouveautes/#<slug>`) et un bouton « Copier le lien » (devient « Lien copié » ou « Lien dans l’adresse » après usage) dont le `data-slug` est cet id ; il n’y a pas de lien `<a>` `/nouveautes/#<slug>` dans l’entrée (mesuré le 31-10 : 18 `article`, 18 `id`, 18 boutons)
- shows: les captures de chaque entrée chargées (aucune image cassée : `naturalWidth > 0` pour toute `img` qui a une source ; la visionneuse vide n’en a pas)
- never: bandeau « N nouveautés depuis ta dernière visite » à la toute première visite (mémoire de base posée dès la première page vue)

## /about/
- shows: le titre de l'onglet « À propos — Eywa », `html lang=fr` ; un seul `h1` « Vibe coded avec Claude Code & Codex » ; quatre `h2` : L'histoire courte, Sous le capot, Sources & inspirations, Mes autres sites (mesuré le 31-10 ; trois `h3` : Frontend, Identité, Infra)
- shows: `ul.about-sources` de 4 `li` et `ul.about-sites` de 4 `li`
- shows: 9 liens sortants, tous `target=_blank`, avec un vrai `href` et le texte caché « (nouvel onglet) » ; le lien en ligne « Claude Code » est souligné et montre un anneau net au clavier (`:focus-visible`, contour 2 px mesuré le 31-10)
- shows: deux éléments `[lang=en]` (« Vibe coded » et « Made with curiosity »)
- never: texte visible de `main` sous 12 px ; ChatGPT cité nulle part
- Rejoué sur la page construite par `scripts/qa-expectations.test.mjs` (R5), sans le texte sous 12 px ni l'anneau, mesurés par la QA dans un navigateur.

## /pandora/<fiche>/
- shows: `article .entry-body` non vide (texte > 0 caractère) ; le vide entre deux paragraphes voisins du corps (`.entry-body > p`) ≥ 16 px à 390 et à 1440 px (mesuré le 29-10 : ≈ 20 px, marge basse 1,1 em de 18 px)
- never: fiche sans `.entry-body` (les 7 modèles de fiche le portent)

## /clans/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px
- never: fiche sans `.entry-body`

## /bestiaire/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px
- never: fiche sans `.entry-body`

## /flore/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px (fiche de référence : `/flore/hometree/`, mesuré le 29-10 : marge basse 1,1 em ≈ 21,66 px aux deux largeurs)
- never: fiche sans `.entry-body`

## /personnages/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px
- never: fiche sans `.entry-body`

## /films/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px
- never: fiche sans `.entry-body`

## /engins/<fiche>/
- shows: `article .entry-body` non vide ; vide ≥ 16 px entre deux `p` voisins à 390 et à 1440 px
- never: fiche sans `.entry-body`
