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
