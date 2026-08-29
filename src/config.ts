import { z } from 'zod';

/**
 * Environment configuration, parsed and validated once at startup.
 * A missing/invalid required var throws immediately with a readable message
 * rather than failing deep inside a request.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  API_KEY: z.string().min(1, 'API_KEY is required'),

  // LinkedIn session. Optional so the app can boot for tests / health without a
  // live session; the profile route surfaces a clear error if they are absent.
  LI_AT: z.string().default(''),
  JSESSIONID: z.string().default(''),
  USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    ),

  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(43_200),
  NEGATIVE_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(600),
  DAILY_CAP: z.coerce.number().int().positive().default(200),
  REQUEST_GAP_MS: z.coerce.number().int().nonnegative().default(2500),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  PROXY_URL: z.string().url().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
});

export type Config = z.infer<typeof EnvSchema> & { hasSession: boolean };

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = EnvSchema.parse(env);
  cached = {
    ...parsed,
    hasSession: Boolean(parsed.LI_AT && parsed.JSESSIONID),
  };
  return cached;
}

/** Test helper: forget the memoised config so a new env can be parsed. */
export function resetConfig(): void {
  cached = null;
}
