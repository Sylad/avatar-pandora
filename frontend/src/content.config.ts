import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const codexEntrySchema = z.object({
  title: z.string(),
  summary: z.string(),
  order: z.number().optional(),
  // cover is either a wiki search query (resolved via /api/wiki-image?q=...)
  // OR a full URL (for non-wiki images). Both forms accepted.
  cover: z.string().optional(),
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
  // langue is a standalone page (src/pages/langue.astro) — no entries collection
  films: makeCollection('films'),
  engins: makeCollection('engins'),
};
