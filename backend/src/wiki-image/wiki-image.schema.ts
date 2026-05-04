import { z } from 'zod';

/**
 * Validation schema for `GET /api/wiki-image?q=...` query parameters.
 * Bounds the query length to protect against absurdly large inputs reaching
 * the upstream Fandom/Wikipedia URLs (and our axios timeout / disk).
 */
export const WikiImageQuerySchema = z.object({
  q: z.string().min(1, 'q must not be empty').max(200, 'q too long'),
});

export type WikiImageQuery = z.infer<typeof WikiImageQuerySchema>;
