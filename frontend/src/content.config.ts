import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const codexEntrySchema = z.object({
  title: z.string(),
  summary: z.string(),
  order: z.number().optional(),
  // cover : image hosted by the site ("/…") or a full https URL. A bare
  // title (e.g. "Toruk") is the Fandom subject of the former proxy, removed in
  // L16 : it renders the default visual (src/lib/cover.ts) until L17 hosts
  // an illustration for it.
  cover: z.string().optional(),
  // coverAlt : French description of the hosted image (L17), shown as the alt
  // of the entry's banner. Required as soon as `cover` is a site path.
  coverAlt: z.string().min(20).optional(),
  // pandorapedia : page officielle de ce qu'illustre la fiche (L63), affichée
  // sous le bandeau (« Fiche officielle sur Pandorapedia »).
  // coverCredit : crédit de l'image quand c'est une image des films (L63, décision du 19-11-2026),
  // affiché en légende discrète sous le bandeau et sous la liste de la section.
  coverCredit: z.literal('© 20th Century Studios').optional(),
  // water : fiche de l'océan dont le bandeau ondoie sous le doigt (L36, « Eau vivante »). Seulement une
  // image où l'on voit l'eau (pas une créature détourée sur fond uni : rien à réfracter).
  water: z.boolean().optional(),
  pandorapedia: z.string().regex(/^https:\/\/www\.avatar\.com\/pandorapedia\/[a-z0-9-]+$/).optional(),
}).refine((d) => !d.cover?.startsWith('/') || !!d.coverAlt, {
  message: 'cover hébergée sur le site sans coverAlt (texte alternatif français, L17)',
  path: ['coverAlt'],
}).refine((d) => !d.coverCredit || !!d.cover, {
  message: 'coverCredit sans cover : un crédit ne va qu’avec une image',
  path: ['coverCredit'],
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
  // false quand maxresdefault.jpg répond 404 : la page ne le sonde alors pas (pas d'erreur console).
  maxres: z.boolean().optional(),
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
