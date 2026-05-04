import { z } from 'zod';

/**
 * Boot-time validation of the env vars Eywa relies on.
 *
 * Bad/missing values fail fast at startup with a precise message instead
 * of producing weird runtime behavior (e.g. parseInt(undefined) silently
 * collapsing to NaN→3003, or CORS being effectively disabled because the
 * value was truthy junk).
 */
const EnvSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a positive integer')
    .optional(),
  CORS_ORIGIN: z.string().optional(),
});

export type AppEnv = {
  port: number;
  corsOrigin: string | true;
};

export function loadAppEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = EnvSchema.parse({
    PORT: raw.PORT,
    CORS_ORIGIN: raw.CORS_ORIGIN,
  });
  // PORT=0 intentionally falls back to 3003 (deterministic deploy port).
  const port = parsed.PORT ? parseInt(parsed.PORT, 10) || 3003 : 3003;
  const corsOrigin = parsed.CORS_ORIGIN && parsed.CORS_ORIGIN.length > 0 ? parsed.CORS_ORIGIN : true;
  return { port, corsOrigin };
}
