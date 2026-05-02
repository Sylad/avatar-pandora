# Eywa — Codex de Pandora

4ᵉ site du laboratoire perso. Codex visuel de l'univers Avatar (Pandora, clans Na'vi, faune, flore, langue, films), construit comme cadeau pour ma nièce Eva.

## Stack

- **Astro 6** — framework statique-first (paradigme islands)
- **React 19** — îlots interactifs (Plan 2)
- **Tailwind CSS 4** — styling utilitaire (vite plugin + `@theme` tokens)
- **R3F + GSAP** — WebGL + scrollytelling (Plan 2)
- **NestJS** minimal — proxy d'images wiki (Plan 2)
- **Docker + nginx** — déploiement NAS Synology

## Développement

```bash
cd frontend
nvm use 22
npm install
npm run dev -- --host 0.0.0.0 --port 4299
```

## Build / Déploiement

Modifier les sources localement, sync sur le NAS, puis build via Container Manager :

```bash
# Sync sources to NAS
rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .astro --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/

# Build & run on NAS
ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build"
```

URL : http://nas:4203

## Crédits

Vibe coded avec Claude Code (Anthropic). Visuels & UX co-conçus avec ChatGPT.
