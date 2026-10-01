# Eywa (Avatar Pandora) — guide Claude Code

Codex Avatar/Pandora **cadeau pour Eva** (nièce de Sylvain, 18 ans, fan absolue d'Avatar). Le nom du site est **Eywa** (déesse-réseau de Pandora) — clin d'œil à Eva (E_W_A vs E_V_A, une lettre d'écart). Astro statique pur, déployé sur **Cloudflare Pages**.

## Architecture

| | |
|---|---|
| Stack | Astro 5/6 + îlots React 19 + @react-three/fiber + GSAP + Tailwind |
| Contenu | Markdown/MDX via Astro Content Collections |
| Backend | Aucun — le backend NestJS (qui ne servait plus que `/api/health` après le retrait du proxy images Fandom) est supprimé depuis le 01-10-2026 |
| Cible publique | Cloudflare Pages (`https://avatar-pandora-12q.pages.dev`) — 100 % statique, plus de Function |
| Frontend NAS | port 4203 (env de validation locale, conservée) — conteneur nginx seul, plus de proxy `/api/` |

## Public + ton

- **Destinataire principal** : Eva. Dédicace en page À propos. **Toujours dire "Eva"**, jamais "ma sœur" / "une amie" / etc.
- **Ton** : sobre + 1 vanne en ouverture, lyrique mais pas pompeux, tutoiement direct.
- Voir `feedback_about_tone.md` et `feedback_cta_encouragement_tone.md` (mémoires user-level).

## Règle d'identité visuelle CENTRALE : atmosphère temps-driven, PAS scroll-driven

**Validée 2026-05-03 après pivot.** Sur la landing :

- ✅ **Boucle temporelle 75s** sur viewport unique. L'ambiance bouge autour du visiteur sans qu'il fasse rien.
- ✅ Cross-fade d'images Pandora (6 atmosphères : forêt, Hometree, montagnes flottantes, océan Metkayina, volcan Fire & Ash, reveal).
- ✅ `ParticleField` WebGL synchronisé sur la même clock 75s.
- ✅ Logo + tagline + CTAs centrés au-dessus, lisibles via dark vignette + text-shadow.
- ❌ **Pas de scrollytelling 700vh forcé** sur la `/` racine. La V1 l'avait, user a détesté ("je devais scroller pour voir le contenu actionnable").
- ✅ L'option scroll reste valide pour des **pages dédiées immersion** (ex `/cinema` en bonus). Mais jamais sur `/`.

Pattern technique réutilisable : `CinemaCanvas` mode `'time'` + `CycleBackdrop` qui cross-fade les images sur le même clock. Voir `frontend/src/components/cinema/`.

## Pas de ChatGPT — silence complet

**Important** : Eywa n'utilise **PAS** ChatGPT. Logo SVG codé custom, visuels = proxy wiki + concept art linké.

❌ Ne pas mentionner ChatGPT dans la page About / README / commits — **même pour le nier**. Confirmé 2026-05-03 + reconfirmé 2026-05-06 : *"je ne l'ai pas utilisé, pas besoin d'en parler"*. Crédits = humain + Claude Code uniquement.

## Sources de contenu

1. **Pandorapedia** (officiel Disney/Cameron) — référence canon.
2. **Avatar Wiki Fandom** (https://avatar.fandom.com) — exhaustif, source de TEXTE. Plus aucune image n'en vient : le proxy `/api/wiki-image` est retiré (01-10-2026, défi anti-robot que Sylvain refuse de contourner ; pas de captures des films non plus). Fiche sans image hébergée → visuel par défaut `CoverFallback` (`src/lib/cover.ts`).
3. **Paul Frommer** — linguiste Na'vi, source pour la page Langue Na'vi.
4. **Synthèse Claude en français** pour les ~70 entrées lyriques du codex.

## Fair-use / publication publique

- ✅ Aucune image tierce affichée (proxy wiki retiré le 01-10-2026) ; illustrations propres hébergées sur le site à venir.
- ❌ Pas de re-host de stills films (Disney/Cameron).
- ✅ Repo public-ready (LICENSE MIT/CC). Auto-deploy Cloudflare Pages sur `git push origin main`.

## Codex (7 sections)

`Pandora` (8 entrées) · `Clans Na'vi` (7) · `Bestiaire` (14) · `Flore` (5) · `Personnages` (24) · `Films` (3) · `Engins` (8) · `Langue Na'vi` (standalone). ~70 entrées, 78 pages buildées.

Sidebar 320px sticky pattern warhammer (lore court, liens rapides, ressources externes).

## Workflow dev

NAS = env de validation locale (rsync sources puis `docker compose up --build --force-recreate` sur le NAS). Cloudflare Pages = cible publique auto-deploy ~2 min après `git push`.

```bash
# NAS local
ssh nas "cd /volume2/docker/developpeur/avatar-pandora && docker compose up -d --build --force-recreate eywa-frontend"
```

## Pas de deadline

Qualité avant tout. Spec validée : `docs/superpowers/specs/2026-05-02-avatar-pandora-design.md`.

## Plan, sessions et revue UX (cadence)

Le reste à faire vit dans `docs/plan/raf.yaml`, tenu par `raf`
([cadence](https://github.com/Sylad/cadence)) : chaque commit cite son lot dans le
message (`fix(L4): …`, `L2/t1`), `raf now` dit la suite, `raf check` repère les
écarts. Début et fin de session : skills `/cadence:session-start` et
`/cadence:session-close`.

**Revue UX obligatoire** (règle de Sylvain du 2026-09-28, tous les projets perso) : toute nouvelle
page ou modification d'écran est un lot `--visible`, revu par l'agent `cadence:ux-reviewer` (captures
1440 et 390 px, écarts fondés sur une règle nommée ou une mesure) avant `raf done`. Le verdict
s'enregistre avec `raf ux <lot> "…"`, sinon `raf done` refuse. Les lots « Revue UX — … » planifient
la revue de chaque écran existant ; les écarts trouvés deviennent des sous-tâches du lot.
