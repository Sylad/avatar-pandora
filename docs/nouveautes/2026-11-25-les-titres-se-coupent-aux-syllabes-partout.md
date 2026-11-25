---
title: "Tous les titres se coupent aux syllabes, même quand la page charge mal"
date: 2026-11-25
created: 2026-11-25T09:15+01:00
lots: [L78]
captures: [{ file: captures/L78-about-avant.png, alt: "Avant : carte de la source « refactoringui.com » dans À propos, sur un téléphone de 320 pixels, texte agrandi deux fois ; l'adresse se casse au milieu d'un mot, « refactori / ngui.com »" }, { file: captures/L78-about-apres.png, alt: "Après : même écran, même texte agrandi ; l'adresse passe à la ligne entre ses deux mots, « refactoring / ui.com », suivie de sa flèche" }]
---
Si tu agrandis beaucoup le texte sur un petit écran, tous les titres du site se coupent maintenant comme ceux des fiches : un mot passe entier à la ligne, et ne se coupe entre deux syllabes, avec un trait, que s'il est plus large que la ligne. C'est vrai aussi des titres des Nouveautés, du Plan de travail et des encadrés de À propos, et même si une partie de l'habillage de la page ne se charge pas : la page Films cassait alors ses titres sans trait (« Avata / r »).

Sur À propos, l'adresse du livre Refactoring UI passe à la ligne entre ses deux mots, au lieu de se casser au milieu de l'un d'eux. Au réglage normal, rien ne change.
