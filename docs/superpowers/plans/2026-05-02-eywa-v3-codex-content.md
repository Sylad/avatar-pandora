# Eywa V3 — Codex Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the 7 codex sections (currently stubs) with sourced lore content + add per-section index pages with image-first cards. After V3, http://nas:4203/pandora, /clans, /bestiaire, /flore, /personnages, /langue, /films each show a real codex with multiple entries, navigable from the sidebar. Images served via the V2 wiki-image proxy.

**Architecture:** Each section gets a top-level index page (`pages/<section>.astro`) listing its entries as image-first cards (`EntryCard.astro` component). Individual entries remain as Astro Content Collections markdown files at `src/content/<section>/<slug>.md`, served via the existing `pages/<section>/[...slug].astro` dynamic route. Sidebar links point to the section indexes (not a specific entry). Content schema gains an optional `cover` field — a Wikipedia query string proxied through `/api/wiki-image?q=...`. Langue Na'vi is the exception: a single rich page (alphabet + grammaire + lexique) instead of multiple entries.

**Tech Stack:** Astro 6 Content Collections, Tailwind 4, EywaLogo + existing CodexLayout, V2 backend `/api/wiki-image` proxy.

**Repo paths:** Local source `/home/sylvain_ladoire/projects/developpeur/avatar-pandora/`, NAS deploy `/volume2/docker/developpeur/avatar-pandora/`. Sync via `rsync --rsync-path=/usr/bin/rsync` per memory.

**Sources canoniques :**
- **Pandorapedia** (https://www.pandorapedia.com) — base canonique Disney/Cameron
- **Avatar Wiki Fandom** (https://james-camerons-avatar.fandom.com) — détails créatures, persos, scènes
- **Paul Frommer** (https://naviteri.org) — langue Na'vi
- **Synthèse en français par Claude Code** — pas de copier-coller wiki, réécriture fluide
- **Images** — proxy `/api/wiki-image?q=NAME` (Plan 2)

---

## Target file structure (after V3)

```
frontend/src/
├── content.config.ts            ← MODIFY (add cover field to schema)
├── content/
│   ├── pandora/
│   │   ├── intro.md             (existing — keep)
│   │   ├── biomes.md            ← NEW
│   │   ├── sites-sacres.md      ← NEW
│   │   └── atmosphere.md        ← NEW
│   ├── clans/
│   │   ├── omatikaya.md         ← NEW
│   │   ├── metkayina.md         ← NEW
│   │   ├── ash-people.md        ← NEW
│   │   └── tipani.md            ← NEW
│   │   (existing index.md → DELETE)
│   ├── bestiaire/
│   │   ├── ikran.md             ← NEW
│   │   ├── toruk.md             ← NEW
│   │   ├── thanator.md          ← NEW
│   │   ├── palulukan.md         ← NEW
│   │   └── tulkun.md            ← NEW
│   │   (existing index.md → DELETE)
│   ├── flore/
│   │   ├── hometree.md          ← NEW
│   │   ├── arbre-des-ames.md    ← NEW
│   │   ├── woodsprites.md       ← NEW
│   │   └── plantes-helico.md    ← NEW
│   │   (existing index.md → DELETE)
│   ├── personnages/
│   │   ├── jake-sully.md        ← NEW
│   │   ├── neytiri.md           ← NEW
│   │   ├── quaritch.md          ← NEW
│   │   ├── enfants-sully.md     ← NEW
│   │   └── spider.md            ← NEW
│   │   (existing index.md → DELETE)
│   ├── langue/
│   │   └── (no entries — page is /pages/langue.astro standalone)
│   │   (existing index.md → DELETE)
│   └── films/
│       ├── avatar-2009.md       ← NEW
│       ├── voie-de-leau.md      ← NEW
│       └── fire-and-ash.md      ← NEW
│       (existing index.md → DELETE)
├── components/
│   ├── EntryCard.astro          ← NEW
│   └── Sidebar.astro            ← MODIFY (links to section indexes)
└── pages/
    ├── pandora.astro            ← NEW (section index)
    ├── clans.astro              ← NEW
    ├── bestiaire.astro          ← NEW
    ├── flore.astro              ← NEW
    ├── personnages.astro        ← NEW
    ├── langue.astro             ← NEW (standalone — no entries)
    ├── films.astro              ← NEW
    └── pandora/[...slug].astro  (existing — keep, used for /pandora/biomes etc.)
        clans/[...slug].astro    (idem)
        bestiaire/[...slug].astro
        flore/[...slug].astro
        personnages/[...slug].astro
        films/[...slug].astro
        (existing langue/[...slug].astro can be DELETED — langue has no entries)
```

## Verification approach

- **Build succeeds**: `npm run build` exits 0, all entries validate against the Zod schema, all index pages render their entry list.
- **Visual checks**: open each section index in browser, eyeball the cards layout, click into an entry, verify image loads (via `/api/wiki-image`).
- **Content tone check**: text in French, sourced (not copy-pasted), encyclopedic-but-lyrical, ~200-400 words per entry.

## Git author

Same as previous plans: `git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "..."`. Never modify global config.

## Content tone reference

Each entry's prose should be:
- **French**, fluide, not wiki-ese.
- **200-400 words** for creatures/clans/persos. Up to 600 for sites majeurs (Hometree, Pandora intro).
- **Encyclopedic but lyrical**: matter-of-fact tone with occasional poetic phrasing — like a National Geographic article on an alien world.
- **No spoilers from films** unrelated to the entry's topic. e.g. don't reveal Quaritch's recombinant return when discussing Hometree.
- **Cite the Pandorapedia / Avatar Wiki / Frommer source** at the bottom (`> Source : Pandorapedia + Avatar Wiki Fandom`).

---

## Task 1: Schema + EntryCard component

**Files:**
- Modify: `frontend/src/content.config.ts` (already has `cover`, keep — verify)
- Create: `frontend/src/components/EntryCard.astro`

The card shows: cover image (from `/api/wiki-image?q=cover`), title, summary, hover highlight. Image lazy-loads with a placeholder (eywa-bg fade). Used by all section index pages.

- [ ] **Step 1.1: Verify content schema has `cover` field**

Read `frontend/src/content.config.ts`. Confirm the `codexEntrySchema` already has `cover: z.string().url().optional()` (it does, per Plan 1 Task 6). The schema field stores either a URL OR a wiki query — but URL-only enforces strictness. We'll relax this to allow either:

```ts
const codexEntrySchema = z.object({
  title: z.string(),
  summary: z.string(),
  order: z.number().optional(),
  // cover is either a wiki search query (resolved via /api/wiki-image?q=...)
  // OR a full URL (for non-wiki images). Both forms accepted.
  cover: z.string().optional(),
});
```

- [ ] **Step 1.2: Create EntryCard.astro**

Create `frontend/src/components/EntryCard.astro`:

```astro
---
interface Props {
  href: string;
  title: string;
  summary: string;
  cover?: string;
}
const { href, title, summary, cover } = Astro.props;

// Resolve cover: if it's a full URL, use as-is; otherwise it's a wiki query → use the proxy.
let imgSrc: string | undefined;
if (cover) {
  imgSrc = cover.startsWith('http') ? cover : `/api/wiki-image?q=${encodeURIComponent(cover)}`;
}
---
<a href={href}
   class="group block rounded overflow-hidden border border-eywa-text-muted/20 bg-eywa-text/[0.02] hover:border-eywa-bio-primary/40 hover:shadow-glow-bio transition-all">
  {imgSrc ? (
    <div class="aspect-[16/10] bg-eywa-bg overflow-hidden">
      <img src={imgSrc}
           alt={title}
           loading="lazy"
           class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
           onerror="this.style.display='none'" />
    </div>
  ) : (
    <div class="aspect-[16/10] bg-gradient-to-br from-eywa-bg to-eywa-bio-primary/10 flex items-center justify-center">
      <span class="font-display text-eywa-bio-primary/50 tracking-widest text-sm">EYWA</span>
    </div>
  )}
  <div class="p-5">
    <h3 class="font-display text-lg text-eywa-text group-hover:text-eywa-bio-primary tracking-wide mb-2 transition-colors">
      {title}
    </h3>
    <p class="text-sm text-eywa-text-muted font-body leading-relaxed line-clamp-3">
      {summary}
    </p>
  </div>
</a>
```

- [ ] **Step 1.3: Build verify**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean (the schema relaxation may emit a warning about existing `intro.md` — acceptable).

- [ ] **Step 1.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content.config.ts frontend/src/components/EntryCard.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(codex): EntryCard component + relax cover schema (URL or wiki query)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Section index page template + sidebar update

**Files:**
- Modify: `frontend/src/components/Sidebar.astro` (links to section indexes)
- Create: `frontend/src/pages/pandora.astro` (canonical template — copy for other sections)

After this task, Pandora's index page lists its entries as cards. Other sections follow in Task 3.

- [ ] **Step 2.1: Update sidebar links**

Edit `frontend/src/components/Sidebar.astro`. Find the `sections` array and replace:

```js
const sections = [
  { slug: 'pandora', label: 'Pandora', href: '/pandora' },
  { slug: 'clans', label: 'Clans Na\'vi', href: '/clans' },
  { slug: 'bestiaire', label: 'Bestiaire', href: '/bestiaire' },
  { slug: 'flore', label: 'Flore', href: '/flore' },
  { slug: 'personnages', label: 'Personnages', href: '/personnages' },
  { slug: 'langue', label: 'Langue Na\'vi', href: '/langue' },
  { slug: 'films', label: 'Les films', href: '/films' },
];
```

(Removed `/intro` and `/index` suffixes — sidebar now points to section root URLs.)

- [ ] **Step 2.2: Create `frontend/src/pages/pandora.astro`** (canonical section index)

```astro
---
import { getCollection } from 'astro:content';
import CodexLayout from '../layouts/CodexLayout.astro';
import EntryCard from '../components/EntryCard.astro';

const entries = await getCollection('pandora');
entries.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
---
<CodexLayout title="Pandora — Eywa" current="pandora">
  <header class="mb-12">
    <p class="text-xs uppercase tracking-[0.25em] text-eywa-text-muted font-display mb-3">
      I — Pandora
    </p>
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-4">La lune jungle</h1>
    <p class="text-lg text-eywa-text-muted font-body italic max-w-2xl">
      Lune habitable d'Alpha Centauri A, foyer des Na'vi et de la conscience-réseau Eywa.
    </p>
  </header>

  <section class="grid grid-cols-1 md:grid-cols-2 gap-5">
    {entries.map((entry) => (
      <EntryCard
        href={`/pandora/${entry.id}`}
        title={entry.data.title}
        summary={entry.data.summary}
        cover={entry.data.cover}
      />
    ))}
  </section>
</CodexLayout>
```

- [ ] **Step 2.3: Build verify**

```bash
npm run build
```

Expected: clean. The page `/pandora` builds and lists existing `intro.md` as a single card. URL `http://localhost:4299/pandora` should render after dev server restart.

- [ ] **Step 2.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/components/Sidebar.astro frontend/src/pages/pandora.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(codex): /pandora section index + sidebar nav points to section roots

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Section indexes for clans, bestiaire, flore, personnages, films

**Files (create all 5):**
- `frontend/src/pages/clans.astro`
- `frontend/src/pages/bestiaire.astro`
- `frontend/src/pages/flore.astro`
- `frontend/src/pages/personnages.astro`
- `frontend/src/pages/films.astro`

(Langue is handled in Task 9 as a standalone page — different shape.)

Each follows the Pandora template from Task 2 with these substitutions:

| Section | Title | Subtitle | Roman | Italic tagline |
|---|---|---|---|---|
| clans | "Clans Na'vi" | "Les peuples de Pandora" | II | "Omatikaya, Metkayina, Ash People — chaque clan tisse son lien à Eywa." |
| bestiaire | "Bestiaire" | "La faune de Pandora" | III | "Ikran, toruk, thanator — créatures sublimes et létales." |
| flore | "Flore" | "Les arbres-réseaux et plantes sacrées" | IV | "Hometree, Arbre des âmes, racines connectées par milliers de kilomètres." |
| personnages | "Personnages" | "Figures de la saga Avatar" | V | "Jake, Neytiri, Quaritch — destins croisés sur trois films." |
| films | "Les films" | "Trois œuvres, vingt-cinq ans de Pandora" | VII | "De 2009 à 2025 — l'évolution d'une vision." |

- [ ] **Step 3.1: Create `frontend/src/pages/clans.astro`**

```astro
---
import { getCollection } from 'astro:content';
import CodexLayout from '../layouts/CodexLayout.astro';
import EntryCard from '../components/EntryCard.astro';

const entries = await getCollection('clans');
entries.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
---
<CodexLayout title="Clans Na'vi — Eywa" current="clans">
  <header class="mb-12">
    <p class="text-xs uppercase tracking-[0.25em] text-eywa-text-muted font-display mb-3">
      II — Clans Na'vi
    </p>
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-4">Les peuples de Pandora</h1>
    <p class="text-lg text-eywa-text-muted font-body italic max-w-2xl">
      Omatikaya, Metkayina, Ash People — chaque clan tisse son lien à Eywa.
    </p>
  </header>
  <section class="grid grid-cols-1 md:grid-cols-2 gap-5">
    {entries.map((entry) => (
      <EntryCard href={`/clans/${entry.id}`} title={entry.data.title} summary={entry.data.summary} cover={entry.data.cover} />
    ))}
  </section>
</CodexLayout>
```

- [ ] **Step 3.2: Create `frontend/src/pages/bestiaire.astro`**

Same shape with collection `bestiaire`, current `bestiaire`, header roman III, title "Bestiaire", subtitle "La faune de Pandora", italic "Ikran, toruk, thanator — créatures sublimes et létales.", entry href `/bestiaire/${entry.id}`.

- [ ] **Step 3.3: Create `frontend/src/pages/flore.astro`**

Same shape: collection `flore`, current `flore`, IV, "Flore", "Les arbres-réseaux et plantes sacrées", "Hometree, Arbre des âmes, racines connectées par milliers de kilomètres.", href `/flore/${entry.id}`.

- [ ] **Step 3.4: Create `frontend/src/pages/personnages.astro`**

Collection `personnages`, current `personnages`, V, "Personnages", "Figures de la saga Avatar", "Jake, Neytiri, Quaritch — destins croisés sur trois films.", href `/personnages/${entry.id}`.

- [ ] **Step 3.5: Create `frontend/src/pages/films.astro`**

Collection `films`, current `films`, VII, "Les films", "Trois œuvres, vingt-cinq ans de Pandora", "De 2009 à 2025 — l'évolution d'une vision.", href `/films/${entry.id}`.

(Langue gets VI — it's Task 9.)

- [ ] **Step 3.6: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean. All section indexes build, currently each shows just its `index.md` stub as a single card (until we replace stubs with real entries).

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/clans.astro frontend/src/pages/bestiaire.astro frontend/src/pages/flore.astro frontend/src/pages/personnages.astro frontend/src/pages/films.astro
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(codex): section index pages for clans / bestiaire / flore / personnages / films

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pandora — 3 new entries (replace existing intro + add 3)

**Files:**
- Modify: `frontend/src/content/pandora/intro.md` (add cover field)
- Create: `frontend/src/content/pandora/biomes.md`
- Create: `frontend/src/content/pandora/sites-sacres.md`
- Create: `frontend/src/content/pandora/atmosphere.md`

Each entry: frontmatter (title, summary, order, cover) + 200-400 words FR prose sourced from Pandorapedia / Avatar Wiki, plus a citation footer.

- [ ] **Step 4.1: Update intro.md frontmatter to add cover**

Modify `frontend/src/content/pandora/intro.md` frontmatter. Replace the existing block with:

```yaml
---
title: "Pandora — la lune jungle"
summary: "Lune habitable d'Alpha Centauri A, foyer des Na'vi et de la conscience-réseau Eywa."
order: 1
cover: "Pandora (Avatar)"
---
```

(Body unchanged.)

- [ ] **Step 4.2: Create `biomes.md`**

```markdown
---
title: "Biomes de Pandora"
summary: "Forêt tropicale, montagnes flottantes, océans abyssaux, plaines volcaniques — la lune assemble plusieurs mondes en un."
order: 2
cover: "Pandora biome"
---

[200-400 mots de prose française couvrant les biomes principaux :
forêt tropicale Omatikaya, montagnes Hallelujah (magnétite, lévitation),
océans Metkayina (récifs bioluminescents), plaines Anurai (steppes),
volcans Mangkwan (Ash People). Citer Pandorapedia + Avatar Wiki en source.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

The implementer should write the prose by consulting the sources (web fetch) — NOT copy-paste, but synthesize in fluid French. ~200-400 words.

- [ ] **Step 4.3: Create `sites-sacres.md`**

```markdown
---
title: "Sites sacrés"
summary: "L'Arbre des Âmes, l'Arbre des Voix, Iknimaya — lieux où Eywa parle plus fort qu'ailleurs."
order: 3
cover: "Tree of Souls Avatar"
---

[Prose FR ~250-400 mots couvrant : Arbre des Âmes (Tree of Souls,
Vitraya Ramunong), Arbre des Voix (Tree of Voices, Utral Aymokriyä),
Iknimaya (rite de passage Omatikaya, falaise des ikran), et la
notion de tsaheylu collectif au pied des arbres-mères.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 4.4: Create `atmosphere.md`**

```markdown
---
title: "Atmosphère & gravité"
summary: "Air toxique pour les humains, gravité 0,8 g, magnétite à profusion — Pandora ne pardonne pas la respiration distraite."
order: 4
cover: "Pandora atmosphere"
---

[Prose FR ~200-300 mots : composition atmosphérique (sulfure
d'hydrogène, ammoniac), pourquoi les humains portent des masques
exo-pack, gravité 0,8 g et ses effets sur la faune (créatures
plus grandes), champ magnétique anormal lié à la magnétite,
flux de Pandora sur Polyphème (jour court, nuits longues sous
Polyphème).]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 4.5: Build verify + visual smoke**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean. `/pandora` index shows 4 cards (intro + 3 new). Each card has a cover via wiki-image.

- [ ] **Step 4.6: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/pandora/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): Pandora — biomes, sites sacrés, atmosphère + cover on intro

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Clans Na'vi — 4 entries (replace existing index.md)

**Files:**
- Delete: `frontend/src/content/clans/index.md`
- Create: `frontend/src/content/clans/omatikaya.md`
- Create: `frontend/src/content/clans/metkayina.md`
- Create: `frontend/src/content/clans/ash-people.md`
- Create: `frontend/src/content/clans/tipani.md`

Per-entry frontmatter + 250-400 words FR. Cover query targets the FR Wikipedia page if available, else EN.

- [ ] **Step 5.1: Delete the stub `index.md`**

```bash
git rm frontend/src/content/clans/index.md
```

- [ ] **Step 5.2: Create `omatikaya.md`**

```markdown
---
title: "Omatikaya"
summary: "Le clan de la forêt, gardiens du Hometree et de l'Arbre des Âmes. Foyer de Neytiri, Mo'at, Tsu'tey."
order: 1
cover: "Omaticaya clan"
---

[Prose FR ~300 mots : géographie (forêt tropicale ouest de la Vallée
Omatikaya), structure sociale (Olo'eyktan, Tsahìk), lien historique
avec Hometree, conséquence du film 1 (déplacement à Hawnu'Tnu après
la destruction de l'arbre), figures clés Mo'at + Eytukan + Neytiri,
rapport spirituel à Eywa via les ikran. Mentionner que c'est le clan
que Jake Sully rejoint.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 5.3: Create `metkayina.md`**

```markdown
---
title: "Metkayina"
summary: "Le clan du récif, peuple de l'eau aux mains palmées et à la queue plus puissante que celles des Na'vi forestiers."
order: 2
cover: "Metkayina clan"
---

[Prose FR ~300-350 mots : géographie (archipels et récifs
bioluminescents, atolls), morphologie distincte (mains palmées,
avant-bras allongés, queue plus large pour la nage), monture =
ilu (équivalent aquatique du dakota), tsahìk = Ronal, olo'eyktan
= Tonowari. Lien spirituel aux tulkun (frères-âmes). Accueil
forcé des Sully au début de "Voie de l'Eau".]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 5.4: Create `ash-people.md`**

```markdown
---
title: "Ash People (Mangkwan)"
summary: "Le clan des Cendres, peuple volcanique au cœur du film Fire and Ash. Hostile, dépourvu du lien classique à Eywa."
order: 3
cover: "Ash People Avatar"
---

[Prose FR ~300-350 mots : tribu introduite dans Avatar 3 (Fire and
Ash, 2025), territoire = volcans Mangkwan, peinture corporelle
distinctive en cendres et rouge, philosophie qui rompt avec la
vision Eywa des autres clans (déconnexion volontaire, ou autre
forme de spiritualité, à clarifier sans spoiler critique). Cheffe
Varang (interprétée par Oona Chaplin).]

> Source : Avatar Wiki Fandom + Pandorapedia (entrées Fire & Ash)
```

- [ ] **Step 5.5: Create `tipani.md`**

```markdown
---
title: "Tipani"
summary: "Clan des plaines, célèbres cavaliers de pa'li (chevaux à six pattes), commerce inter-clans."
order: 4
cover: "Tipani clan Avatar"
---

[Prose FR ~250-300 mots : peuple des plaines herbeuses, économie
nomade liée aux pa'li, rôle d'intermédiaires commerciaux entre
clans forestiers et Anurai. Cités sur Pandorapedia comme un des
clans secondaires de la première ère.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 5.6: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean. `/clans` index shows 4 cards.

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/clans/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): clans — Omatikaya, Metkayina, Ash People, Tipani (4 entries)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Bestiaire — 5 entries

**Files:**
- Delete: `frontend/src/content/bestiaire/index.md`
- Create: `frontend/src/content/bestiaire/ikran.md`
- Create: `frontend/src/content/bestiaire/toruk.md`
- Create: `frontend/src/content/bestiaire/thanator.md`
- Create: `frontend/src/content/bestiaire/palulukan.md`
- Create: `frontend/src/content/bestiaire/tulkun.md`

- [ ] **Step 6.1: Delete stub + create ikran**

```bash
git rm frontend/src/content/bestiaire/index.md
```

Create `ikran.md`:

```markdown
---
title: "Ikran (Banshee)"
summary: "Le « banshee de montagne ». Premier compagnon volant que tout Na'vi forestier doit conquérir pour devenir adulte."
order: 1
cover: "Ikran Avatar"
---

[Prose FR ~250-300 mots : morphologie (envergure 12 mètres, deux
paires d'ailes membraneuses, pinces préhensiles), territoire
(falaises et hauteurs Iknimaya), rite de passage des jeunes
Omatikaya (capture + tsaheylu = lien permanent à vie), un seul
ikran par chasseur dans toute sa vie.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 6.2: Create `toruk.md`**

```markdown
---
title: "Toruk (Great Leonopteryx)"
summary: "Le grand léonoptère écarlate. Le plus grand prédateur volant. Cinq Na'vi seulement l'ont monté en mille ans."
order: 2
cover: "Toruk Avatar"
---

[Prose FR ~250-350 mots : envergure 25 mètres, livrée écarlate
avec crête noire, prédateur sommital aérien. Le titre "Toruk Makto"
(cavalier de toruk) est mythique — quiconque le porte unifie les
clans en temps de crise. Jake Sully le devient dans Avatar 1.
Approche par-dessus (le toruk ne regarde jamais en l'air, son
seul angle mort).]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 6.3: Create `thanator.md`**

```markdown
---
title: "Thanator (Palulukan)"
summary: "Le grand prédateur des forêts, six pattes blindées, mâchoires capables de broyer la magnétite."
order: 3
cover: "Thanator Avatar"
---

[Prose FR ~250-300 mots : équivalent terrestre = panthère noire
× crocodile, six pattes, peau noire luisante, fourreaux maxillaires
distinctifs, capable de courir 40+ km/h. Considéré indomptable
jusqu'à Neytiri qui établit un tsaheylu avec un thanator dans
"Voie de l'Eau" (déjà fait par Jake dans Avatar 1, mais bref).]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 6.4: Create `palulukan.md`**

Wait — palulukan EST le nom Na'vi du thanator. We need a different creature. Let me replace by **viperwolf (nantang)**.

Create `palulukan.md` → rename file mentally to `nantang.md`:

```bash
# Create nantang.md instead of palulukan.md
```

Create `frontend/src/content/bestiaire/nantang.md`:

```markdown
---
title: "Nantang (Viperwolf)"
summary: "Loup-vipère. Six pattes, écailles noires, chasse en meute coordonnée par cris ultrasoniques."
order: 4
cover: "Viperwolf Avatar"
---

[Prose FR ~200-300 mots : prédateur de meute, taille moyenne
(80 cm au garrot), six pattes, peau noire couverte d'écailles
nervurées, mâchoire vipère avec crocs. Communication ultrasonique
inter-meute. Embuscade nocturne typique. Premier prédateur que
Jake rencontre dans Avatar 1.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

(Plan task name keeps `palulukan.md` for backward reference, but the actual file created is `nantang.md`. The implementer should clarify this in the commit message.)

- [ ] **Step 6.5: Create `tulkun.md`**

```markdown
---
title: "Tulkun"
summary: "Cétacé sentient des océans Metkayina. Lignée matriarcale, langage chanté, paix violemment rompue par les baleinières humaines."
order: 5
cover: "Tulkun Avatar"
---

[Prose FR ~300-400 mots : créature centrale du film 2, taille
~80 mètres, sentience prouvée (musique chantée trans-générationnelle,
mathématiques, philosophie de la non-violence). Lien spirituel
1-1 avec un Na'vi Metkayina ("frère-âme"). Chassés par la RDA
pour l'amrita (substance anti-âge). Payakan (le paria) = arc
narratif clé.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 6.6: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build

cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/bestiaire/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): bestiaire — ikran, toruk, thanator, nantang, tulkun (5 entries)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Flore — 4 entries

**Files:**
- Delete: `frontend/src/content/flore/index.md`
- Create: `frontend/src/content/flore/hometree.md`
- Create: `frontend/src/content/flore/arbre-des-ames.md`
- Create: `frontend/src/content/flore/woodsprites.md`
- Create: `frontend/src/content/flore/plantes-helico.md`

- [ ] **Step 7.1: Delete stub**

```bash
git rm frontend/src/content/flore/index.md
```

- [ ] **Step 7.2: Create `hometree.md`**

```markdown
---
title: "Hometree (Kelutral)"
summary: "L'arbre-mère du clan Omatikaya. 150 mètres de haut, abrite plusieurs centaines de Na'vi, racine au réseau-Eywa."
order: 1
cover: "Hometree Avatar"
---

[Prose FR ~400-600 mots : description physique (hauteur, diamètre
basal, longévité ~plurimillénaire), organisation interne (galeries
familiales, plates-formes communales), rôle dans le tsaheylu
collectif (les racines connectent au réseau planétaire), destruction
dans Avatar 1 par la RDA, conséquence pour le clan. Il existe
plusieurs arbres-mères sur Pandora, un par clan forestier.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 7.3: Create `arbre-des-ames.md`**

```markdown
---
title: "Arbre des Âmes (Vitraya Ramunong)"
summary: "Le centre spirituel de Pandora. Là où Eywa entend le mieux, où les conscience peuvent transitionner d'un corps à l'autre."
order: 2
cover: "Tree of Souls Avatar"
---

[Prose FR ~350-500 mots : description (saule pleureur géant
bioluminescent, tendrils suspendus servant de relais neuronaux),
fonction rituelle (transfert de conscience humain → avatar,
prière collective, communion avec les ancêtres), rôle dans le
climax d'Avatar 1 (Jake transféré dans son corps Na'vi).
Nom Na'vi = Vitraya Ramunong.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 7.4: Create `woodsprites.md`**

```markdown
---
title: "Woodsprites (Atokirina')"
summary: "Graines du Saint-Arbre. Esprits sylvestres qui flottent, jugent, parfois bénissent un étranger digne."
order: 3
cover: "Woodsprite Avatar"
---

[Prose FR ~200-300 mots : description (méduses lumineuses
volantes, blanc-bleu, taille d'un poing), nature (graines de
l'Arbre des Âmes, vecteurs d'Eywa), rôle narratif (signe
d'élection — Neytiri allait tuer Jake mais quand des
woodsprites se posent sur lui, elle interprète qu'Eywa a
parlé). Présents dans tous les biomes forestiers.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 7.5: Create `plantes-helico.md`**

```markdown
---
title: "Plantes hélicoptères (Loreyu)"
summary: "Plantes spirales qui se rétractent au toucher. Décoration et sentinelle naturelle des Omatikaya."
order: 4
cover: "Helicoradian Avatar"
---

[Prose FR ~200-250 mots : description (tiges cylindriques
bioluminescentes terminées par des spirales qui se rétractent
en moins d'une seconde au moindre contact), nom anglais
helicoradian, fonction dans l'écosystème, présence majeure
sous la canopée Omatikaya.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 7.6: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build

cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/flore/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): flore — Hometree, Arbre des Âmes, woodsprites, plantes hélico (4 entries)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Personnages — 5 entries

**Files:**
- Delete: `frontend/src/content/personnages/index.md`
- Create: `frontend/src/content/personnages/jake-sully.md`
- Create: `frontend/src/content/personnages/neytiri.md`
- Create: `frontend/src/content/personnages/quaritch.md`
- Create: `frontend/src/content/personnages/enfants-sully.md`
- Create: `frontend/src/content/personnages/spider.md`

- [ ] **Step 8.1: Delete stub**

```bash
git rm frontend/src/content/personnages/index.md
```

- [ ] **Step 8.2: Create `jake-sully.md`**

```markdown
---
title: "Jake Sully"
summary: "Marine paraplégique devenu Toruk Makto, Olo'eyktan Omatikaya, père de famille Na'vi-Metkayina."
order: 1
cover: "Jake Sully"
---

[Prose FR ~400-500 mots : ancien Marine (jambes paralysées en
service), jumeau de Tom (mort) qui le mène au programme Avatar,
arc Avatar 1 (infiltration → bascule → Toruk Makto → leader
Omatikaya → transfert définitif au corps Na'vi), arc Avatar 2
(père de famille en exil chez les Metkayina), interprété par
Sam Worthington.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 8.3: Create `neytiri.md`**

```markdown
---
title: "Neytiri te Tskaha Mo'at'ite"
summary: "Tsahìk en devenir, fille de Mo'at, compagne de Jake, mère de quatre enfants. Chasseuse et guerrière."
order: 2
cover: "Neytiri Avatar"
---

[Prose FR ~400-500 mots : héritière du titre tsahìk d'Omatikaya,
mentor initial de Jake, tueuse historique du Colonel Quaritch
(Avatar 1), mère endeuillée de Neteyam (Avatar 2), interprétée
par Zoe Saldaña.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 8.4: Create `quaritch.md`**

```markdown
---
title: "Miles Quaritch"
summary: "Colonel des SecOps. Tué dans Avatar 1, ressuscité en corps Na'vi recombinant dans Avatar 2 et 3."
order: 3
cover: "Miles Quaritch"
---

[Prose FR ~400-500 mots : antagoniste principal, militaire
endurci, premier passage humain (Avatar 1) → tué par Neytiri,
seconde vie en avatar Na'vi recombinant chargé de la mémoire
du Quaritch original (Avatar 2-3), arc moral complexe (sa
relation avec Spider, son propre fils biologique humain).
Interprété par Stephen Lang.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 8.5: Create `enfants-sully.md`**

```markdown
---
title: "Les enfants Sully"
summary: "Neteyam, Lo'ak, Kiri, Tuk — la famille au centre de la trilogie 2-3-4."
order: 4
cover: "Sully family Avatar"
---

[Prose FR ~400-500 mots : présenter brièvement les 4 enfants
(2 fils biologiques Na'vi de Jake+Neytiri = Neteyam aîné +
Lo'ak rebelle ; Kiri = fille adoptée née de l'avatar de Grace
Augustine, lien direct à Eywa ; Tuk = la petite). Mort de
Neteyam dans Avatar 2 fin. Liens et tensions inter-fratrie.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 8.6: Create `spider.md`**

```markdown
---
title: "Miles « Spider » Socorro"
summary: "Enfant humain abandonné sur Pandora, élevé par les Sully. Fils biologique de Quaritch."
order: 5
cover: "Spider Avatar 2"
---

[Prose FR ~300-400 mots : seul humain de la base abandonnée
trop jeune pour être évacué, élevé chez les Omatikaya en
quasi-Na'vi (cheveux dreadés, langue Na'vi maternelle, port
d'exo-pack). Capture par Quaritch recombinant (son père
biologique inconnu de lui), tension morale centrale d'Avatar 2.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 8.7: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build

cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/personnages/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): personnages — Jake, Neytiri, Quaritch, enfants Sully, Spider (5 entries)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Langue Na'vi — page standalone

**Files:**
- Delete: `frontend/src/content/langue/index.md` (and remove the langue collection from content.config.ts since it has no entries)
- Delete: `frontend/src/pages/langue/[...slug].astro`
- Create: `frontend/src/pages/langue.astro` — standalone rich page

This section is different. There are no per-entry pages — instead, a single comprehensive page covering alphabet, grammar essentials, and a beginner's lexicon.

- [ ] **Step 9.1: Remove the langue collection**

Delete content + dynamic route:

```bash
git rm frontend/src/content/langue/index.md
git rm frontend/src/pages/langue/[...slug].astro
rmdir frontend/src/content/langue/ 2>/dev/null || true
rmdir frontend/src/pages/langue/ 2>/dev/null || true
```

Edit `frontend/src/content.config.ts`. Remove the `langue: makeCollection('langue')` line from the collections export.

- [ ] **Step 9.2: Create `frontend/src/pages/langue.astro`**

Standalone page (no Content Collection, just hand-written prose + tables):

```astro
---
import CodexLayout from '../layouts/CodexLayout.astro';
---
<CodexLayout title="Langue Na'vi — Eywa" current="langue">
  <header class="mb-12">
    <p class="text-xs uppercase tracking-[0.25em] text-eywa-text-muted font-display mb-3">
      VI — Lì'fya leNa'vi
    </p>
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-4">La langue Na'vi</h1>
    <p class="text-lg text-eywa-text-muted font-body italic max-w-2xl">
      « Kaltxì. » Bonjour. Construite par le Dr Paul Frommer pour les films, vraie langue avec grammaire complète.
    </p>
  </header>

  <article class="prose prose-invert max-w-none font-body text-lg text-eywa-text leading-relaxed space-y-10">

    <section>
      <h2 class="font-display text-2xl text-eywa-bio-primary mb-4">Alphabet</h2>
      <p>
        Le Na'vi utilise un alphabet latin adapté avec une trentaine de sons. Voyelles courtes/longues, consonnes éjectives (notées avec apostrophe), tons absents.
      </p>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Voyelles</strong> : a, ä, e, i, ì, o, u (+ pseudo-voyelles ll, rr)</li>
        <li><strong>Consonnes éjectives</strong> : px, tx, kx (notées avec x)</li>
        <li><strong>Apostrophe</strong> = stop glottal (un coup de gorge bref)</li>
      </ul>
    </section>

    <section>
      <h2 class="font-display text-2xl text-eywa-bio-primary mb-4">Bases de grammaire</h2>
      <ul class="list-disc list-inside space-y-1">
        <li>Ordre des mots libre (déclinaisons portent le sens)</li>
        <li>Système de cas : sujet, objet direct, génitif, datif, etc.</li>
        <li>Pas d'article défini/indéfini</li>
        <li>Verbes infixés : marqueurs de temps/aspect glissés à l'intérieur du verbe (pas d'auxiliaires)</li>
      </ul>
    </section>

    <section>
      <h2 class="font-display text-2xl text-eywa-bio-primary mb-4">Lexique de base</h2>
      <table class="w-full text-base">
        <thead>
          <tr class="border-b border-eywa-text-muted/30">
            <th class="text-left font-display py-2 text-eywa-bio-primary">Na'vi</th>
            <th class="text-left font-display py-2 text-eywa-bio-primary">Français</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">kaltxì</td><td>bonjour</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">irayo</td><td>merci</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">oel ngati kameie</td><td>« je te vois »</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">tsaheylu</td><td>le lien (queue à queue)</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">eywa ngahu</td><td>« qu'Eywa soit avec toi »</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">tsmukan / tsmuke</td><td>frère / sœur</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">eveng</td><td>enfant</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">tsahìk</td><td>chamane spirituelle (féminin)</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">olo'eyktan</td><td>chef de clan</td></tr>
          <tr class="border-b border-eywa-text-muted/15"><td class="py-2">skxawng</td><td>idiot (insulte familière)</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2 class="font-display text-2xl text-eywa-bio-primary mb-4">Pour aller plus loin</h2>
      <ul class="list-disc list-inside space-y-1">
        <li><a href="https://naviteri.org" target="_blank" rel="noopener" class="text-eywa-bio-primary hover:underline">Naviteri.org</a> — blog officiel du Dr Paul Frommer (créateur de la langue)</li>
        <li><a href="https://learnnavi.org" target="_blank" rel="noopener" class="text-eywa-bio-primary hover:underline">LearnNavi.org</a> — communauté + dictionnaire de référence</li>
      </ul>
    </section>

    <p class="text-sm text-eywa-text-muted/70 mt-12 italic">
      Source : travaux du Dr Paul Frommer, communauté Naviteri.
    </p>
  </article>
</CodexLayout>
```

- [ ] **Step 9.3: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean. `/langue` renders the standalone page.

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add -A
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): langue Na'vi — standalone page (alphabet + grammaire + lexique de base)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Films — 3 entries

**Files:**
- Delete: `frontend/src/content/films/index.md`
- Create: `frontend/src/content/films/avatar-2009.md`
- Create: `frontend/src/content/films/voie-de-leau.md`
- Create: `frontend/src/content/films/fire-and-ash.md`

- [ ] **Step 10.1: Delete stub**

```bash
git rm frontend/src/content/films/index.md
```

- [ ] **Step 10.2: Create `avatar-2009.md`**

```markdown
---
title: "Avatar (2009)"
summary: "Le premier film. Pandora révélée. Box-office record du cinéma."
order: 1
cover: "Avatar 2009 film"
---

[Prose FR ~350-500 mots : sortie 2009, réalisé par James Cameron,
synopsis spoiler-friendly (Jake Sully bascule chez les Omatikaya,
combat la RDA, devient Toruk Makto, transition définitive au
corps Na'vi), production technique (motion capture, 3D), impact
cinéma (record absolu de box-office, jusqu'à Endgame), durée
161 min.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 10.3: Create `voie-de-leau.md`**

```markdown
---
title: "Avatar : La Voie de l'Eau (2022)"
summary: "13 ans après. Les Sully exilés chez les Metkayina. Découverte des tulkun."
order: 2
cover: "Avatar Way of Water"
---

[Prose FR ~400-500 mots : sortie déc 2022, durée 192 min,
synopsis (Jake et Neytiri quittent la forêt avec leurs enfants
fuyant le Quaritch recombinant, accueil tendu chez les Metkayina,
arc de Lo'ak avec Payakan le tulkun paria, mort de Neteyam,
combat final aquatique). Production en mocap aquatique inédite.
Préquel à Fire & Ash.]

> Source : Pandorapedia + Avatar Wiki Fandom
```

- [ ] **Step 10.4: Create `fire-and-ash.md`**

```markdown
---
title: "Avatar : Fire and Ash (2025)"
summary: "Troisième volet. Les Ash People entrent en jeu. Le ton change."
order: 3
cover: "Avatar Fire and Ash"
---

[Prose FR ~300-400 mots : sortie déc 2025, durée annoncée
~190 min, synopsis (introduction des Ash People comme nouvel
antagoniste Na'vi rompant la cohésion inter-clans Eywa, le
volcan Mangkwan, la cheffe Varang, retour de la pression
militaire RDA en parallèle). Premier film de la trilogie
à montrer un conflit Na'vi-Na'vi. Confirmé sorti — ajuster
la prose après vérification de la date d'écriture.]

> Source : Avatar Wiki Fandom + presse spécialisée
```

- [ ] **Step 10.5: Build verify + commit**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build

cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/content/films/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(content): films — Avatar 2009, Voie de l'Eau 2022, Fire and Ash 2025

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Entry pages render the cover image

**Files:** Modify each `frontend/src/pages/<section>/[...slug].astro` (6 files: pandora, clans, bestiaire, flore, personnages, films) to render the cover at the top of the entry.

The dynamic route currently shows `title + summary + Content`. Add a hero image (cover) above the title.

- [ ] **Step 11.1: Update `frontend/src/pages/pandora/[...slug].astro` template**

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

let coverSrc: string | undefined;
if (entry.data.cover) {
  coverSrc = entry.data.cover.startsWith('http')
    ? entry.data.cover
    : `/api/wiki-image?q=${encodeURIComponent(entry.data.cover)}`;
}
---
<CodexLayout title={`${entry.data.title} — Eywa`} current="pandora">
  <article class="prose prose-invert max-w-none">
    {coverSrc && (
      <div class="aspect-[16/7] rounded overflow-hidden mb-10 border border-eywa-text-muted/20">
        <img src={coverSrc} alt={entry.data.title}
             class="w-full h-full object-cover"
             onerror="this.parentElement.style.display='none'" />
      </div>
    )}
    <h1 class="font-display text-4xl text-eywa-bio-primary mb-3">{entry.data.title}</h1>
    <p class="text-eywa-text-muted text-lg italic mb-10">{entry.data.summary}</p>
    <div class="text-eywa-text leading-relaxed font-body text-lg">
      <Content />
    </div>
    <nav class="mt-16 pt-8 border-t border-eywa-text-muted/20">
      <a href="/pandora" class="text-eywa-text-muted hover:text-eywa-bio-primary transition">
        ← retour à Pandora
      </a>
    </nav>
  </article>
</CodexLayout>
```

- [ ] **Step 11.2: Apply the same shape to the 5 other dynamic routes**

Repeat the cover-resolution + hero image + back-link block for `clans`, `bestiaire`, `flore`, `personnages`, `films`. Change `getCollection('pandora')` and `current="pandora"` and the back-link `/pandora` to the matching section name.

- [ ] **Step 11.3: Build verify**

```bash
nvm use 22
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora/frontend
npm run build
```

Expected: clean. ~30 entry pages built.

- [ ] **Step 11.4: Commit**

```bash
cd /home/sylvain_ladoire/projects/developpeur/avatar-pandora
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" add frontend/src/pages/
git -c user.name="Sylvain Ladoire" -c user.email="sylvain.ladoire@gmail.com" commit -m "feat(codex): hero cover image on every entry page (via /api/wiki-image proxy)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Deploy + visual eyeball

**Files:** None (ops only).

- [ ] **Step 12.1: Sync + build on NAS**

```bash
rsync --rsync-path=/usr/bin/rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .astro --exclude .git \
  /home/sylvain_ladoire/projects/developpeur/avatar-pandora/ \
  nas:/volume2/docker/developpeur/avatar-pandora/

ssh nas "docker compose -f /volume2/docker/developpeur/avatar-pandora/docker-compose.yml up -d --build eywa-frontend"
```

- [ ] **Step 12.2: Verify all section indexes + a sample entry per section**

```bash
for path in pandora clans bestiaire flore personnages langue films; do
  echo "=== /$path ==="
  curl -s -w "HTTP %{http_code}\n" -o /dev/null "http://nas:4203/$path"
done

# Sample one entry per multi-entry section
curl -sI "http://nas:4203/pandora/biomes" | head -1
curl -sI "http://nas:4203/clans/omatikaya" | head -1
curl -sI "http://nas:4203/bestiaire/ikran" | head -1
curl -sI "http://nas:4203/flore/hometree" | head -1
curl -sI "http://nas:4203/personnages/jake-sully" | head -1
curl -sI "http://nas:4203/films/avatar-2009" | head -1

# Wiki-image proxy still works
curl -sI "http://nas:4203/api/wiki-image?q=Neytiri" | head -3
```

Expected: HTTP 200 for all section indexes, all sample entries, and the wiki-image proxy.

- [ ] **Step 12.3: User eyeball pass**

Open `http://nas:4203/` in a real browser:
1. Cinema landing still wahou.
2. Click "Explorer le codex" → lands on `/pandora` index → 4 cards visible (intro + biomes + sites sacrés + atmosphère), each with a wiki cover.
3. Click a card → entry page renders with hero cover + title + prose + back-link.
4. Sidebar navigation between sections works on every page.
5. `/langue` shows the standalone alphabet+lexique page.
6. About page still rendered.

- [ ] **Step 12.4: Push GitHub**

```bash
git push origin main
```

---

## Definition of done — V3

- [ ] http://nas:4203/pandora, /clans, /bestiaire, /flore, /personnages, /langue, /films all render with their content
- [ ] All ~28 entry pages render (4 pandora + 4 clans + 5 bestiaire + 4 flore + 5 personnages + 3 films + langue standalone)
- [ ] Each entry has a hero cover image fetched via /api/wiki-image
- [ ] Sidebar nav from every page back to any section
- [ ] No build errors, no console errors
- [ ] All commits pushed to Sylad/avatar-pandora

## Out of scope (deferred / nice-to-have)

- Search across the codex (Algolia / Pagefind) — Plan 4
- Audio Na'vi pronunciation — Plan 4
- Per-clan glossary embed — Plan 4
- Expand each section beyond 3-5 entries (lots more clans, creatures, etc.) — Plan 4
- Quiz "Quel clan Na'vi es-tu ?" — Plan 4
- Carte 3D interactive de Pandora — Plan 4

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wiki-image proxy returns 404 for some queries | EntryCard has `onerror="this.style.display='none'"` graceful fallback |
| Implementer hallucinates plot details from films | Each task instructs "consult Pandorapedia + Avatar Wiki — synthesize, don't invent". User-eyeball pass at Task 12 catches gross errors |
| Schema relaxation breaks existing intro.md | Step 1.1 explicitly verifies the change is backward compatible (cover stays optional) |
| Astro build fails on `pandora.astro` while `pandora/[...slug].astro` exists | Verified pattern — Astro routes filename-based, both coexist as sibling routes |
| Content gets stale (films release dates, etc.) | "Source : Pandorapedia + Avatar Wiki Fandom" footer signals the canonical reference; updates land via subsequent commits |
| Existing `intro.md` slug is `intro` — `/pandora/intro` works but `/pandora/biomes` is the new pattern | Both URLs work since the dynamic route catches all slugs. The card grid links to whatever slug each entry has. |

## Spec coverage

| Spec section | Implemented in |
|---|---|
| 7 codex sections populated | Tasks 4-10 |
| Sources : Pandorapedia + Avatar Wiki + Frommer + Claude synthèse | Each task's frontmatter + footer |
| Image strategy : /api/wiki-image proxy | Tasks 1, 11 |
| Sidebar 320px sticky (Plan 1) | Untouched, reused |
| Responsive grid for entry cards | Task 1 (EntryCard) + Task 2 (`md:grid-cols-2`) |
| Pas de re-host de stills films Disney/Cameron | Wiki-image proxy serves Wikipedia/Wikimedia originals — they handle their own licensing, we just stream |
