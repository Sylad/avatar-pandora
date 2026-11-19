# Carte — Eywa (avatar-pandora)

## Illustrations du codex (L17)
- Écrans : bandeau 21:9 de chaque fiche (alt = `coverAlt`, repris en légende de la visionneuse), cartes 4:3 des listes (alt vide, le titre nomme le lien), bandeaux de section décoratifs.
- Source : illustrations générées en local (Stable Diffusion XL base 1.0, licence CreativeML Open RAIL++-M), texte seul, aucune image des films ni d'un autre site. Refaire : `scripts/illustrations/generer.py` puis `preparer.py`. Seule `personnages/spider` garde le visuel par défaut.
- Décision (correction de revue) : README (Crédits, Disclaimer) et CLAUDE.md (Fair-use, Sources) décrivent cet état ; R4 de `scripts/illustrations.test.mjs` refuse un `coverAlt` qui reprend le titre de la fiche (en entier ou son nom avant « — »).
