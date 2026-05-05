# Comment c'est codé — qui fait quoi

> Si tu débarques sur ce repo et que tu te demandes ce que Claude a vraiment fait dans ce site, voici la réponse honnête.

## Trois acteurs

| Acteur | Rôle |
|---|---|
| **Sylvain** (humain) | Direction artistique, choix du sujet (cadeau pour ma nièce Eva), curation des sources Pandora, validation visuelle, écriture de la dédicace |
| **[Claude Code](https://claude.com/claude-code)** (Anthropic) | Implémentation Astro + R3F + GSAP, rédaction des fiches du codex en français, shaders WebGL, composants bioluminescents |
| **[ChatGPT](https://chat.openai.com)** (OpenAI) | Mockups UX initiaux, propositions de palette bioluminescente, pré-visualisation du logo Eywa |

## Le projet en deux phrases

C'est un cadeau à **Eva**, ma nièce de 18 ans, fan absolue de l'œuvre de James Cameron. Le site est aussi un **labo perso** où j'explore des stacks qui ne croisent pas mon métier de dev Java côté serveur : Astro (paradigme islands), React Three Fiber (WebGL), GSAP (animation), Tailwind 4.

Le clin d'œil discret : le `V` caché du `W` du logo **Eywa** recompose le prénom **Eva**. Tu ne le vois qu'une fois qu'on te le montre, comme l'inverse du logo FedEx.

## Répartition des tâches

| Tâche | Acteur principal | Détails |
|---|---|---|
| Choix du sujet, dédicace, ton | Humain | « Codex visuel d'Avatar pour ma nièce, immersif, sans bourrage de marketing Disney » |
| Code Astro (frontend statique + îlots React) | Claude Code | Pages dynamiques par collection, layouts, sidebar 320 px sticky, light/dark theming via tokens `@theme` Tailwind 4 |
| Code R3F (WebGL particle field) | Claude Code | Shader GLSL custom pour les particules bioluminescentes, sync sur le clock cinema, palette qui change par scène |
| Code GSAP (animation) | Claude Code | Cinema canvas mode='time' (boucle 75 s sans scroll), CycleBackdrop image cross-fade, scintillement bioluminescent au survol |
| Backend NestJS (proxy wiki-image) | Claude Code | Stratégie 4 niveaux : Avatar Fandom direct → Fandom search → Wikipedia EN → Wikipedia FR. Tests vitest 8/8 |
| Cloudflare Pages Function | Claude Code | Port du proxy NestJS en Worker serverless (TypeScript natif Cloudflare) pour le déploiement public |
| Contenu codex (~70 entrées MD) | Humain + Claude Code | Humain choisit les sujets et curate les sources ; Claude rédige les fiches en français à partir de Pandorapedia + Avatar Fandom + Frommer |
| Mockups UX premières versions | ChatGPT | Hero landing, palette bioluminescente, ambiance Pandora |
| Validation visuelle | Humain | « la sidebar respire trop fort », « les particules sont trop rares dans la scène volcan », « le hero du Bestiaire écrase le contenu » |

## Claude à runtime — où l'API Anthropic est appelée

**Nulle part.** Ce site n'appelle pas l'API Claude pendant son fonctionnement.

- Le frontend est **statique** (Astro génère du HTML pré-rendu, les îlots R3F/GSAP s'hydratent côté client). Une fois déployé sur Cloudflare Pages, le contenu est servi depuis le CDN, sans backend AI.
- Le seul endpoint serveur est `/api/wiki-image?q=...` qui proxie les images depuis Avatar Fandom et Wikipedia. **Aucun appel Claude.**
- Les ~70 fiches du codex sont des fichiers Markdown **figés** dans `frontend/src/content/` ; Claude les a écrits **à build-time**, pas en live.

**Coût d'usage runtime : 0 €.** Tu peux faire tourner ce site sans clé Anthropic, sans clé OpenAI, sans aucune dépendance LLM. Cloudflare Pages free tier le sert gratuitement à n'importe qui dans le monde.

## Claude à build-time — pair-programming sur le code et le contenu

C'est ici que Claude a contribué massivement.

### Sur le code

Workflow type pour chaque feature :

1. Je décris en français ce que je veux : *« landing à viewport unique, pas de scroll forcé. 6 images Pandora qui se cross-fadent en 75 s. Particules WebGL synchronisées sur la même boucle, palette qui change par scène. »*
2. Claude pose le squelette : composant Astro, îlot R3F, shader GLSL, hook React pour la timeline
3. Je valide visuellement (`npm run dev -- --host 0.0.0.0 --port 4299`), je redirige sur ce qui ne va pas (« le crossfade est trop sec, fais-le sigmoïde », « les particules de la scène volcan doivent être orange-rouge pas cyan »)
4. Claude itère par diff précis sur les fichiers concernés
5. Quand c'est bon, on commit (avec trailer `Co-Authored-By: Claude` pour la traçabilité)

Le résultat : ~99% des commits du repo ont ce trailer. Ce repo est probablement le plus consciencieusement co-signé des 4 que je maintiens.

### Sur les fiches du codex

Pour chaque entrée (créature, clan, personnage, lieu) :

1. Je sélectionne le sujet à partir d'**Avatar Fandom** ou **Pandorapedia**
2. Je copie-colle des extraits sourcés à Claude
3. Claude rédige une fiche **en français personnel et lyrique**, pas une traduction littérale du wiki anglais
4. Je relis et corrige les imprécisions (Eva, fan absolue, repère vite quand un détail visuel ne colle pas avec les films)
5. La fiche est commitée

Exemples concrets dans le commit `a15561e7` (8 entrées Engins RDA) ou `69949cc8` (6 créatures + 3 clans + 3 lieux).

## Sources canoniques

Tout le lore vient de sources fiables, jamais inventé :

- **[Pandorapedia](https://www.pandorapedia.com/)** — encyclopédie officielle Disney/20th Century pour le canon
- **[Avatar Fandom](https://james-camerons-avatar.fandom.com/)** — wiki communautaire dense (créatures, clans, personnages, objets)
- **[Naviteri.org](https://naviteri.org/)** — blog du Dr Paul Frommer, créateur de la langue Na'vi
- **Les films eux-mêmes** : Avatar (2009), La Voie de l'Eau (2022), Fire and Ash (2025)

Aucune image n'est rehosted par ce repo — le proxy `/api/wiki-image` les sert depuis Fandom/Wikipedia, juste pour ajouter le bon User-Agent et le cache CDN.

## Pourquoi cette transparence

Trois objectifs imbriqués :

1. **Faire un beau cadeau à Eva** — usage premier, le seul qui compte pour moi vraiment
2. **Apprendre Astro + R3F + GSAP** — ce sont 3 technos que je n'avais jamais touchées avant ce projet ; le site est mon terrain d'exploration WebGL
3. **Démontrer ce que la collab humain + Claude Code permet de bâtir en quelques semaines** — usage public secondaire, raison pour laquelle ce repo est public

Cacher la part de Claude irait contre le 3e objectif. Je préfère afficher clairement où l'IA a contribué pour que les visiteurs puissent évaluer eux-mêmes : « est-ce que je peux apprendre une nouvelle stack et bâtir un truc visuellement riche en collaborant avec Claude Code, et combien de temps ça me prendrait ? »

Réponse : oui, et probablement moins que tu ne crois. Le résultat dépendra de :
- **La précision avec laquelle tu décris ce que tu veux** (« landing à viewport unique » suffit ; « beau site fluide » ne suffit pas)
- **Ta capacité à reconnaître ce qui ne va pas** (Eva a des yeux affûtés, c'est mon premier test visuel)
- **Le sujet que tu choisis** (un sujet qui t'enflamme te donne l'énergie d'itérer 10 fois sur le même hero)

Claude écrit le code, choisit la formulation lyrique des fiches, propose des palettes ; toi, tu décides ce qui mérite d'exister sur Pandora.

## Et si tu veux faire pareil

Prends un sujet qui t'enflamme, ouvre [Claude Code](https://claude.com/claude-code), décris en langage naturel ce que tu rêves de voir exister, puis itère. Tu seras surpris de ce qu'on peut bâtir en quelques sessions.

*« Je te vois, Eva. » — Pandora est ton terrain de jeu désormais.*
