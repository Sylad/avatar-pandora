# Déploiement public — Cloudflare Pages

Ce site est conçu pour deux cibles de déploiement :

1. **NAS Synology** (interne, `http://nas:4203`) — frontend + backend NestJS Docker. Voir `README.md`.
2. **Cloudflare Pages** (public, monde entier) — frontend statique + Cloudflare Function pour `/api/wiki-image`. **C'est cette page qui couvre la 2ᵉ.**

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

URL gratuite générée : `https://avatar-pandora.pages.dev` (ou `https://<projectname>.pages.dev`).

Chaque `git push origin main` déclenche un rebuild automatique en ~2 min.

### 4. Vérifier que les fonctions tournent

Le fichier `frontend/functions/api/wiki-image.ts` est automatiquement détecté et déployé comme Cloudflare Function. Tester :

```bash
curl -sI https://avatar-pandora.pages.dev/api/wiki-image?q=Mountain%20Banshee
# attendu : HTTP/2 200 + content-type: image/...
```

Si 404 : vérifier que le dossier `frontend/functions/` est bien commité.

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

Le seul code "dynamique" était `/api/wiki-image` côté backend NestJS. Il est porté en `frontend/functions/api/wiki-image.ts` — même algorithme (Fandom direct → Fandom search → Wikipedia EN/FR), réécrit en `fetch` natif (pas d'axios). 75 lignes au total.

## Coexistence avec le NAS

Garder les deux déploiements n'a aucun coût :

| Cible | URL | Public ? | Quand l'utiliser |
|---|---|---|---|
| NAS Synology | `http://nas:4203` | LAN seulement | Dev local, démo à la maison |
| Cloudflare Pages | `https://avatar-pandora.pages.dev` | Internet | Lien à envoyer à Eva, à montrer en société |

Le frontend appelle `/api/wiki-image` sur la même origine, donc les 2 déploiements marchent indépendamment :

- Sur NAS : le call hit nginx → backend NestJS Docker.
- Sur Cloudflare Pages : le call hit la Cloudflare Function.

Pas de configuration à changer dans le frontend selon la cible.

## Coûts

| Composant | Coût |
|---|---|
| Cloudflare Pages (hosting + CDN + 100k req/jour Functions) | **0 €/mois** |
| Build Cloudflare (500 builds/mois inclus) | **0 €/mois** |
| Domaine custom (optionnel) | ~10 €/an si Cloudflare Registrar |
| **Total** | **0 € sans domaine, ~10 €/an avec** |

Cloudflare Pages a un free tier généreux qui suffit pour un site personnel à trafic faible/moyen — Eywa peut tourner indéfiniment sans rien payer.

## Limites à connaître

- **Functions free tier** : 100 000 invocations/jour. Le proxy `/api/wiki-image` est appelé une fois par image affichée, mais le `Cache-Control: 30 days` que la Function envoie fait que les images sont mises en cache côté client + edge Cloudflare. En pratique : 50-100 invocations par jour pour un trafic familial.
- **Cloudflare cache 30 jours** : si tu changes le `cover:` d'une entry et redéploies, l'ancienne image peut rester en cache jusqu'à 30 jours côté CDN. Solution : passer un query string différent, ou purge manuelle dans le dashboard Cloudflare.

## Si jamais tu veux passer le repo en public

```bash
gh repo edit Sylad/avatar-pandora --visibility public --accept-visibility-change-consequences
```

Avant de faire ça, voir la section "Public-readiness audit" — au minimum, ajouter un `LICENSE` (MIT) et un disclaimer Avatar IP dans le README.

Le repo peut rester **privé** pour le déploiement Cloudflare Pages : Pages clone via l'app GitHub autorisée, ça marche pour les repos privés.
