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

// YouTube channels curated for the Vidéos section. Stored as markdown so
// they sit alongside the rest of the codex (no DB / no runtime API).
const videosChannelsSchema = z.object({
  name: z.string(),
  lang: z.enum(['FR', 'EN']),
  url: z.string().url(),
  avatar: z.string().min(1).max(4), // 1-4 initials, displayed in the channel chip
  isPriority: z.boolean().default(false),
  description: z.string(),
  order: z.number().default(99),
});

// Individual videos. The thumbnail is computed at build time from the
// videoId (img.youtube.com CDN) — no fetch ever happens.
const videosListSchema = z.object({
  title: z.string(),
  videoId: z.string().regex(/^[\w-]{11}$/), // YouTube ID (11 chars)
  channelSlug: z.string(),
  lang: z.enum(['FR', 'EN']),
  type: z.enum(['lore', 'analysis', 'vfx', 'official', 'fan-animation', 'language', 'other']),
  description: z.string(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Override if maxresdefault is available; otherwise hqdefault is used.
  thumbnail: z.string().url().optional(),
  order: z.number().default(99),
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
  videosChannels: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/videos-channels' }),
    schema: videosChannelsSchema,
  }),
  videosList: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/videos-list' }),
    schema: videosListSchema,
  }),
};
