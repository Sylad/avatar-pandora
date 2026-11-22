# Eywa (Avatar Pandora) — guide Claude Code

Codex Avatar/Pandora **cadeau pour Eva** (nièce de Sylvain, 18 ans, fan absolue d'Avatar). Le nom du site est **Eywa** (déesse-réseau de Pandora) — clin d'œil à Eva (E_W_A vs E_V_A, une lettre d'écart). Astro statique pur, déployé sur **Cloudflare Pages**.

## Architecture

| | |
|---|---|
| Stack | Astro 5/6 + îlots React 19 + @react-three/fiber + GSAP + Tailwind |
| Contenu | Markdown/MDX via Astro Content Collections |
| Backend | Aucun — le backend NestJS (qui ne servait plus que `/api/health` après le retrait du proxy images Fandom) est supprimé depuis le 01-10-2026 |
| Cible publique | Cloudflare Pages (`https://avatar-pandora-12q.pages.dev`) — 100 % statique, plus de Function |
| Hébergement | Cloudflare Pages uniquement. Jusqu'au 01-10-2026, une copie tournait sur le NAS (Docker/nginx) ; elle est supprimée (le NAS ne sert plus que de médias et sauvegardes) |

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

Lumière au toucher (L32) : `components/BioMoss.astro` (accueil + codex) — taches de mousse en éléments animés par Web Animations
(transform/opacity, pas de canvas : un canvas 2D bloquait la page ~85 s en Chromium sans tête), arrêtées par la pause, absentes en
mouvement réduit. Le calque couvre le document, AU-DESSUS du fond des cartes, et chaque tache porte un masque (`shieldMask`,
`mask-mode: luminance`) qui l'efface sous chaque ligne de texte, image, contrôle et sous la bande du menu ≥ 1024 px : jamais rien de
lisible sur la mousse (revue UX L32, le menu tombait à 1,91:1). Bord du masque en fondu doux de 12 px (D-6 : 8 couronnes en `opacity` de
groupe, pas de flou SVG, trop lent) ; une ligne de texte couvre tout son interligne. Une capture « pleine page » se fait fenêtre
agrandie à la hauteur du document : sinon le canvas fixe des particules et le menu collant s'arrêtent à 900 px (faux « pavé »). Toucher = allumé au lever du doigt, sans glissement. Contrôlé par
`scripts/bio-moss.e2e.test.mjs` (contraste au pire pixel avec et sans mousse, menu compris ; visibilité autour du doigt à 390 px).

Cartes qui s'éveillent (L33) : `components/EntryCard.astro` — au repos l'image dort (brightness 0,55), éveil par `:hover`, `:focus-visible` et `.is-awake` (posée au `pointerdown` tactile, une carte à la fois, rendormie 1,4 s après le lever du
doigt, sans intercepter la navigation) : liseré qui pulse, image éclairée, spores en CSS tirées au build d'une graine (l'adresse). Le texte
ne change pas de contraste. Un seul sélecteur d'éveil `:is(:focus-visible, .is-awake, :hover:not(.is-touched))` : le script pose
`.is-touched` sur la carte touchée (survol collé des écrans tactiles), une vraie souris l'ôte. Le pouls du liseré est un fondu
enchaîné de deux calques de lueur (`::before`, `::after`) en `opacity` seule — jamais animer `box-shadow` (revue L33). Mouvement
réduit : rien ne bouge, spores posées ; pause de l'ambiance : tout se fige.
Contrôlé par `scripts/entry-card-awake.e2e.test.mjs`.

Ikrans dans le ciel (L34) : `components/IkranSky.astro`, posé par `SectionHero` avec `ikrans` (Pandora et Bestiaire seulement) —
silhouettes SVG (4 ailes, longue queue ; jamais un dragon européen) qui traversent le bandeau toutes les 7 à 16 s, un toucher bref
ou un clic sur le bandeau en appelle un (un glissement non ; suivi du doigt commun avec la mousse, `tapTracker` de
`lib/bio-moss.ts`). Calque entre l'image et le voile, sous le texte, `pointer-events: none`, fondu d'entrée et de sortie calé sur la
position (1,3 taille d'ikran, `FLIGHT_FADE_SIZES`, jamais une part fixe du trajet : au téléphone l'ikran était presque opaque à moitié
hors du cadre) ; au grand écran la bande de vol reste au-dessus du texte (au téléphone, derrière lui). Web Animations en
transform/opacity ; battement asymétrique (abattée rapide, relevée repliée, ailes arrière en retard, montée et descente d'amplitude
douces vers le plané), logique pure et mesures dans `lib/ikran.ts`. Pause : ikrans figés, aucun nouveau ; mouvement réduit : aucun.
Contrôlé par `scripts/ikran.test.mjs` et `scripts/ikran-sky.e2e.test.mjs`.
Ailes et queue sont des `<div>` (une couche HTML par partie), jamais des `<g>` SVG animés, et le calque n'a pas de masque : avec
l'un ou l'autre, sous la charge de la porte, les transitions des cartes du Bestiaire (test L33, 900 ms) n'avaient plus fini à temps.

Jour et nuit (L35) : l'ambiance suit l'heure LOCALE du visiteur (`lib/day-night.ts` : jour 8 h–17 h, la nuit tombe 17 h–22 h,
nuit noire 22 h–5 h, aube 5 h–8 h), ou le choix « Selon ton heure / Jour / Nuit » du rond `components/SkySwitch.astro` (à gauche de la
pause, gardé dans localStorage `eywa.sky-v1`). `skyBoot` (même fichier, AUTONOME : sérialisé par `String()` dans le `<head>` de
BaseLayout) pose avant la première image `data-sky-mode`, `data-sky-lit` et les variables `--sky-*` sur `<html>`, et se rejoue après
chaque navigation (le ClientRouter remplace les attributs de `<html>`). Formules du prototype du 10-10 : voile noir 0,66 n, teinte
bleu nuit, crépuscule, copie de l'image en lueur cyan (même travelling que l'image) et points bioluminescents (`SkySpots.astro`,
4 groupes qui palpitent en opacité, pas une animation par point) — dans le bandeau (`SectionHero`, sous le voile de lecture) et au pied
de l'accueil ; halos et pollen du fond à 60 % de jour. De jour, lueur et points ne sont pas composés (`visibility: hidden`). Pause :
tout se fige ; mouvement réduit : rien ne palpite, le réglage reste. Au téléphone, voile du bandeau renforcé (sur-titre et accroche
tombaient à 3,8:1 de jour). Contrôlé par `scripts/day-night.test.mjs` et `scripts/day-night.e2e.test.mjs` (heure simulée,
contraste au pire pixel de jour, au crépuscule et de nuit).

Pattern technique réutilisable : `CinemaCanvas` mode `'time'` + `CycleBackdrop` qui cross-fade les images sur le même clock. Voir `frontend/src/components/cinema/`.

## Pas de ChatGPT — silence complet

**Important** : Eywa n'utilise **PAS** ChatGPT. Logo SVG codé custom, visuels = fonds et illustrations hébergés sur le site (le proxy wiki Fandom a été retiré le 01-10-2026).

❌ Ne pas mentionner ChatGPT dans la page About / README / commits — **même pour le nier**. Confirmé 2026-05-03 + reconfirmé 2026-05-06 : *"je ne l'ai pas utilisé, pas besoin d'en parler"*. Crédits = humain + Claude Code uniquement.

## Sources de contenu

1. **Pandorapedia** (officiel Disney/Cameron) — référence canon.
2. **Avatar Wiki Fandom** (https://avatar.fandom.com) — exhaustif, source de TEXTE. Plus aucune image n'en vient : le proxy `/api/wiki-image` est retiré (01-10-2026, défi anti-robot que Sylvain refuse de contourner). Les images viennent des sources officielles des films (Pandorapedia, pages des films d'avatar.com, images fournies par Sylvain), tracées dans `scripts/illustrations/films.json` (cf. Fair-use ci-dessous, L64). Fiche sans illustration (aujourd'hui `bestiaire/glow-snake` et `pandora/moara-valley` seulement) → visuel par défaut `CoverFallback` (`src/lib/cover.ts`).
3. **Paul Frommer** — linguiste Na'vi, source pour la page Langue Na'vi.
4. **Synthèse Claude en français** pour les ~70 entrées lyriques du codex.

## Fair-use / publication publique

- ✅ **Toutes les fiches en images officielles des films** (L64, D-4, décision de Sylvain du 20-11-2026 : « faut revoir TOUTES les pages », portraits officiels pour tous les personnages, **humains compris** — fin de la règle L17 « jamais un visage d'acteur »). Chaque fiche montre son sujet nommé tel qu'il est dans les films : image de Pandorapedia (avatar.com, `lumiere-a.akamaihd.net`) ou plan officiel publié sur la page du film (`avatar.com/movies/…`), avec le crédit discret « © 20th Century Studios » en légende de chaque image (`coverCredit`, repris par la visionneuse), sous chaque liste de section (`components/SectionCredit.astro`) et dans À propos. Source exacte et réglage de chaque image dans `scripts/illustrations/films.json` (types `pandorapedia`, `film`, `sylvain` ; `fond_blanc`/`trous`/`serrer` détourent les images sur fond blanc) ; `films.py <dossier-refs>` refait les WebP et le front matter (et pose `pandorapedia:`), et réécrit l'empreinte `sha256` de chaque WebP dans `films.json` ; R13 la compare aux fichiers servis (un WebP remplacé à la main échoue). Images sources hors du dépôt (`~/projects/developpeur/tmp/l63-refs/`, `_l64/`, `_l64-films/`). Exclues : images du jeu Frontiers of Pandora, photos du parc Disney. Les modèles 3D sur grille refusés par Sylvain le 20-11 (akula, nantang, hexapede) restent tracés avec `"retenue": false`.
- ✅ **Ambiances générées gardées** (L17, SDXL base 1.0, licence CreativeML Open RAIL++-M, `scripts/illustrations/generer.py` + `preparer.py`, `illustrations.json`) : seulement `pandora/atmosphere`, `pandora/bioluminescent-night`, `clans/anurai`, `clans/tipani` (pas de sujet précis des films, ni page Pandorapedia pour ces deux clans). Les 49 autres entrées sont `"branchee": false` avec `remplacee`. **Sans image** (`CoverFallback`), faute d'image officielle sûre : `bestiaire/glow-snake`, `pandora/moara-valley` — mieux vaut pas d'image qu'une image fausse. `scripts/illustrations.test.mjs` (R9, R13) tient ces deux listes.
- ✅ Images des films permises **seulement avec le crédit discret**, et toutes les pages restent en `<meta name="robots" content="noindex, nofollow">` (`scripts/robots-noindex.test.mjs`).
- ❌ **Jamais** de fan-art (œuvre signée d'un particulier), d'image d'Avatar Wiki Fandom ou de Pinterest, ni d'image générée d'une créature, d'un personnage ou d'un sujet nommé des films (les entrées remplacées restent dans `illustrations.json` avec `"branchee": false`, jamais rebranchées). Rien de nu ni de violent. `scripts/illustrations.test.mjs` refuse une image sans source officielle tracée et sans crédit, hors des quatre ambiances. Aucune fiche « Na'vi » générale.
- ✅ Repo public-ready (LICENSE MIT/CC). Auto-deploy Cloudflare Pages sur `git push origin main`.

## Codex (7 sections)

`Pandora` (8 entrées) · `Clans Na'vi` (7) · `Bestiaire` (14) · `Flore` (5) · `Personnages` (24) · `Films` (3) · `Engins` (8) · `Langue Na'vi` (standalone). ~70 entrées, 78 pages buildées.

Sidebar 320px sticky pattern warhammer (lore court, liens rapides, ressources externes).

## Workflow dev

Dev local : `cd frontend && source ~/.nvm/nvm.sh && nvm use && npm run dev` (Node ≥ 22.23.4, 22.23.5 épinglé dans `.nvmrc`, que `nvm use` lit). Cloudflare Pages construit et publie lui-même à chaque `git push origin main` (~2 min) ; la livraison se fait par `cadence deliver` (config dans `cadence.yaml`), qui vérifie que la page d'accueil porte le sha poussé.

## Tests

`cd frontend && npm run build` (82 pages, dont `404.html`) valide la cohérence (Content Collections + schéma Zod, types, intégrations Astro).
Puis `npm run test:scripts` (`node --test ../scripts/*.test.mjs`, Node ≥ 22.18 : les tests importent les
modules `.ts` tels quels — `export PATH=$HOME/.nvm/versions/node/v22.23.5/bin:$PATH` ; Astro 7 refuse de démarrer avant Node 22.23.4, `.nvmrc` épingle 22.23.5 ; les scripts `dev`, `build`, `preview` et `astro`
passent par `scripts/lib/astro-node.mjs`, qui relance Astro avec le Node de `.nvmrc` (nvm) quand celui du PATH est trop ancien,
comme dans la porte des vagues) : données des
Nouveautés et du Plan de travail, et tests navigateur sur le site **construit** (`frontend/dist`, lancer le
build avant) — pages Nouveautés et Plan de travail (dont l'absence de tout texte privé du plan dans `dist/`),
tiroir du téléphone (y compris après une navigation ClientRouter), contraste au pire pixel. Sans `frontend/dist`,
`test:scripts` s'arrête d'emblée (`pretest:scripts` → `scripts/lib/require-dist.mjs`) : le 17-11, la porte avait tourné
sans lui, 158 échecs trompeurs sur 246. Les fichiers de test
tournent `CADENCE_TEST_WORKERS` à la fois (`--test-concurrency`, 4 sans la variable) : chacun lance son Chromium,
et tous en parallèle sur les 32 cœurs, un test navigateur dépassait son délai sous la charge. Chromium via
`playwright-core` (devDependency) ; les tests navigateur passent en « skip » s'il manque.
`playwright-core` est épinglé à la version dont la révision Chromium est installée dans `~/.cache/ms-playwright`
(1.65.1 → `chromium_headless_shell-1255`) : jusqu'au 17-11-2026, la 1.63.0 cherchait la révision 1243, absente,
et 156 tests sur 242 passaient en « skip » sans que la suite échoue — compter les `# skipped` après une montée.
Astro 7 (L59, 17-11-2026) embarque Vite 8 : l'ancien `overrides.vite` (qui forçait Vite 7 sous Astro 6) est retiré.
`compressHTML: true` dans `astro.config.mjs` garde les espaces entre éléments en ligne (défaut `'jsx'` d'Astro 7 :
le texte des 81 pages changeait). Le minifieur CSS de Vite 8 fusionne `transform` et `translate` d'une même règle en
un seul `transform` : ne pas les poser ensemble quand `translate` doit annuler un utilitaire Tailwind 4 (tiroir de la Sidebar).
`EYWA_E2E_SHOTS=<dossier>` enregistre des captures de /nouveautes/ à 1440, 390 et 320 px.

⚠ ClientRouter : un script `is:inline` identique sur toutes les pages ne s'exécute qu'au premier
chargement, alors que le DOM est remplacé à chaque navigation. Poser les écouteurs une seule fois
sur `document` et retrouver les éléments à chaque événement (cf. tiroir de CodexLayout, Lightbox).

## Pas de deadline

Qualité avant tout. Spec validée : `docs/superpowers/specs/2026-05-02-avatar-pandora-design.md`.

## Plan, sessions et revue UX (cadence)

Le reste à faire vit dans `.cadence/raf.yaml`, tenu par `raf`
([cadence](https://github.com/Sylad/cadence)) : chaque commit cite son lot dans le
message (`fix(L4): …`, `L2/t1`), `raf now` dit la suite, `raf check` repère les
écarts. Début et fin de session : skills `/cadence:session-start` et
`/cadence:session-close`.

**Porte de tests des vagues** (`orchestrate` de `cadence.yaml`, L38) : `build` = `cd frontend && npm run build`,
`test` = `cd frontend && npm run build && npm run test:scripts` (les tests navigateur lisent `frontend/dist`).
Il n'y a pas d'autre suite que le `node --test` des scripts. `precheck: true`.

**Revue UX obligatoire** (règle de Sylvain du 2026-09-28, tous les projets perso) : toute nouvelle
page ou modification d'écran est un lot `--visible`, revu par l'agent `cadence:ux-reviewer` (captures
1440 et 390 px, écarts fondés sur une règle nommée ou une mesure) avant `raf done`. Le verdict
s'enregistre avec `raf ux <lot> "…"`, sinon `raf done` refuse. Les lots « Revue UX — … » planifient
la revue de chaque écran existant ; les écarts trouvés deviennent des sous-tâches du lot.

**Nouveautés** (page `/nouveautes/`, L14, signature commune des apps) : les entrées vivent dans
`docs/nouveautes/*.md` (captures dans `docs/nouveautes/captures/`, jamais plus de 6× plus larges que
hautes ; guillemets « » tenus par une espace fine insécable U+202F). Après tout ajout ou modification
d'une entrée, lancer `cd frontend && npm run news` (= `cadence news build` vers
`frontend/public/nouveautes-data/`) et **commiter le résultat** : Cloudflare Pages construit sans
cadence, la page lit ce JSON au build. `npm run test:scripts` échoue si le JSON versionné n'est plus à jour.
Lien permanent `/nouveautes/#<slug>` par entrée : bouton visible « Copier le lien » dans la ligne de date
(le titre est du texte ; copier ne fait ni défiler ni changer l'adresse, retour dans le libellé à largeur
réservée ; `src/lib/news-anchor.ts` + script de `nouveautes.astro`) ; arrivée sur l'ancre = entrée signalée
et focalisée, sous le bouton menu. Pastille « non vues » sur TOUS les liens Nouveautés (un seul composant
`components/NewsBadge.astro` : menu, tiroir, accueil), nombre dans le nom du bouton menu au téléphone,
bandeau « N nouveautés depuis ta dernière visite », marque « Nouveau » et séparateur « Déjà vu lors de ta
visite du … » — HORS des listes (`role="separator"` nommé entre deux `<ol>`, WCAG 1.3.1), seulement si toutes
les nouvelles sont au-dessus. Un seul script dans `BaseLayout.astro` (index léger `#eywa-news-index`,
rejoué à chaque `astro:page-load`), logique pure `src/lib/news-seen.ts` : localStorage `eywa.news.seen-v1`
= tous les slugs vus (`all: true`) ; mémoire de base posée dès la première page vue ; l'ancien format de
L14 (sans `all`, déjà chez des visiteurs) reste lu — ne jamais changer la clé ni casser ce format.

**Navigation** (consigne de Sylvain) : Nouveautés ET Plan de travail sont proposés partout où le site a une
navigation — barre latérale / tiroir du codex (Plan de travail juste après Nouveautés) et accueil (seconde
rangée « Suivre le codex » sous les deux boutons, deux liens côte à côte jusqu'à 320 px, jamais seuls sur
leur ligne). Contrôlé par `scripts/navigation.e2e.test.mjs` : accueil sans défilement à 1440×900,
1366×768 et jusqu'à 320×568 ; les 12 liens de la barre latérale visibles à 1280×720 (marges resserrées
sous 820 px de haut). La page À propos, sans menu, porte la même rangée avec un « ← Accueil » en tête
(`components/FollowLinks.astro`, partagé par l'accueil et À propos). Au téléphone, le bouton de pause de
l'ambiance est en haut à droite de l'accueil (en bas, il recouvrait « Plan de travail » à 320×568) ; un
texte agrandi (×1,25, espacement WCAG 1.4.12) fait passer un libellé à la ligne dans son lien, jamais
déborder la rangée.

**Plan de travail** (page `/plan-de-travail/`, L20, modèle evatosorus/finance-tracker) : en cours, prévu,
récemment livré, rendue **au build** depuis `.cadence/raf.yaml` (`src/lib/plan-public.ts`, lu depuis
`frontend/` : `../.cadence/raf.yaml`, vrai aussi sur Cloudflare Pages dont la commande est
`cd frontend && …`). `raf.yaml` absent ou sans `lots` = build en échec. Ne sont publiés que les lots
`visible: true`, non abandonnés, qui ont un **titre public** : champ `public:` du lot, sinon titre de la
Nouveauté la plus récente qui le cite ; les lots « Revue … » exigent un `public:` ; sinon masqués. Liste
blanche : id (en `data-id` seulement), titre public, état, date de livraison, étapes faites/total
(abandonnées exclues). Jamais notes, verdicts UX, raisons, titres bruts ni titres d'étapes —
`scripts/plan-page.e2e.test.mjs` le vérifie sur tout `dist/`. Un `public:` non conforme (> 80 caractères,
« / », fichier, identifiant de lot, nom de technique, sujet de sécurité) fait échouer le build : écrire
`public:` en français pour le lecteur. Dates par le formateur unique `src/lib/format-date.mjs`
(« 1er octobre 2026 »), rendues dans les pages par `components/FrDate.astro` (ordinal en exposant, qui
garde sa casse dans les lignes en capitales). En-tête commun aux deux pages méta : `components/MetaHeader.astro`.
