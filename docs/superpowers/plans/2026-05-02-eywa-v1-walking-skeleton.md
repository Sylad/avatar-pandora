# Eywa V1 — Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a deployable Astro site with the Eywa identity (palette, typo, logo with EVA reveal embedded in EYWA), the codex layout (sidebar 320px sticky + 7 section stubs), a working landing page, and an About page with the Eva dedication. Site runs in Docker on the NAS at http://nas:4203.

**Architecture:** Astro 5 static site. React 19 islands available for any interactive bits but not used yet in V1. Tailwind 4 for styling with custom theme tokens for the bioluminescent Pandora palette. Astro Content Collections for codex content (markdown + frontmatter schema validated by Zod). nginx alpine Dockerized for serving the built static site. No backend in V1 — deferred to Plan 2 when we wire the wiki-image proxy.

**Tech Stack:** Astro 5+, React 19, Tailwind CSS 4, TypeScript strict, Docker (multi-stage build node:22-alpine → nginx:alpine).

> **Plan amendments observed during execution:**
> - `npm create astro@latest` produced **Astro 6.2.1** (newer than the original "Astro 5" target — backward compatible for Content Collections / islands / layouts).
> - **Tailwind 4** with the `@tailwindcss/vite` plugin (no `tailwind.config.mjs` — config goes via `@theme` in `src/styles/global.css`).
> - **Node 22.x** required by Astro 6 (`engines.node >=22.12.0` in `package.json`). `.nvmrc` committed at repo root with `22`.
> - Therefore Docker builder image is **`node:22-alpine`** (not `node:20-alpine` as drafted).

**Repo paths:**
- Local source : `/home/sylvain_ladoire/projects/developpeur/avatar-pandora/`
- NAS deploy : `/volume2/docker/developpeur/avatar-pandora/` (Container Manager project named `avatar-pandora`)
- All file paths in this plan are **relative to the local source dir** unless prefixed `nas:`

---

## File structure (target after V1)

```
avatar-pandora/
├── docker-compose.yml
├── README.md
├── .gitignore
├── frontend/
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── content.config.ts
│       ├── content/
│       │   ├── pandora/intro.md
│       │   ├── clans/index.md          (stub)
│       │   ├── bestiaire/index.md      (stub)
│       │   ├── flore/index.md          (stub)
│       │   ├── personnages/index.md    (stub)
│       │   ├── langue/index.md         (stub)
│       │   └── films/index.md          (stub)
│       ├── components/
│       │   ├── EywaLogo.astro
│       │   └── Sidebar.astro
│       ├── layouts/
│       │   ├── BaseLayout.astro
│       │   └── CodexLayout.astro
│       ├── pages/
│       │   ├── index.astro             (landing)
│       │   ├── about.astro
│       │   ├── pandora/[...slug].astro
│       │   ├── clans/[...slug].astro
│       │   ├── bestiaire/[...slug].astro
│       │   ├── flore/[...slug].astro
│       │   ├── personnages/[...slug].astro
│       │   ├── langue/[...slug].astro
│       │   └── films/[...slug].astro
│       └── styles/
│           └── global.css
└── docs/
    └── superpowers/
        ├── specs/2026-05-02-avatar-pandora-design.md
        └── plans/2026-05-02-eywa-v1-walking-skeleton.md   ← this file
```

## Verification approach

Astro components and Tailwind CSS are not unit-test-friendly in a way that adds real signal. For V1, verification is:

- **Build succeeds**: `npm run build` exits 0, no Astro/TS errors.
- **Visual checks**: open the built page in a browser, eyeball against the spec.
- **Content schema validation**: Astro's Zod-backed Content Collections validate frontmatter at build time — if the build passes, the content schema is correct.

When Plan 2 introduces backend logic, we'll switch to proper TDD for that.

## Git author

All commits use the local override (per memory `synology_docker_socket.md` style — never modify global git config):

```bash
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "..."
```

---

### Task 1: Frontend scaffold

**Files:**
- Create: `frontend/` (entire directory via `npm create astro`)
- Create: `frontend/package.json`, `frontend/astro.config.mjs`, `frontend/tsconfig.json`

- [ ] **Step 1.1: Run Astro scaffolder**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
npm create astro@latest frontend -- --template minimal --typescript strict --no-install --no-git --skip-houston
```

Expected: Astro creates `frontend/` with minimal template, prints success message.

- [ ] **Step 1.2: Add React + Tailwind integrations**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npx astro add react tailwind --yes
```

Expected: `astro.config.mjs` updated with both integrations, `tailwind.config.mjs` created (Astro 5 may create `tailwind.config.mjs` or use the v4 vite plugin — accept whichever the integration picks). Run installs deps.

- [ ] **Step 1.3: Verify TypeScript strict + add MDX support**

Open `frontend/tsconfig.json` and confirm it extends `astro/tsconfigs/strict`. Then add MDX support for richer codex content later:

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npx astro add mdx --yes
```

Expected: `@astrojs/mdx` added to `astro.config.mjs`.

- [ ] **Step 1.4: Verify dev server starts**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run dev -- --host 0.0.0.0 --port 4299
```

Expected: server starts at http://localhost:4299, default Astro page renders. Stop with Ctrl+C.

- [ ] **Step 1.5: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): scaffold Astro 5 + React + Tailwind + MDX

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Theme tokens & global styles

**Files:**
- Modify: `frontend/tailwind.config.mjs` (or `frontend/src/styles/global.css` if Tailwind v4 vite plugin)
- Create: `frontend/src/styles/global.css`
- Modify: `frontend/astro.config.mjs` if needed

**Notes:** Tailwind 4 may use the new vite plugin pattern with `@theme` directive in CSS. If `tailwind.config.mjs` exists from Task 1, configure tokens there; if not, use `@theme` in `global.css`.

- [ ] **Step 2.1: Add Google Fonts to `<head>` via BaseLayout (anticipate)**

We'll create BaseLayout in Task 4. For now, just configure tokens.

- [ ] **Step 2.2: Define palette + fonts in tailwind.config.mjs**

Edit `frontend/tailwind.config.mjs`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eywa: {
          bg: '#0a0a1f',           // deep navy-violet
          'bio-primary': '#5fffe6', // cyan-turquoise
          'bio-secondary': '#ff5dc4', // magenta-rose
          'sacred-green': '#7fff8f',  // sacred green — Eywa divine network of Pandora
          'fire-ash': '#ff8c2a',    // amber/orange (3rd film)
          text: '#e8e6dd',          // pale cream
          'text-muted': '#9994a3',  // dimmed for secondary text
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Cormorant Garamond', 'serif'],
      },
      boxShadow: {
        'glow-bio': '0 0 20px rgba(95, 255, 230, 0.4)',
        'glow-bio-strong': '0 0 40px rgba(95, 255, 230, 0.6)',
      },
    },
  },
  plugins: [],
};
```

(If Tailwind v4 vite plugin is in use and there's no `tailwind.config.mjs`, put the equivalent under `@theme` in `global.css` — see Tailwind 4 docs.)

- [ ] **Step 2.3: Create global.css with body bg + font imports**

Create `frontend/src/styles/global.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Cormorant+Garamond:wght@300;400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    background: #0a0a1f;
    color: #e8e6dd;
    font-family: 'Cormorant Garamond', serif;
  }
  body {
    min-height: 100vh;
  }
  h1, h2, h3, h4 {
    font-family: 'Orbitron', sans-serif;
    letter-spacing: 0.05em;
  }
}
```

(For Tailwind v4: replace `@tailwind base/components/utilities` with `@import "tailwindcss";` and adapt `@theme` directives accordingly.)

- [ ] **Step 2.4: Verify build works**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: build succeeds, `dist/` folder created.

- [ ] **Step 2.5: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): theme tokens — bioluminescent Pandora palette + fonts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Eywa logo with EVA reveal

**Files:**
- Create: `frontend/src/components/EywaLogo.astro`

The logo writes EYWA with E, the left V of the W, and A in the bioluminescent primary color (with glow), while Y and the right V of the W are in muted secondary color. The eye recomposes EVA.

- [ ] **Step 3.1: Create the component**

Create `frontend/src/components/EywaLogo.astro`:

```astro
---
interface Props {
  size?: number;
  glowing?: boolean;
}
const { size = 120, glowing = true } = Astro.props;
const lit = '#5fffe6';
const muted = 'rgba(232, 230, 221, 0.35)';
const glow = glowing ? 'drop-shadow(0 0 6px rgba(95,255,230,0.7))' : 'none';
---
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 240 80"
  height={size * 0.33}
  width={size}
  aria-label="Eywa"
  role="img"
  style={`filter:${glow}; font-family:Orbitron, sans-serif`}
>
  <!-- E (lit) -->
  <text x="0" y="60" font-size="64" font-weight="700" fill={lit}>E</text>

  <!-- Y (muted) -->
  <text x="50" y="60" font-size="64" font-weight="700" fill={muted}>Y</text>

  <!--
    W decomposed into two Vs:
      Left V (lit, reads as the V of EVA)
      Right V (muted)
  -->
  <!-- Left V of W (lit) -->
  <polygon points="100,18 116,60 132,18 126,18 116,46 106,18" fill={lit} />
  <!-- Right V of W (muted) -->
  <polygon points="132,18 148,60 164,18 158,18 148,46 138,18" fill={muted} />

  <!-- A (lit) -->
  <text x="170" y="60" font-size="64" font-weight="700" fill={lit}>A</text>
</svg>
```

(Coordinates are an initial pass — fine-tune visually in Step 3.3.)

- [ ] **Step 3.2: Add a temporary preview page**

Edit `frontend/src/pages/index.astro` (replace existing minimal content):

```astro
---
import EywaLogo from '../components/EywaLogo.astro';
import '../styles/global.css';
---
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Eywa — preview logo</title>
  </head>
  <body class="bg-eywa-bg flex flex-col items-center justify-center min-h-screen">
    <EywaLogo size={400} />
    <p class="mt-8 text-eywa-text-muted text-sm tracking-wide uppercase">Logo preview</p>
  </body>
</html>
```

- [ ] **Step 3.3: Visual check & tune coordinates**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run dev -- --host 0.0.0.0 --port 4299
```

Open http://localhost:4299. The 4 letters EYWA are visible. The E, the **left half of W (V shape)**, and the A glow cyan-turquoise. The Y and the right half of W appear faint/muted.

If the W's two Vs don't align cleanly, tweak the polygon coordinates. The two Vs should touch at the apex (around x=132, y=18). Adjust until the W reads correctly as one letter at first glance, but the lit-V is unmistakably highlighted.

Stop dev server.

- [ ] **Step 3.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/EywaLogo.astro frontend/src/pages/index.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): Eywa logo with EVA reveal (E + left-V of W + A in bio cyan)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: BaseLayout

**Files:**
- Create: `frontend/src/layouts/BaseLayout.astro`

Single source of truth for `<head>`, fonts, global CSS, and the body wrapper.

- [ ] **Step 4.1: Create the layout**

Create `frontend/src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/global.css';
interface Props {
  title?: string;
  description?: string;
}
const { title = 'Eywa', description = 'Codex de Pandora' } = Astro.props;
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body class="bg-eywa-bg text-eywa-text min-h-screen">
    <slot />
  </body>
</html>
```

- [ ] **Step 4.2: Create a placeholder favicon**

Create `frontend/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0a0a1f"/>
  <text x="16" y="22" text-anchor="middle" font-family="Orbitron,sans-serif" font-size="16" font-weight="700" fill="#5fffe6">E</text>
</svg>
```

- [ ] **Step 4.3: Verify build still passes**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: success.

- [ ] **Step 4.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/layouts/BaseLayout.astro frontend/public/favicon.svg
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): BaseLayout + favicon

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Landing page V1

**Files:**
- Modify: `frontend/src/pages/index.astro`

V1 minimale : logo Eywa centré, tagline, CTA vers le codex. Le scrollytelling cinématique vient en Plan 2.

- [ ] **Step 5.1: Replace landing with the V1 layout**

Replace `frontend/src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EywaLogo from '../components/EywaLogo.astro';
---
<BaseLayout title="Eywa — Codex de Pandora">
  <main class="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20">
    <EywaLogo size={420} />

    <p class="mt-10 max-w-xl text-eywa-text-muted text-lg leading-relaxed font-body italic">
      « Je te vois. »<br/>
      Un codex visuel de Pandora — la lune, ses clans, sa faune, sa langue.
    </p>

    <div class="mt-12 flex gap-4">
      <a href="/pandora/intro"
         class="px-6 py-3 rounded border border-eywa-bio-primary text-eywa-bio-primary hover:shadow-glow-bio transition-shadow">
        Explorer le codex
      </a>
      <a href="/about"
         class="px-6 py-3 rounded text-eywa-text-muted hover:text-eywa-text transition-colors">
        À propos
      </a>
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 5.2: Visual check**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run dev -- --host 0.0.0.0 --port 4299
```

Open http://localhost:4299. Logo Eywa centré, tagline italique en français, deux CTA (explorer / à propos). CTA "Explorer" doit avoir une bordure cyan luminescente avec glow au hover. Stop dev server.

- [ ] **Step 5.3: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/index.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): landing V1 — logo + tagline + CTA codex/about

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Content Collections schemas

**Files:**
- Create: `frontend/src/content.config.ts`

7 collections, 1 par section du codex. Schéma Zod : `title` (string), `summary` (string), `order` (number, optionnel), `cover` (string url, optionnel).

- [ ] **Step 6.1: Create content.config.ts**

Create `frontend/src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const codexEntrySchema = z.object({
  title: z.string(),
  summary: z.string(),
  order: z.number().optional(),
  cover: z.string().url().optional(),
});

const makeCollection = (folder: string) =>
  defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${folder}` }),
    schema: codexEntrySchema,
  });

export const collections = {
  pandora: makeCollection('pandora'),
  clans: makeCollection('clans'),
  bestiaire: makeCollection('bestiaire'),
  flore: makeCollection('flore'),
  personnages: makeCollection('personnages'),
  langue: makeCollection('langue'),
  films: makeCollection('films'),
};
```

- [ ] **Step 6.2: Create directory structure**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
mkdir -p src/content/{pandora,clans,bestiaire,flore,personnages,langue,films}
```

- [ ] **Step 6.3: Verify build still passes (no content yet, schemas alone shouldn't error)**

```bash
npm run build
```

Expected: build succeeds. If Astro warns about empty collections, that's fine — content arrives in Task 7.

- [ ] **Step 6.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content.config.ts frontend/src/content/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): content collections schemas for 7 codex sections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Codex content stubs (1 full + 6 stubs)

**Files:**
- Create: `frontend/src/content/pandora/intro.md`
- Create: `frontend/src/content/clans/index.md`
- Create: `frontend/src/content/bestiaire/index.md`
- Create: `frontend/src/content/flore/index.md`
- Create: `frontend/src/content/personnages/index.md`
- Create: `frontend/src/content/langue/index.md`
- Create: `frontend/src/content/films/index.md`

- [ ] **Step 7.1: Create the Pandora intro (full content stub)**

Create `frontend/src/content/pandora/intro.md`:

```markdown
---
title: "Pandora — la lune jungle"
summary: "Lune habitable d'Alpha Centauri A, foyer des Na'vi et de la conscience-réseau Eywa."
order: 1
---

Pandora est une lune de la géante gazeuse **Polyphème**, en orbite dans le système d'Alpha Centauri A. Plus grande que la Terre par sa biosphère mais plus petite par sa gravité — environ 0,8 g — elle abrite une jungle tropicale dense, des montagnes flottantes saturées de magnétite (les *Hallelujah Mountains*), des océans profonds et une atmosphère riche en sulfure d'hydrogène toxique pour les humains.

Toute la vie sur Pandora est connectée par un réseau neural biologique baptisé **Eywa** — la déesse-mère, la conscience planétaire. Les arbres communiquent, les animaux portent des terminaisons nerveuses tressables, et les Na'vi peuvent former le *tsaheylu*, lien spirituel et mental, avec leurs montures et leurs ancêtres.

> *Section d'introduction. Le contenu détaillé (biomes, faune, flore, sites sacrés) sera enrichi en Plan 3.*
```

- [ ] **Step 7.2: Create the 6 stubs**

For each remaining section, create a minimal `index.md` placeholder. Below is the template — repeat it for `clans`, `bestiaire`, `flore`, `personnages`, `langue`, `films`, adapting `title` and `summary`.

Create `frontend/src/content/clans/index.md`:

```markdown
---
title: "Les clans Na'vi"
summary: "Omatikaya, Metkayina, Ash People et autres tribus de Pandora."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3 avec les profils détaillés des clans Omatikaya (forêt), Metkayina (récif), Ash People (volcan), Tipani, Anurai, Tawkami.*
```

Create `frontend/src/content/bestiaire/index.md`:

```markdown
---
title: "Bestiaire de Pandora"
summary: "Ikran, toruk, thanator, palulukan, tulkun — la faune emblématique."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3.*
```

Create `frontend/src/content/flore/index.md`:

```markdown
---
title: "Flore de Pandora"
summary: "Hometree, Arbre des âmes, plantes spirituelles et bioluminescentes."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3.*
```

Create `frontend/src/content/personnages/index.md`:

```markdown
---
title: "Personnages"
summary: "Jake, Neytiri, les enfants Sully, Quaritch — figures clés de la saga."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3.*
```

Create `frontend/src/content/langue/index.md`:

```markdown
---
title: "La langue Na'vi"
summary: "Lì'fya leNa'vi — alphabet, prononciation, expressions courantes (Paul Frommer)."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3 avec l'alphabet Na'vi, salutations cérémonielles et lexique de base.*
```

Create `frontend/src/content/films/index.md`:

```markdown
---
title: "Les films"
summary: "Avatar (2009), La Voie de l'Eau (2022), Fire and Ash (2025)."
order: 1
---

> *Section en construction. Sera enrichie en Plan 3 avec synopsis, scènes mémorables et contexte production des trois films.*
```

- [ ] **Step 7.3: Verify build**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: build succeeds, all 7 collections populated.

- [ ] **Step 7.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): Pandora intro + 6 section stubs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Sidebar component

**Files:**
- Create: `frontend/src/components/Sidebar.astro`

Sidebar 320px sticky à gauche, liste les 7 sections du codex, met en évidence la section active.

- [ ] **Step 8.1: Create Sidebar.astro**

Create `frontend/src/components/Sidebar.astro`:

```astro
---
interface Props {
  current?: string; // section slug currently active, e.g. "pandora"
}
const { current } = Astro.props;

const sections = [
  { slug: 'pandora', label: 'Pandora', href: '/pandora/intro' },
  { slug: 'clans', label: 'Clans Na\'vi', href: '/clans/index' },
  { slug: 'bestiaire', label: 'Bestiaire', href: '/bestiaire/index' },
  { slug: 'flore', label: 'Flore', href: '/flore/index' },
  { slug: 'personnages', label: 'Personnages', href: '/personnages/index' },
  { slug: 'langue', label: 'Langue Na\'vi', href: '/langue/index' },
  { slug: 'films', label: 'Les films', href: '/films/index' },
];
---
<aside class="w-80 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-eywa-text-muted/20 px-6 py-10">
  <a href="/" class="block mb-10">
    <span class="font-display tracking-widest text-2xl text-eywa-bio-primary">EYWA</span>
    <span class="block text-xs uppercase text-eywa-text-muted mt-1">Codex de Pandora</span>
  </a>

  <nav class="flex flex-col gap-1">
    {sections.map((s) => (
      <a
        href={s.href}
        class:list={[
          'block px-3 py-2 rounded text-sm font-display tracking-wide transition-colors',
          current === s.slug
            ? 'bg-eywa-bio-primary/10 text-eywa-bio-primary'
            : 'text-eywa-text-muted hover:text-eywa-text hover:bg-eywa-text/5',
        ]}
      >
        {s.label}
      </a>
    ))}
  </nav>

  <div class="mt-auto pt-10 text-xs text-eywa-text-muted/60">
    <a href="/about" class="hover:text-eywa-text-muted transition">À propos</a>
  </div>
</aside>
```

- [ ] **Step 8.2: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/Sidebar.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): Sidebar component with 7 codex sections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: CodexLayout

**Files:**
- Create: `frontend/src/layouts/CodexLayout.astro`

Wrap a content page with sidebar + main scrollable area.

- [ ] **Step 9.1: Create CodexLayout**

Create `frontend/src/layouts/CodexLayout.astro`:

```astro
---
import BaseLayout from './BaseLayout.astro';
import Sidebar from '../components/Sidebar.astro';

interface Props {
  title: string;
  current?: string;
}
const { title, current } = Astro.props;
---
<BaseLayout title={title}>
  <div class="flex">
    <Sidebar current={current} />
    <main class="flex-1 px-10 py-12 max-w-4xl">
      <slot />
    </main>
  </div>
</BaseLayout>
```

- [ ] **Step 9.2: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/layouts/CodexLayout.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): CodexLayout — sidebar + main outlet

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Dynamic codex pages (7 routes)

**Files:**
- Create: `frontend/src/pages/pandora/[...slug].astro`
- Create: `frontend/src/pages/clans/[...slug].astro`
- Create: `frontend/src/pages/bestiaire/[...slug].astro`
- Create: `frontend/src/pages/flore/[...slug].astro`
- Create: `frontend/src/pages/personnages/[...slug].astro`
- Create: `frontend/src/pages/langue/[...slug].astro`
- Create: `frontend/src/pages/films/[...slug].astro`

All 7 follow the same pattern. Below is the template — repeat verbatim for each section, just changing the collection name in 3 places.

- [ ] **Step 10.1: Create pandora/[...slug].astro**

Create `frontend/src/pages/pandora/[...slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import CodexLayout from '../../layouts/CodexLayout.astro';

export async function getStaticPaths() {
  const entries = await getCollection('pandora');
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---
<CodexLayout title={`${entry.data.title} — Eywa`} current="pandora">
  <article class="prose prose-invert max-w-none">
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-3">{entry.data.title}</h1>
    <p class="text-eywa-text-muted text-lg italic mb-10">{entry.data.summary}</p>
    <div class="text-eywa-text leading-relaxed font-body text-lg">
      <Content />
    </div>
  </article>
</CodexLayout>
```

- [ ] **Step 10.2: Create the 6 other dynamic routes**

For each of `clans`, `bestiaire`, `flore`, `personnages`, `langue`, `films`, copy the template above into `frontend/src/pages/<section>/[...slug].astro` and replace `'pandora'` (in `getCollection`) and `current="pandora"` with the matching section name.

Example for clans (`frontend/src/pages/clans/[...slug].astro`):

```astro
---
import { getCollection, render } from 'astro:content';
import CodexLayout from '../../layouts/CodexLayout.astro';

export async function getStaticPaths() {
  const entries = await getCollection('clans');
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---
<CodexLayout title={`${entry.data.title} — Eywa`} current="clans">
  <article class="prose prose-invert max-w-none">
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-3">{entry.data.title}</h1>
    <p class="text-eywa-text-muted text-lg italic mb-10">{entry.data.summary}</p>
    <div class="text-eywa-text leading-relaxed font-body text-lg">
      <Content />
    </div>
  </article>
</CodexLayout>
```

Repeat the same shape for `bestiaire`, `flore`, `personnages`, `langue`, `films`.

- [ ] **Step 10.3: Verify build & visual check**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build && npm run preview -- --host 0.0.0.0 --port 4299
```

Open http://localhost:4299/pandora/intro. Verify : sidebar visible, "Pandora" highlighted in nav, content rendered with Orbitron headings + Cormorant body. Click each of the 6 stub sections from the sidebar — all should render their stub content.

Stop preview.

- [ ] **Step 10.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): 7 dynamic codex routes wired to Content Collections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Page À propos

**Files:**
- Create: `frontend/src/pages/about.astro`

Pattern identique aux 3 autres sites + dédicace à Eva (explication du nom EYWA / EVA) + stack technique.

- [ ] **Step 11.1: Create about.astro**

Create `frontend/src/pages/about.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EywaLogo from '../components/EywaLogo.astro';
---
<BaseLayout title="À propos — Eywa">
  <main class="max-w-3xl mx-auto px-8 py-20">
    <div class="text-center mb-16">
      <EywaLogo size={280} />
      <p class="mt-6 text-eywa-text-muted text-sm uppercase tracking-widest">À propos</p>
    </div>

    <section class="space-y-6 font-body text-lg leading-relaxed">
      <h2 class="font-display text-2xl text-eywa-bio-primary">Pour Eva</h2>
      <p>
        Le nom <strong class="text-eywa-bio-primary">Eywa</strong> est celui de la déesse-réseau de Pandora — la conscience planétaire qui relie toute vie sur la lune. Mais regarde bien : <strong>E_<span class="text-eywa-bio-primary">V</span>_A</strong> est presque caché dans <strong>E_W_A</strong>, à une lettre près. Sur le logo, les trois lettres en lumière (E, la moitié gauche du W qui forme un V, et A) recomposent ton prénom.
      </p>
      <p>
        Ce site est un cadeau. Une promenade dans Pandora à offrir à une fan du film.
      </p>

      <h2 class="font-display text-2xl text-eywa-bio-primary mt-12">Vibe coded with Claude Code</h2>
      <p>
        Ce site fait partie d'un labo perso où j'explore des stacks que je ne croise pas dans mon métier. Construit en collaboration humain + IA :
      </p>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Claude Code</strong> — pair-programmation, génération de code, structure du projet</li>
        <li><strong>ChatGPT</strong> — visuels, idées de mise en scène, références UX</li>
        <li><strong>Moi</strong> — direction, choix tech, validation, écriture du contenu</li>
      </ul>

      <h2 class="font-display text-2xl text-eywa-bio-primary mt-12">Stack technique</h2>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Astro 5</strong> — framework statique-first (paradigme islands)</li>
        <li><strong>React 19</strong> — îlots interactifs (Plan 2)</li>
        <li><strong>Tailwind CSS 4</strong> — styling utilitaire</li>
        <li><strong>R3F + GSAP</strong> — animation + WebGL (Plan 2)</li>
        <li><strong>Docker + nginx</strong> — déploiement NAS Synology</li>
      </ul>

      <h2 class="font-display text-2xl text-eywa-bio-primary mt-12">Si tu veux faire pareil</h2>
      <p>
        Prends un sujet qui t'enflamme, ouvre Claude Code, décris en langage naturel ce que tu veux construire — et laisse-toi guider, étape par étape. Tu n'as pas besoin de tout savoir ; tu as juste besoin de savoir ce que tu veux.
      </p>
    </section>

    <div class="mt-20 text-center">
      <a href="/" class="text-eywa-text-muted hover:text-eywa-bio-primary transition">← retour à l'accueil</a>
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 11.2: Visual check**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run dev -- --host 0.0.0.0 --port 4299
```

Open http://localhost:4299/about. Verify : logo en haut, sections "Pour Eva" / "Vibe coded" / "Stack" / "Si tu veux faire pareil", lien retour. Stop dev.

- [ ] **Step 11.3: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/about.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(frontend): About page with Eva dedication + stack listing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Frontend Dockerfile + nginx.conf

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `.gitignore` (root)

Multi-stage build : `node:20-alpine` builder → `nginx:alpine` runtime. Pattern identique aux 3 autres apps.

- [ ] **Step 12.1: Create .gitignore at repo root**

Create `.gitignore`:

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.astro/
build/

# Logs
logs/
*.log
npm-debug.log*

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Env
.env
.env.*
!.env.example
```

- [ ] **Step 12.2: Create frontend/Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 12.3: Create frontend/nginx.conf**

Create `frontend/nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Static asset caching
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Astro generates a folder per page; fallback to index.html only at the root
  location / {
    try_files $uri $uri/ $uri.html $uri/index.html =404;
  }

  # Compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}
```

- [ ] **Step 12.4: Test docker build locally (optional, may not have Docker on WSL)**

If Docker is available on WSL :

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
docker build -t eywa-frontend-test .
docker run --rm -p 4299:80 eywa-frontend-test
```

Open http://localhost:4299. If WSL has no Docker, skip — we test on NAS in Task 13.

- [ ] **Step 12.5: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add .gitignore frontend/Dockerfile frontend/nginx.conf
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(infra): frontend Dockerfile (multi-stage) + nginx config + .gitignore

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: docker-compose.yml + first deploy

**Files:**
- Create: `docker-compose.yml` (repo root)
- Create: `README.md` (repo root)

Pattern identique aux 3 autres apps : 1 service `eywa-frontend`, port 4203 → 80.

- [ ] **Step 13.1: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  eywa-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: avatar-pandora-eywa-frontend-1
    ports:
      - "4203:80"
    restart: unless-stopped
    networks:
      - eywa-net

networks:
  eywa-net:
    driver: bridge
```

- [ ] **Step 13.2: Create README.md**

Create `README.md`:

```markdown
# Eywa — Codex de Pandora

4ᵉ site du laboratoire perso. Codex visuel de l'univers Avatar (Pandora, clans Na'vi, faune, flore, langue, films), construit comme cadeau pour ma nièce Eva.

## Stack

- **Astro 5** — framework statique-first
- **React 19** — îlots interactifs (Plan 2)
- **Tailwind CSS 4** — styling
- **R3F + GSAP** — WebGL + scrollytelling (Plan 2)
- **NestJS** minimal — proxy d'images (Plan 2)
- **Docker + nginx** — déploiement NAS Synology

## Développement

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 4299
```

## Build / Déploiement

Modifier les sources localement, sync sur le NAS, puis build via Container Manager :

```bash
# Sync sources to NAS
rsync -avz --delete --exclude node_modules --exclude dist --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/

# Build & run on NAS
ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build"
```

URL : http://nas:4203

## Crédits

Vibe coded avec Claude Code (Anthropic). Visuels & UX co-conçus avec ChatGPT.
```

- [ ] **Step 13.3: Sync source tree to NAS**

```bash
rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .astro \
  --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/
```

Expected: rsync prints transferred files.

- [ ] **Step 13.4: Create the project in Container Manager UI**

Per memory `synology_container_manager_ui_ownership.md`: projects launched only via CLI are not tracked by Synology's UI. Open Container Manager UI on the NAS, click "Project → Create", select `/volume2/docker/developpeur/avatar-pandora/docker-compose.yml`, name the project `avatar-pandora`. Don't start it yet via the UI — we'll do it via CLI to log build output.

If the user is comfortable starting via UI, that works too.

- [ ] **Step 13.5: First build & deploy**

```bash
ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build"
```

Expected: build runs (~1-3 min first time), container `avatar-pandora-eywa-frontend-1` reports `Started`.

- [ ] **Step 13.6: Verify in browser**

Open `http://nas:4203/` in a browser. Verify :
- Landing page renders : logo Eywa centré, tagline italique, 2 CTA.
- Click "Explorer le codex" → loads `/pandora/intro` with sidebar + Pandora intro content.
- Click each of the 6 other sections in sidebar → all render stubs.
- Click "À propos" → about page renders with Eva dedication.
- No console errors (open browser devtools).

- [ ] **Step 13.7: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add docker-compose.yml README.md
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(infra): docker-compose + README — first deploy on NAS port 4203

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Definition of done — V1

After Task 13, the V1 walking skeleton is complete when:

- [ ] `http://nas:4203/` loads the Eywa landing page with logo + tagline + CTA
- [ ] The Eywa logo visually reveals EVA via lit letters (E, left V of W, A)
- [ ] Clicking "Explorer le codex" opens `/pandora/intro` with sidebar + content
- [ ] All 7 codex sections render (Pandora full + 6 stubs) with consistent layout
- [ ] Sidebar highlights the active section
- [ ] About page (`/about`) renders with Eva dedication and stack listing
- [ ] No console errors in any page
- [ ] Container `avatar-pandora-eywa-frontend-1` runs in `restart: unless-stopped` mode
- [ ] All commits pushed locally to the `main` branch (push to GitHub remote is a separate decision)

## Out of scope for V1 (deferred)

| Item | Plan |
|---|---|
| Backend NestJS image proxy | Plan 2 |
| Scrollytelling cinématique landing (5 scènes) | Plan 2 |
| R3F particles pollen ambient background | Plan 2 |
| Section content fully populated (rich lore) | Plan 3 |
| `prefers-reduced-motion` + mobile WebGL fallback | Plan 2 |
| Easter egg "EVA reveal" interactif au scroll | Plan 2 (à concevoir) |
| GitHub repo creation + initial push | À décider après V1 |

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tailwind v4 vs v3 config divergence (config file vs `@theme` in CSS) | Step 2.2 explicitly handles both cases; if v4 vite plugin is detected, use `@theme` |
| `npm create astro@latest` interactive prompts | Use `--no-install --no-git --skip-houston` flags; if version doesn't accept, fall back to interactive and accept defaults |
| Docker build fails on first NAS deploy | Step 13.5 logs build output; if it fails, check `docker compose logs` and rebuild with `--no-cache` |
| Astro Content Collections `glob` loader API | Astro 5 requires `glob` from `astro/loaders` (Step 6.1) — if API differs, consult `astro@latest` content config docs |
| nginx fallback for clean URLs | Step 12.3 has `try_files` with `$uri.html` to handle Astro's per-page folder structure |

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| Architecture two-temps (landing + codex) | Tasks 5, 9, 10 |
| Stack technique (Astro, React, Tailwind, Docker) | Tasks 1, 12, 13 |
| Logo "EVA dans EYWA" | Task 3 |
| Identité visuelle (palette + typo) | Task 2 |
| Codex 7 sections | Tasks 6, 7, 8, 9, 10 |
| Sidebar 320px sticky | Task 8 |
| Page À propos avec dédicace Eva | Task 11 |
| Déploiement NAS (port 4203, Docker) | Tasks 12, 13 |
| Hors-scope V1 (R3F, scrollytelling, backend) | Documented in "Out of scope" |
| Sources contenu (canon Pandorapedia, etc.) | Plan 3 (V1 ships with 1 stub + 6 placeholders) |
