import { z } from 'zod';

/**
 * Centralized, validated access to server-side environment variables.
 *
 * Import `getEnv()` from server code (API routes, scripts, worker). It throws a
 * clear aggregated error if anything required is missing, instead of failing
 * deep inside an SDK call with a cryptic message.
 */
const EnvSchema = z.object({
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a full URL (no bucket path)'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET: z.string().min(1).default('edit-ai'),
  R2_PUBLIC_HOST: z.string().min(1).default('videos.abdulrehmann.com'),

  GEMINI_API_KEYS: z
    .string()
    .min(1, 'GEMINI_API_KEYS is required (comma-separated)')
    .transform((s) =>
      s
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    )
    .refine((arr) => arr.length > 0, 'GEMINI_API_KEYS must contain at least one key'),
  // gemini-flash-latest is a moving alias available across accounts (pinned
  // 2.x/lite models are restricted for newer API projects). Override per-env.
  GEMINI_MODEL: z.string().min(1).default('gemini-flash-latest'),

  PEXEL_API_KEY: z.string().min(1, 'PEXEL_API_KEY is required'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid / missing environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Normalize the public host into a base URL (adds https:// if missing). */
export function publicBaseUrl(host: string): string {
  const trimmed = host.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
