# Carte — Eywa (avatar-pandora)

## Illustrations du codex (L17)
- Écrans : bandeau 21:9 de chaque fiche (alt = `coverAlt`, repris en légende de la visionneuse), cartes 4:3 des listes (alt vide, le titre nomme le lien), bandeaux de section décoratifs.
- Source : illustrations générées en local (Stable Diffusion XL base 1.0, licence CreativeML Open RAIL++-M), texte seul, aucune image des films ni d'un autre site. Refaire : `scripts/illustrations/generer.py` puis `preparer.py`. Hors bestiaire, seule `personnages/spider` garde le visuel par défaut.
- Décision (correction de revue) : README (Crédits, Disclaimer) et CLAUDE.md (Fair-use, Sources) décrivent cet état ; R4 de `scripts/illustrations.test.mjs` refuse un `coverAlt` qui reprend le titre de la fiche (en entier ou son nom avant « — »).

## Bestiaire en images des films (L63, D-2 et D-3)

- Écrans : `/bestiaire/` (cartes 640×480, ligne « Images des créatures : © 20th Century Studios » sous la liste) et les 14 fiches `/bestiaire/<créature>/` (bandeau 1344×576, légende `figcaption.entry-cover-caption` avec le crédit puis le lien « Fiche officielle sur Pandorapedia »). La visionneuse affiche « description — crédit » (`data-credit` sur l'image). La page À propos explique d'où viennent les images.
- Source : images des films (images fournies par Sylvain, images officielles de Pandorapedia ; les plans de la vidéo de comparaison ont été refusés le 20-11). Chaque image a son entrée dans `scripts/illustrations/films.json` (source exacte, crédit, alt, cadrage). Les images sources restent hors du dépôt, dans `~/projects/developpeur/tmp/l63-refs/`. Pour refaire les WebP et le front matter : `python -I scripts/illustrations/films.py <dossier-refs> [--seul bestiaire/x]`, avec Pillow et opencv-python-headless dans un venv jetable.
- Schéma : `coverCredit` n'accepte que « © 20th Century Studios » et exige `cover`.
- Décisions :
  - 19-11, décision de Sylvain : images des films avec crédit discret, site gardé en noindex ;
  - plus d'image générée pour une créature : les entrées SDXL du bestiaire restent dans `illustrations.json` en `branchee: false` ;
  - `glow-snake` n'a aucune bonne image et garde `CoverFallback` ;
  - 20-11, décision de Sylvain sur la planche : `akula`, `nantang` et `hexapede` (modèles 3D sur grille tirés de la vidéo de comparaison, pas des plans du film) reprennent `CoverFallback`. Leurs entrées restent dans `films.json` avec `"retenue": false` et leur raison ; `films.py` les saute.
- Tests : `scripts/illustrations.test.mjs` contrôle la source et le crédit tracés (R10 et R11), le crédit en légende et dans la visionneuse, ainsi que la liste du bestiaire (R7) ; R12 contrôle les images refusées (raison notée, rien de servi).

## Titres du codex à 320 px, texte agrandi (L71)

- Écrans : les 7 listes du codex (bandeau `SectionHero` et cartes `EntryCard`), et toute page sous `CodexLayout` (fiches comprises) à 320 px avec le texte à 175 ou 200 %.
- Décision : pas de titre plus petit ni de coupure forcée. Dans un gabarit `eywa-codex` de moins de 10,75 em (320 px texte 175 % = 10,45 em, 200 % = 9,1 em ; 390 px texte 200 % = 11,1 em), les marges latérales de la page, du bandeau et des cartes reprennent leur taille du réglage normal (0,5 / 0,5 / 0,75 rem). « seaux » (238 px) tient alors dans le bandeau (248 px) et « Mo'at'ite » (190 px) comme « (2009) » tiennent dans la carte (230 px). Le même seuil est écrit dans CodexLayout, SectionHero et EntryCard.
- Mesure : la géométrie est identique au commit précédent (46 704 éléments, 10 pages, 320 à 1440 px, texte 100 à 200 %), sauf à 320 px texte 175 et 200 % ; une mesure témoin (ancien contre ancien) donne 0 écart.
- Tests : `scripts/codex-grid-text.e2e.test.mjs`. R1 (aucun mot cassé sans trait) et R5 (titres ×2 avec le texte) couvrent 320 px ; R6 vérifie que le mode étroit ne s'allume qu'à 320 px texte 175 et 200 %.

## Coupures des titres du codex, vues du lecteur (L72)

- Écrans : bandeaux `SectionHero` et cartes `EntryCard` des 7 listes du codex, quand le texte est agrandi et que la césure s'allume.
- Copier : un seul écouteur `copy` sur le document (`lib/soft-hyphen-copy.ts`, posé par `BaseLayout`) retire les U+00AD du texte et du HTML copiés. Nom accessible : `aria-label={title}` sans U+00AD sur le h1 et le h2 des cartes (le lien de la carte garde le titre en tête de son nom).
- Décisions :
  - titres en `hyphens: manual` : le navigateur ne coupe qu'aux U+00AD de `titleBreaks`, jamais à son dictionnaire (« Ts-kaha » n'est plus coupé) ;
  - au moins 3 lettres de chaque côté (`MIN_BEFORE`, `MIN_AFTER`, `hyphenate-limit-chars`), « œ » compté pour 2 lettres ;
  - table `EXCEPTIONS` pour les mots anglais et les noms na'vi (« dire-horse », « gun-ship », « Rong-loa », « Ang-tsìk ») ;
  - repli à 2 lettres avant pour les seuls bandeaux et les seuls mots de 6 lettres ou plus sans autre coupure (« ré-seaux », « sa-crées », « hu-maine », « ar-bres ») : sans ce repli, ces mots cassaient sans trait à 320–1024 px, ce qui contredit L71 ;
  - au plus 2 lignes à trait de suite, sauf « tech- / nolo- / gie hu- / maine » (/engins/ à 390 px texte 200 %) : les largeurs des mots l'imposent, et ni `text-wrap: pretty` ni `balance` n'y changent rien.
- Tests : `scripts/title-breaks.test.mjs` (règles, table, tous les titres du site) et `scripts/title-breaks.e2e.test.mjs` (C1 presse-papier, C2 arbre d'accessibilité par CDP, C3 coupures ligne par ligne de 320 à 1440 px avec `scripts/lib/title-lines.mjs`).

## Titres hors des listes du codex, et mots en boîte (L73)

- Écrans : /langue/ (h1 de section, intertitres, lexique), À propos, 404, Nouveautés, Plan de travail, Vidéos ; le sur-titre de `MetaHeader` ; le h1 des bandeaux `SectionHero`.
- Mécanisme : `TitleText.astro` rend un titre par `titleSegments` (`lib/title-breaks.ts`). Chaque mot qui porte une coupure devient une boîte `.title-word` (`inline-block`, `hyphens: manual`, global.css). La boîte passe entière à la ligne et ne se coupe à ses U+00AD que si elle est plus large que la ligne. Chaque titre porte `aria-label` sans U+00AD, et le copier passe par `lib/soft-hyphen-copy.ts` (L72).
- Décisions :
  - pages hors codex en `wrap: 'all'` ; bandeaux du codex en `wrap: 'fallback'`. Dans ce second mode, seules les parties d'un mot composé coupées par le repli à 2 lettres sont en boîte (« ar·bres- », « ré·seaux »). Une boîte autour d'un mot plus large que la ligne coûte une ligne (« tes / sa- / crées » à 1440 px 175 %) ;
  - le trait d'union d'un composé compte dans « 2 lignes à trait de suite au plus » (C3, `dashRun`). « Les ar- / bres- / ré- / seaux » ne reste que là où ni « arbres- » ni « réseaux » ne tient seul sur une ligne (320 px 150 à 200 %, 390 px et 768 px 200 %, mesures dans le test) ;
  - Quaritch, Spellman et Chacon ne sont jamais coupés (table `EXCEPTIONS`, revue de L72 m2) ;
  - écrans étroits pour leur texte, par container query : `eywa-codex` (11,5 em) pour /langue/, Nouveautés, Vidéos et MetaHeader ; `eywa-about` (13 em) pour À propos ; `not-found` (10,8 em) pour le h1 du 404, qui passe à 1,5 rem car « n'existe » n'a aucune coupure permise. Le lexique de /langue/ s'y empile (rôles ARIA de tableau dans le balisage) ;
  - sur-titre de MetaHeader : « · Eywa » est une boîte insécable (`inline-block`), au lieu d’espaces insécables qui rendaient tout le sur-titre insécable et faisaient défiler la page (378 px pour 320).
- Mesure : à 100 %, de 390 à 1440 px, la géométrie est identique au commit précédent (18 384 éléments, 15 pages, 0 écart > 0,5 px).
- Non traité : les ~70 fiches du codex (h1 `entry-title` et intertitres du Markdown) ont le même défaut à 320 px 175 et 200 %. Le texte courant de Nouveautés garde deux mots cassés par `anywhere` à 320 px 200 %.
- Tests : `scripts/title-breaks-pages.e2e.test.mjs` (P1 : coupures et défilement de 320 à 390 px, texte 125 à 200 % ; P2 : copier et noms accessibles ; P3 : rien ne change à 100 %), `title-breaks.test.mjs` (titleSegments, noms propres), C3 de `title-breaks.e2e.test.mjs` (150 % ajouté).
