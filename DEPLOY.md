# Déploiement public — Cloudflare Pages

Ce site est conçu pour deux cibles de déploiement :

1. **NAS Synology** (interne, `http://nas:4203`) — frontend statique servi par nginx en Docker. Voir `README.md`.
2. **Cloudflare Pages** (public, monde entier) — frontend statique. **C'est cette page qui couvre la 2ᵉ.**

---

## Pré-requis

- Compte Cloudflare gratuit : https://dash.cloudflare.com/sign-up
- Le repo `Sylad/avatar-pandora` sur GitHub (déjà en place)

## Setup en 5 étapes

### 1. Connecter le repo à Cloudflare Pages

1. Aller sur https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Autoriser l'app GitHub Cloudflare sur `Sylad/avatar-pandora` (privé OK).
3. Sélectionner le repo, branche `main`.

### 2. Build configuration

Renseigner :

| Champ | Valeur |
|---|---|
| Project name | `avatar-pandora` (ou `eywa`) |
| Production branch | `main` |
| Build command | `cd frontend && npm install && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | (laisser vide — racine du repo) |
| Node version (env var `NODE_VERSION`) | `22` |

### 3. Premier déploiement

Cliquer **Save and Deploy**. Cloudflare clone le repo, build, et déploie automatiquement.

URL du projet Pages : `https://avatar-pandora-12q.pages.dev` (`avatar-pandora.pages.dev` et `eywa.pages.dev` appartiennent à d'autres sites).

Chaque `git push origin main` déclenche un rebuild automatique en ~2 min.

### 4. Pas de fonction serveur

Depuis le 01-10-2026, le site n'a plus de proxy d'images : Avatar Fandom répond par un défi anti-robot, que Sylvain a choisi de ne pas contourner. Les fiches sans image hébergée affichent un visuel par défaut (`CoverFallback`), les illustrations hébergées sur le site viendront ensuite. Le site est 100 % statique : rien à vérifier côté Functions.

### 5. Custom domain (optionnel — ~10€/an)

1. Acheter un domaine (ex : Cloudflare Registrar, OVH, Gandi).
2. Dashboard Cloudflare Pages → **Custom domains** → **Set up a custom domain** → entrer `eywa.tondomaine.fr` ou racine.
3. Cloudflare configure DNS et HTTPS automatiquement (~5 min de propagation).

Idées de domaine : `eywa.fr`, `pandora-pour-eva.fr`, `eywa-codex.fr`.

---

## Architecture — pourquoi Cloudflare Pages

Le site Astro est **100 % statique** après build (SSG). Toutes les pages (landing cinematic, codex, entries) sont des fichiers HTML/JS pré-générés. Ça veut dire :

- **Aucun runtime serveur** côté Pages (les Functions sont serverless V8 isolates, démarrent en 5 ms).
- **CDN mondial gratuit** — les utilisateurs en France ↔ NY ↔ Tokyo ont la même latence ~30 ms.
- **HTTPS automatique** sans config Caddy / Let's Encrypt.
- **Zéro maintenance** — pas de container à redémarrer, pas de NAS qui tombe.

Le seul code "dynamique" était le proxy d'images `/api/wiki-image` (backend NestJS + Cloudflare Function) ; il a été retiré le 01-10-2026 (Fandom répond par un défi anti-robot), et le backend NestJS, qui ne servait plus que `/api/health`, a été supprimé dans la foulée.

## Coexistence avec le NAS

Garder les deux déploiements n'a aucun coût :

| Cible | URL | Public ? | Quand l'utiliser |
|---|---|---|---|
| NAS Synology | `http://nas:4203` | LAN seulement | Dev local, démo à la maison |
| Cloudflare Pages | `https://avatar-pandora-12q.pages.dev` | Internet | Lien à envoyer à Eva, à montrer en société |

Le frontend est statique sur les deux cibles ; il n'y a plus de backend (NAS compris).

### Retirer l'ancienne image `eywa-backend` du NAS (à faire une fois)

Depuis le 01-10-2026, `docker-compose.yml` ne déclare plus que `eywa-frontend`, et `frontend/nginx.conf` n'a plus de `location /api/`. Constat du 01-10-2026 : **aucun conteneur `avatar-pandora` ne tourne sur le NAS** (la copie NAS est éteinte) ; il ne reste que deux images de mai, dont `avatar-pandora-eywa-backend:latest` (181 Mo).

⚠ En ssh non interactif, `docker` n'est pas dans le PATH du NAS : utiliser `/usr/local/bin/docker`.

```bash
# Ménage : supprimer l'image du backend
ssh nas "/usr/local/bin/docker image rm avatar-pandora-eywa-backend:latest"

# Seulement si l'on veut RALLUMER la copie NAS (facultatif) : synchroniser les sources
# (--delete retire backend/, api/, frontend/functions/ obsolètes ; aucune donnée sur le NAS)
rsync --rsync-path=/usr/bin/rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .astro --exclude .git \
  ./ \
  nas:/volume2/docker/developpeur/avatar-pandora/
ssh nas "cd /volume2/docker/developpeur/avatar-pandora && /usr/local/bin/docker compose up -d --build --force-recreate --remove-orphans"
curl -s -o /dev/null -w '%{http_code}\n' http://nas:4203/            # attendu 200
curl -s -o /dev/null -w '%{http_code}\n' http://nas:4203/api/health  # attendu 404
```

## Coûts

| Composant | Coût |
|---|---|
| Cloudflare Pages (hosting + CDN) | **0 €/mois** |
| Build Cloudflare (500 builds/mois inclus) | **0 €/mois** |
| Domaine custom (optionnel) | ~10 €/an si Cloudflare Registrar |
| **Total** | **0 € sans domaine, ~10 €/an avec** |

Cloudflare Pages a un free tier généreux qui suffit pour un site personnel à trafic faible/moyen — Eywa peut tourner indéfiniment sans rien payer.

## Limites à connaître

- **Cache** : les pages HTML ont un cache court (5 min) ; polices et images statiques un cache d'un mois (voir `frontend/public/_headers`).

## Si jamais tu veux passer le repo en public

```bash
gh repo edit Sylad/avatar-pandora --visibility public --accept-visibility-change-consequences
```

Avant de faire ça, voir la section "Public-readiness audit" — au minimum, ajouter un `LICENSE` (MIT) et un disclaimer Avatar IP dans le README.

Le repo peut rester **privé** pour le déploiement Cloudflare Pages : Pages clone via l'app GitHub autorisée, ça marche pour les repos privés.
