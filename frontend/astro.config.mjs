// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],

  // Astro 7 passe compressHTML à 'jsx' (espaces entre éléments en ligne supprimés, comme en JSX).
  // Mesuré au passage à Astro 7 (L59) : le texte des 81 pages changeait (« PandoraClans Na'viBestiaire… »).
  // On garde le comportement d'Astro 6.
  compressHTML: true,

  vite: {
    plugins: [tailwindcss()]
  }
});