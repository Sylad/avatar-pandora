// L70 — coupures des titres du codex (frontend/src/lib/title-breaks.ts). Revue UX de L70 : titres en rem, césure
// française ; les mots que le dictionnaire de Chromium ne coupe pas (syllabe muette finale, noms na'vi) se cassaient
// lettre à lettre à 390 px texte 200 %. Attendu : les coupures de la division syllabique française, entre deux
// lettres, jamais entre deux voyelles ni contre une apostrophe.
// L72 (revue UX r2 de L70, m3) : au moins 3 lettres de chaque côté (« di- », « in- », « en-tre » refusés), table
// d'exceptions pour les mots anglais et les noms na'vi (« dire-horse », pas « di-re-horse » ; « gun-ship », pas
// « guns-hip » ; « Tskaha » jamais coupé ; L74 : « Rongloa » et les noms de personnes jamais coupés). Repli à 2 lettres avant, pour les seuls titres de bandeau et
// les seuls mots sans autre coupure (« ré-seaux ») : sans lui, ces mots cassaient sans trait à 320–1024 px (L71).
// Tests de L70 mis à jour en conséquence (« Ar-bres », « ré-seaux », « sa-crées » seulement en repli ; « Wood-sprites »,
// « héli-cop-tè-res », « Recom-bi-nants », « Atmos-phère »).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { EN_EXCEPTIONS, EXCEPTIONS, addressParts, frenchSpaces, MIN_AFTER, MIN_BEFORE, SOFT_HYPHEN, syllableBreaks, titleBreaks, titleSegments } from '../frontend/src/lib/title-breaks.ts';

const show = (s) => s.replaceAll(SOFT_HYPHEN, '-');
const HERO = { fallbackBefore: 2 };

test('mots que Chromium ne coupe pas : coupés à leurs syllabes', () => {
  assert.equal(show(titleBreaks('Trois œuvres, vingt-cinq ans de Pandora')), 'Trois œu-vres, vingt-cinq ans de Pan-dora');
  assert.equal(show(titleBreaks('Les peuples')), 'Les peu-ples');
  assert.equal(show(titleBreaks('Arbres, réseaux et plantes sacrées')), 'Arbres, réseaux et plan-tes sacrées');
  assert.equal(show(titleBreaks('Arbres, réseaux et plantes sacrées', HERO)), 'Ar-bres, ré-seaux et plan-tes sa-crées');
  assert.equal(show(titleBreaks('jungle')), 'jun-gle');
  assert.equal(show(titleBreaks("Ateyo'itan")), "Ateyo'itan"); // L74 : nom de personne, jamais coupé
});

test('digraphes et groupes inséparables', () => {
  assert.equal(show(titleBreaks('technologie')), 'tech-no-lo-gie');
  assert.equal(show(titleBreaks('hélicoptères')), 'héli-cop-tè-res');
  assert.equal(show(titleBreaks('aquatique')), 'aqua-ti-que');
  assert.equal(show(titleBreaks('Recombinants')), 'Recom-bi-nants');
  assert.equal(show(titleBreaks('Montagnes')), 'Mon-ta-gnes');
  assert.equal(show(titleBreaks('Atmosphère')), 'Atmos-phère');
});

test('rien entre deux voyelles, contre une apostrophe, ni avec moins de 3 lettres d’un côté', () => {
  assert.equal(show(titleBreaks('bioluminescente')), 'bio-lu-mi-nes-cente'); // « io » reste entier, « te » trop court
  assert.equal(titleBreaks('Eywa'), 'Eywa');
  assert.equal(show(titleBreaks("d'Omatikaya")), "d'Oma-ti-kaya");
  assert.deepEqual(syllableBreaks("Ateyo'a"), []);
  assert.equal(titleBreaks('Avatar'), 'Ava­tar');
  assert.equal(titleBreaks('Metkayina'), 'Met­kayina');
  // Revue UX r2 de L70 : 2 lettres en fin de ligne.
  for (const word of ['didactique', 'entre', 'marin', 'dirigeable', 'interstellaire', 'hélicoptère', 'Tipani', 'Neteyam']) {
    for (const at of syllableBreaks(word)) assert.ok(at >= 3 && word.length - at >= 3, `${word} coupé à ${at}`);
  }
  assert.equal(show(titleBreaks('didactique')), 'didac-ti-que');
  assert.equal(titleBreaks('entre'), 'entre');
});

test('L72 — exceptions : mots anglais à leurs vraies frontières, noms na’vi à leurs digraphes', () => {
  assert.equal(show(titleBreaks('Pa’li — le direhorse')), 'Pa’li — le dire-horse');
  assert.equal(show(titleBreaks("Woodsprites (Atokirina')")), "Wood-sprites (Ato-ki-rina')");
  assert.equal(show(titleBreaks('AT-99 Scorpion — le gunship')), 'AT-99 Scor-pion — le gun-ship');
  assert.equal(show(titleBreaks('Ikran — le banshee de montagne')), 'Ikran — le ban-shee de mon-ta-gne');
  assert.equal(show(titleBreaks('Hometree (Kelutral)')), 'Home-tree (Kelu-tral)');
  assert.equal(show(titleBreaks('Unobtainium')), 'Unob-tain-ium');
  assert.equal(show(titleBreaks('Samson SA-2 — le tiltrotor')), 'Sam-son SA-2 — le tilt-ro-tor');
  assert.equal(show(titleBreaks('le vaisseau interstellaire')), 'le vais-seau inter-stel-laire');
  assert.equal(show(titleBreaks("Tsu'tey te Rongloa Ateyo'itan")), "Tsu'tey te Rongloa Ateyo'itan");
  assert.equal(show(titleBreaks('Angtsìk')), 'Ang-tsìk');
  assert.equal(show(titleBreaks('Tsahìk')), 'Tsa-hìk'); // « ì » est une voyelle
  assert.equal(titleBreaks("Neytiri te Tskaha Mo'at'ite"), "Neytiri te Tskaha Mo'at'ite");
  // La règle des 3 lettres vaut aussi pour la table, et ses clés sont en minuscules.
  for (const [key, value] of Object.entries(EXCEPTIONS)) {
    assert.equal(key, key.toLowerCase());
    assert.equal(value.replaceAll('-', ''), key, `${key} : ${value}`);
    for (const part of [value.split('-')[0], value.split('-').at(-1)]) {
      if (value.includes('-')) assert.ok([...part].length >= 3, `${key} : « ${part} » trop court`);
    }
  }
});

test('L72 — repli à 2 lettres : seulement pour un mot sans autre coupure, et jamais 1 lettre ni moins de 3 après', () => {
  assert.equal(show(titleBreaks('La technologie humaine', HERO)), 'La tech-no-lo-gie hu-maine');
  assert.equal(show(titleBreaks('Les peuples de Pandora', HERO)), 'Les peu-ples de Pan-dora');
  assert.equal(show(titleBreaks('didactique', HERO)), 'didac-ti-que'); // a une coupure à 3 lettres : pas de « di- »
  assert.deepEqual(syllableBreaks('entre', HERO), []); // 5 lettres : tient toujours, pas de repli « en-tre »
  assert.equal(show(titleBreaks('arbres', HERO)), 'ar-bres');
  assert.equal(titleBreaks('écran', HERO), 'écran'); // « é-cran » : 1 lettre
});

// Tous les titres réellement coupés : ceux des fiches (cartes) et des bandeaux de section.
const CONTENT = new URL('../frontend/src/content/', import.meta.url);
const PAGES = new URL('../frontend/src/pages/', import.meta.url);
const cardTitles = ['bestiaire', 'clans', 'engins', 'films', 'flore', 'pandora', 'personnages'].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, CONTENT)).map((f) => readFileSync(new URL(`${dir}/${f}`, CONTENT), 'utf8').match(/^title:\s*"(.*)"\s*$/m)?.[1]).filter(Boolean));
const heroTitles = readdirSync(PAGES).filter((f) => f.endsWith('.astro')).map((f) => readFileSync(new URL(f, PAGES), 'utf8'))
  .filter((src) => src.includes('<SectionHero')).map((src) => src.match(/<SectionHero[\s\S]*?\stitle="([^"]+)"/)?.[1]).filter(Boolean);

test('L72 — titres du site : 3 lettres de chaque côté de chaque coupure (repli à 2 avant, bandeaux seulement)', () => {
  assert.ok(cardTitles.length >= 60 && heroTitles.length >= 7, `${cardTitles.length} cartes, ${heroTitles.length} bandeaux`);
  const letters = (s) => [...s.replace(/^(?:qu|\p{L}{1,2})['’]/iu, '')].reduce((n, c) => n + ("'’".includes(c) ? 0 : /[œæ]/i.test(c) ? 2 : 1), 0);
  const bad = [];
  for (const [titles, minBefore] of [[cardTitles, MIN_BEFORE], [heroTitles, 2]]) {
    for (const title of titles) {
      const broken = titleBreaks(title, minBefore === 2 ? HERO : {});
      for (const word of broken.split(/[^\p{L}'’­]+/u)) {
        const parts = word.split(SOFT_HYPHEN);
        if (parts.length < 2) continue;
        if (letters(parts[0]) < minBefore || [...parts.at(-1)].filter((c) => !"'’".includes(c)).length < MIN_AFTER) bad.push(show(word));
        // Repli : un mot qui a une coupure à 3 lettres n'en a jamais à 2.
        if (minBefore === 2 && letters(parts[0]) < MIN_BEFORE && syllableBreaks(word.replaceAll(SOFT_HYPHEN, '')).length) bad.push(show(word));
      }
    }
  }
  assert.deepEqual(bad, []);
});

// L73 (revue UX de L72, m2) : noms de personnes jamais coupés (« Qua-ritch » se lisait contre la prononciation).
test('L73 — noms de personnes des fiches : jamais coupés', () => {
  for (const name of ['Miles Quaritch', 'Norm Spellman', 'Trudy Chacon']) assert.equal(titleBreaks(name).includes(SOFT_HYPHEN), false, name);
  // L74 : tous les noms de personnes des titres et intertitres des fiches (« Par-ker Self-ridge » jusqu'à L73).
  for (const name of ['Parker Selfridge', 'Neytiri', 'Tonowari', 'Tsireya', 'Payakan', 'Eytukan', 'Grace Augustine', 'Miles « Spider » Socorro',
    "Ateyo'itan", 'Scoresby']) assert.equal(titleBreaks(name).includes(SOFT_HYPHEN), false, name);
});

// L73 (revue UX de L72, m1 ; /langue/) : chaque mot qui porte une coupure est une boîte qui passe entière à la ligne.
const seg = (title, options) => titleSegments(title, options).map((s) => (s.word ? `[${show(s.text)}]` : show(s.text))).join('');

test('L73 — titleSegments : mots coupables en boîte, ponctuation comprise, composé séparé après son trait d’union', () => {
  assert.equal(seg("La langue Na'vi", HERO), "La [lan-gue] Na'vi");
  assert.equal(seg('Trois œuvres, vingt-cinq ans de Pandora'), 'Trois [œu-vres,] vingt-cinq ans de [Pan-dora]');
  assert.equal(seg('Lexique de base'), '[Lexi-que] de base');
  assert.equal(seg('Cette page n’existe pas'), 'Cette page n’existe pas'); // aucun mot coupable : aucune boîte
  // Le texte rendu est le titre, aux seuls U+00AD près.
  for (const title of ["Tsu'tey te Rongloa Ateyo'itan", 'Les arbres-réseaux et plantes sacrées', 'Miles « Spider » Socorro']) {
    assert.equal(titleSegments(title, HERO).map((s) => s.text).join('').replaceAll(SOFT_HYPHEN, ''), title);
  }
});

// Revue UX r1 de L73, m1 : hors boîte, « plantes » et « sacrées » se coupaient alors qu'ils tenaient sur la ligne.
test('L73 — bandeaux : tout mot coupable en boîte, repli à 2 lettres compris', () => {
  assert.equal(seg('Les arbres-réseaux et plantes sacrées', HERO), 'Les [ar-bres-][ré-seaux] et [plan-tes] [sa-crées]');
  assert.equal(seg('La technologie humaine', HERO), 'La [tech-no-lo-gie] [hu-maine]');
  assert.equal(seg('Les peuples de Pandora', HERO), 'Les [peu-ples] de [Pan-dora]');
});

// Revue UX r1 de L73, m2 : titres anglais de /videos/ coupés à la française (« Unders-tands », « Filmma-kers »).
test('L73 — titres anglais : coupés à la seule table anglaise, jamais à la division française', () => {
  const en = { lang: 'en' };
  assert.equal(show(titleBreaks("James Cameron Understands What Most Filmmakers Don't", en)), "James Cam-eron Under-stands What Most Film-mak-ers Don't");
  assert.equal(show(titleBreaks("The Pandora Encyclopaedia: 60 Minutes of Na'vi Lore", en)), "The Pan-dora Encyclo-pae-dia: 60 Min-utes of Na'vi Lore");
  assert.equal(show(titleBreaks("The Biology of James Cameron's Avatar", en)), "The Biol-ogy of James Cam-eron's Ava-tar");
  assert.equal(show(titleBreaks('Paul Frommer (TEDxUSC)', en)), 'Paul Frommer (TEDx-USC)');
  assert.equal(show(titleBreaks('Sweet Nothings in Explainer', en)), 'Sweet Nothings in Explainer'); // hors table : jamais coupé
  assert.equal(show(titleBreaks('VFX Artists React to Weta Gunship', en)), 'VFX Artists React to Weta Gun-ship'); // composés de EXCEPTIONS
  for (const [word, cut] of Object.entries(EN_EXCEPTIONS)) {
    assert.equal(cut.replaceAll('-', ''), word, `${word} : table mal écrite`);
    assert.equal(show(titleBreaks(word, en)), cut, `${word} : coupure hors des 3 lettres de chaque côté`);
  }
  assert.equal(show(titleBreaks('Avatar — Le Plectroscope')), 'Ava-tar — Le Plec-tro-scope');
});

// Note de la revue UX r1 de L73 (/nouveautes/) : « : » rejeté seul en début de ligne.
test('L73 — espace insécable avant la ponctuation haute, sauf en anglais', () => {
  const text = (title, o) => titleSegments(title, o).map((s) => s.text).join('').replaceAll(SOFT_HYPHEN, '');
  assert.equal(text('Personnages : le bandeau'), 'Personnages\u00A0: le bandeau');
  assert.equal(text('Vraiment ? Oui ! Bon ; voilà'), 'Vraiment\u202F? Oui\u202F! Bon\u202F; voilà');
  assert.equal(seg('Personnages : le bandeau'), '[Per-son-na-ges\u00A0:] le [ban-deau]');
  assert.equal(text('Avatar: Fire and Ash', { lang: 'en' }), 'Avatar: Fire and Ash');
  assert.equal(frenchSpaces('Déjà insécable\u00A0: rien'), 'Déjà insécable\u00A0: rien');
});

// L74 (revue de L73) : la règle « adresse » écrite une seule fois, partagée par À propos et le test P1.
test('L74 — adresse : nom et domaine, sans trait ajouté', () => {
  assert.deepEqual(addressParts('refactoringui.com'), ['refactoringui', '.com']);
  assert.deepEqual(addressParts('avatar.fandom.com'), ['avatar.fandom', '.com']);
  assert.equal(addressParts('Pandorapedia'), null);
  assert.equal(addressParts('Refactoring UI'), null);
  assert.equal(addressParts('refactoringui.com (nouvel onglet)'), null);
  // L78 : mots du nom, points de passage à la ligne de plus, sans trait ; ignorés s'ils ne recomposent pas le nom.
  assert.deepEqual(addressParts('refactoringui.com', ['refactoring', 'ui']), ['refactoring', 'ui', '.com']);
  assert.deepEqual(addressParts('refactoringui.com', ['refactor', 'ui']), ['refactoringui', '.com']);
  assert.deepEqual(addressParts('refactoringui.com', ['refactoringui']), ['refactoringui', '.com']);
});
