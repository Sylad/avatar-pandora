# Eywa — ambiance audio

Placeholder pour le clip ambiance lu par `<AmbientAudio />` (forêt nocturne de Pandora).

## TODO sourcer un freesound CC0

Le composant attend `eywa-ambient.mp3` à la racine de ce dossier. Tant que le
fichier n'est pas en place, le bouton speaker apparaît mais le clic déclenche
un échec silencieux côté `<audio>` (404 sur le `src` → `play()` rejette → on
retombe sur l'état muet, aucune erreur visible).

### Critères

- Licence : **CC0** (ou Creative Commons 0 — vérifier la page Freesound)
- Durée : ≥ 30s, loopable proprement (pas de pic à la fin)
- Ambiance : nuit forêt tropicale humide / faune lointaine / cris d'animaux
  exotiques. Style "vidéo Avatar — Jake bivouaque dans la jungle Na'vi".
- Format : MP3 ou OGG, mono ou stéréo, bitrate 96-128 kbps
- Poids cible : < 1.5 MB (préload="none" déjà en place mais on évite le bourrage)

### Pistes Freesound suggérées

- https://freesound.org/search/?q=jungle+night&f=license:%22Creative+Commons+0%22
- https://freesound.org/search/?q=tropical+forest+ambient&f=license:%22Creative+Commons+0%22
- https://freesound.org/search/?q=rainforest+night&f=license:%22Creative+Commons+0%22

### Mise en place

1. Télécharger le clip choisi.
2. Si besoin, ré-encoder en MP3 128 kbps mono :
   ```bash
   ffmpeg -i original.wav -c:a libmp3lame -b:a 128k -ac 1 eywa-ambient.mp3
   ```
3. Placer le fichier ici : `frontend/public/audio/eywa-ambient.mp3`
4. Crédit : ajouter l'auteur Freesound dans `src/pages/about.astro`
   (section Sources/inspirations).
