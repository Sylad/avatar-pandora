# Carte — Eywa (avatar-pandora)

## Illustrations du codex (L17)
- Écrans : bandeau 21:9 de chaque fiche (alt = `coverAlt`, repris en légende de la visionneuse), cartes 4:3 des listes (alt vide, le titre nomme le lien), bandeaux de section décoratifs.
- Source : illustrations générées en local (Stable Diffusion XL base 1.0, licence CreativeML Open RAIL++-M), texte seul, aucune image des films ni d'un autre site. Refaire : `scripts/illustrations/generer.py` puis `preparer.py`. Hors bestiaire, seule `personnages/spider` garde le visuel par défaut.
- Décision (correction de revue) : README (Crédits, Disclaimer) et CLAUDE.md (Fair-use, Sources) décrivent cet état ; R4 de `scripts/illustrations.test.mjs` refuse un `coverAlt` qui reprend le titre de la fiche (en entier ou son nom avant « — »).

## Bestiaire en images des films (L63, D-2 et D-3)

- Écrans : `/bestiaire/` (cartes 640×480, ligne « Images des créatures : © 20th Century Studios » sous la liste) et les 14 fiches `/bestiaire/<créature>/` (bandeau 1344×576, légende `figcaption.entry-cover-caption` avec le crédit puis le lien « Fiche officielle sur Pandorapedia »). La visionneuse affiche « description — crédit » (`data-credit` sur l'image). La page À propos explique d'où viennent les images.
- Source : images des films (images fournies par Sylvain, images officielles de Pandorapedia, plans de la vidéo de comparaison). Chaque image a son entrée dans `scripts/illustrations/films.json` (source exacte, crédit, alt, cadrage). Les images sources restent hors du dépôt, dans `~/projects/developpeur/tmp/l63-refs/`. Pour refaire les WebP et le front matter : `python -I scripts/illustrations/films.py <dossier-refs> [--seul bestiaire/x]`, avec Pillow et opencv-python-headless dans un venv jetable.
- Schéma : `coverCredit` n'accepte que « © 20th Century Studios » et exige `cover`.
- Décisions :
  - 19-11, décision de Sylvain : images des films avec crédit discret, site gardé en noindex ;
  - plus d'image générée pour une créature : les entrées SDXL du bestiaire restent dans `illustrations.json` en `branchee: false` ;
  - `glow-snake` n'a aucune bonne image et garde `CoverFallback`.
- Tests : `scripts/illustrations.test.mjs` contrôle la source et le crédit tracés (R10 et R11), le crédit en légende et dans la visionneuse, ainsi que la liste du bestiaire (R7).
