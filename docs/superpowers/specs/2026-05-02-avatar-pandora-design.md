# Eywa — Design Document

**Date** : 2026-05-02
**Auteur** : Sylvain Ladoire (avec Claude Code)
**Statut** : Validé — prêt pour planning d'implémentation
**Nom du site** : **Eywa** — la déesse-réseau de Pandora (la conscience planétaire, l'All-Mother). Choix personnel : le prénom de la destinataire (**Eva**) est presque caché dans **Eywa** (E_W_A / E_V_A, une lettre d'écart). Une dédicace discrète figurera en page À propos ou en easter egg de la page d'accueil.

## Contexte & vision

Site cadeau personnel destiné à la nièce de l'auteur (Eva, 18 ans), fan absolue de l'univers Avatar (James Cameron). C'est aussi le 4ᵉ site du laboratoire technique personnel — chaque app sert à explorer un angle nouveau.

L'expérience se déroule en deux temps :

1. **Accueil cinématique** — page d'accueil scrollytelling : descente vers Pandora, bioluminescence qui s'allume scène par scène, ambiance immersive immédiate.
2. **Codex explorable** — objet visuel à revisiter dans le temps : clans Na'vi, faune, flore, personnages, langue, films.

Le site reste **personnel** dans un premier temps (déploiement NAS Synology comme les 3 autres apps), avec une **option de publication publique** si l'expérience plaît à la destinataire. Cette inflexion impacte deux décisions tech (voir Stack et Contraintes).

## Objectifs

- Livrer un site **visuel-first** où le WebGL/animation est le levier émotionnel principal (et pas l'accessoire).
- Constituer un **codex Pandora** sourcé proprement (Pandorapedia + Avatar Wiki Fandom + synthèse Claude en français), pas une coquille vide.
- **Apprendre 3 technos nouvelles** (Astro, R3F/Three.js, GSAP) tout en gardant React comme filet de sécurité.
- Garder l'option de **publication publique** ouverte sans refacto majeur.

## Non-objectifs

- Pas d'authentification / comptes utilisateurs.
- Pas de favoris persistants ou de personnalisation utilisateur (c'est un objet à explorer, pas à customiser).
- Pas d'admin / CMS (contenu en Markdown dans le repo, géré par l'auteur).
- Pas de version mobile native (web responsive uniquement).
- Pas de re-hébergement de stills/screenshots films Disney/Cameron (proxy/lien vers sources externes uniquement, pour respecter le fair use).

## Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Astro 5** | Paradigme islands, statique-first, performance native, déploiement CDN trivial |
| Îlots interactifs | **React 19** | Stack connue de l'auteur (filet de sécurité) |
| 3D / WebGL | **@react-three/fiber** + **@react-three/drei** | API React-friendly pour Three.js |
| Animations | **GSAP** + **ScrollTrigger** | Lib animation pro de référence pour scrollytelling |
| Style | **Tailwind CSS** | Pas de shadcn (design trop custom, composants génériques contre-productifs) |
| Contenu | **Markdown/MDX** via Astro Content Collections | Versioning git, pas de CMS |
| Backend | **NestJS minimal** sur port 3003 | Uniquement pour proxy d'images wiki (pattern warhammer) — supprimable si full static suffit |
| Déploiement | **Docker** sur NAS Synology | Pattern identique aux 3 apps existantes |

**Lab payoff** : Astro (paradigme islands inédit), R3F (entrée WebGL), GSAP (animation pro). Trois domaines vraiment nouveaux.

**Option publication** : Astro statique → déploiement Vercel/Netlify trivial le jour J, sans refacto. Le backend NestJS n'est nécessaire que pour proxy d'images ; il peut être remplacé par une fonction serverless ou supprimé si on accepte des images hébergées tierces.

## Architecture des sections

### Page d'accueil — scrollytelling cinématique

Structure narrative inspirée du New York Times "Snow Fall" mais en Pandora.

1. Écran noir → citation introductive d'Avatar qui s'écrit (ex: « *I see you* »).
2. Scroll → descente 3D sur Pandora, particules pollen, bioluminescence qui s'allume progressivement.
3. 5 scènes clés s'enchaînent au scroll :
   - Forêt d'Eywa (canopée bioluminescente)
   - Hometree (arbre-mère Omatikaya)
   - Montagnes flottantes Hallelujah
   - Océan des Metkayina
   - Volcan de Fire & Ash (3ᵉ film)
4. Fin de scroll → entrée dans le codex (sidebar 320px sticky apparaît).

### Codex (sections explorables)

Architecture identique au pattern warhammer : sidebar sticky 320px à gauche, contenu principal scrollable, transitions douces. 7 sections principales :

1. **Pandora** — la lune, géographie, biomes, phénomènes (Tree of Souls, atmosphère, gravité).
2. **Clans Na'vi** — Omatikaya, Metkayina, Ash People, Tipani, Anurai, Tawkami…
3. **Bestiaire** — créatures emblématiques : ikran (banshees), toruk (Great Leonopteryx), thanator, palulukan, tulkun, na'vi creatures aquatiques (3ᵉ film).
4. **Flore** — Hometree, Arbre des âmes, plantes spirituelles, forêts bioluminescentes.
5. **Personnages** — Jake Sully, Neytiri, Quaritch (humain + Na'vi recombinant), enfants Sully (Neteyam, Lo'ak, Kiri, Tuk), Spider, Mo'at, alliés/antagonistes notables.
6. **Langue Na'vi** — alphabet, prononciation, expressions courantes, salutations cérémonielles. Source : travaux du Dr Paul Frommer.
7. **Les films** — 3 films (2009, 2022, 2025), synopsis, scènes mémorables, contexte production.

### Page À propos

Pattern identique aux 3 autres sites de l'auteur :

- "Vibe coded with Claude Code" — philosophie labo perso, exploration tech.
- Mention de la collaboration ChatGPT (visuels, dossier UX, mockups).
- Stack technique listée (sources : `package.json`, infra Docker).
- **Dédicace à Eva** : explication du nom (Eva ↔ Eywa), motivation du cadeau, ton chaleureux mais sans surenchère.
- CTA "encouragement à l'action" : *« Si tu veux faire pareil — prends un sujet qui t'enflamme, ouvre Claude Code, décris en langage naturel… »*.

## Identité visuelle

### Palette bioluminescente Pandora

| Rôle | Couleur | Hex |
|---|---|---|
| Fond profond | deep navy-violet | `#0a0a1f` |
| Bio primaire | cyan-turquoise | `#5fffe6` |
| Bio secondaire | magenta-rose | `#ff5dc4` |
| Accent Eywa | vert luminescent | `#7fff8f` |
| Accent Fire & Ash | ambre/orange | `#ff8c2a` |
| Texte | crème pâle | `#e8e6dd` |

L'accent ambre/orange est réservé à la section "Fire & Ash" (3ᵉ film) pour créer un contraste narratif fort avec la palette bio froide dominante.

### Typographie

- **Display** : police "alien-ish" élégante — à arbitrer parmi : Audiowide, Orbitron, Exo 2, ou import custom Na'vi-inspired.
- **Body** : serif lisible — Cormorant Garamond ou Lora.

### Logo — révélation EVA dans EYWA

Le logo est typographique : le mot **EYWA** est écrit, et **trois lettres sont mises en lumière** (couleur bioluminescente primaire, glow accentué) pour faire apparaître **EVA** en surimpression :

- **E** → éclat bio primaire
- **Y** → couleur secondaire atténuée
- **W** → divisé visuellement en deux moitiés ; la **moitié gauche** (= un **V** typographique) en éclat bio primaire, la moitié droite atténuée
- **A** → éclat bio primaire

L'œil lit d'abord **EYWA** comme un tout, puis le contraste fait remonter **EVA** comme une révélation. Élégant, typographique, sans surenchère.

Implémentation possible : SVG custom où chaque lettre est un path indépendant, le W est composé de deux paths "V" séparés. CSS/Tailwind contrôle l'opacité et le filtre `drop-shadow` (glow) par classe.

### Ambiance permanente

- Particules pollen flottantes en background (R3F, optimisé pour ne pas peser sur les perfs).
- Glow doux sur les éléments interactifs (boxshadow + filter).
- Transitions fade-in soft entre sections.
- Curseur custom subtil (optionnel, à valider en V1).

## Sources de contenu

| Source | Usage |
|---|---|
| Pandorapedia.com (officiel Disney/Cameron) | Base canonique pour lore et noms |
| Avatar Wiki (Fandom) | Détails créatures, persos, événements films |
| Travaux Dr Paul Frommer | Langue Na'vi (alphabet, grammaire, lexique) |
| Synthèse Claude | Réécriture en français fluide (pas de copier-coller wiki) |
| Wikipedia (proxy `/api/wiki-image`) | Images persos/scènes (pattern réutilisé de warhammer) |
| Concept art officiel (lien externe) | Visuels d'ambiance — liens uniquement, pas de re-host |

## Architecture déploiement

### Layout filesystem (NAS)

```
/volume2/docker/developpeur/avatar-pandora/
├── docker-compose.yml         ← projet "avatar-pandora"
├── frontend/                  ← Astro 5 + React + R3F
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
├── backend/                   ← NestJS minimal (proxy images)
│   ├── Dockerfile
│   └── src/
└── docs/
    └── superpowers/specs/
```

### Volumes persistants

- `/volume2/docker/developpeur/data/avatar-pandora/` — créé si backend a besoin de cache (ex: cache images proxy).
- `/volume2/docker/developpeur/data/shared/claude-shared.json` — partagé avec les autres apps (solde Claude).

### Ports

- **4203** — frontend (nginx)
- **3003** — backend (si conservé)

### Container Manager

Projet Container Manager nommé `avatar-pandora`. Création initiale via UI Synology (cf. règle d'or : projets en CLI non reconnus par l'UI).

## Contraintes & risques

### Droits d'usage

Le site pouvant à terme être publié, on évite tout re-hébergement de :

- Stills / screenshots des films (propriété Disney/Cameron).
- Bandes son ou extraits vidéo.

On utilise :

- Concept art officiel **par lien externe** uniquement.
- Images wiki (libres ou fair-use) via proxy backend.
- Texte original en français (synthèse, pas copie).

### Performance WebGL

- R3F peut être coûteux mobile ; particules en background à throttler ou désactiver sur viewport mobile.
- Lazy-load des composants 3D : seules les scènes visibles sont actives.
- Fallback CSS-only pour utilisateurs sans WebGL ou avec `prefers-reduced-motion`.

### Collision avec sessions parallèles

Le projet vit dans `/volume2/docker/developpeur/avatar-pandora/`, dossier neuf. Aucun fichier en commun avec finance-tracker-v2, warhammer40k, ol-companion. Ports 4203/3003 libres. Volumes data séparés. **Risque de collision = nul** tant que les modifications restent dans ce périmètre.

## Ouvertures (post-V1, hors scope initial)

- Carte interactive 3D de Pandora cliquable (sky islands, biomes).
- Section "Quel clan Na'vi es-tu ?" (quiz).
- Lecteur audio Na'vi pour la prononciation.
- Mode "ambient" plein écran (fond Pandora animé sans contenu).
- Migration Vercel/Netlify si publication décidée.

## Décisions encore ouvertes (à arbitrer en début d'implémentation)

- **Police display** : Audiowide / Orbitron / Exo 2 / autre. À tester sur mockup réel.
- **Curseur custom** : à valider une fois la V1 de l'ambiance posée.
- **Forme de la dédicace "pour Eva"** : easter egg à l'accueil (révélation au scroll), mention en page À propos, ou les deux.
