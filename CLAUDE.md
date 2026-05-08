# Eywa (Avatar Pandora) — guide Claude Code

Codex Avatar/Pandora **cadeau pour Eva** (nièce de Sylvain, 18 ans, fan absolue d'Avatar). Le nom du site est **Eywa** (déesse-réseau de Pandora) — clin d'œil à Eva (E_W_A vs E_V_A, une lettre d'écart). Astro statique pur, déployé sur **Cloudflare Pages**.

## Architecture

| | |
|---|---|
| Stack | Astro 5/6 + îlots React 19 + @react-three/fiber + GSAP + Tailwind |
| Contenu | Markdown/MDX via Astro Content Collections |
| Backend | NestJS minimal (port 3003, pattern warhammer) — proxy images wiki **uniquement pour le NAS local** |
| Cible publique | Cloudflare Pages (`https://eywa-eywa.pages.dev`) — backend porté en Cloudflare Function `frontend/functions/api/wiki-image.ts` |
| Frontend NAS | port 4203 (env de validation locale, conservée) |

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
2. **Avatar Wiki Fandom** (https://avatar.fandom.com) — exhaustif, scrapable via notre `/api/wiki-image` proxy (Fandom→Wiki fallback).
3. **Paul Frommer** — linguiste Na'vi, source pour la page Langue Na'vi.
4. **Synthèse Claude en français** pour les ~70 entrées lyriques du codex.

## Fair-use / publication publique

- ✅ Proxy wiki + concept art **linké** (pas re-hosté).
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
