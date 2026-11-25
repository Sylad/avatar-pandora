---
title: "Tous les titres se coupent aux syllabes, même quand la page charge mal"
date: 2026-11-25
created: 2026-11-25T09:15+01:00
lots: [L78]
captures: [{ file: captures/L78-about-titre-avant.png, alt: "Avant : haut de la page À propos sur un écran de 320 pixels, police du navigateur réglée au double ; le titre casse « Claude » sans trait, « Claud » sur une ligne et « e » seul sur la suivante" }, { file: captures/L78-about-titre-apres.png, alt: "Après : même écran, même réglage ; « Claude » tient entier sur sa ligne, le titre se lit « Vibe coded avec Claude Code & Codex »" }]
---
Si tu agrandis beaucoup le texte sur un petit écran, tous les titres du site se coupent maintenant comme ceux des fiches : un mot passe entier à la ligne, et ne se coupe entre deux syllabes, avec un trait, que s'il est plus large que la ligne. C'est vrai aussi des titres des Nouveautés, du Plan de travail et des encadrés de À propos, et même si une partie de l'habillage de la page ne se charge pas : la page Films cassait alors ses titres sans trait (« Avata / r »).

Sur À propos, l'adresse du livre Refactoring UI passe à la ligne entre ses deux mots, au lieu de se casser au milieu de l'un d'eux. Au réglage normal, rien ne change.

Avec la taille de la police réglée au double dans le navigateur, sur un écran de 320 pixels (barre de défilement comprise), plus aucun mot ne se casse sans trait : le titre d'À propos (« Claud / e »), celui de la fiche de Grace Augustine, les textes d'À propos et des Nouveautés, les liens du menu et les adresses de la page Langue na'vi. Les marges se resserrent un peu dans ce cas pour laisser la place aux mots.
