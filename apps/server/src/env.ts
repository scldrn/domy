import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: z.url(),
  API_PORT: z.coerce.number().int().positive().default(3000),
  EMAIL_FROM: z.string().min(3),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  DOMY_FAKE_NOW: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Reads and validates the environment; the process exits with a clear message if invalid. */
export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    console.error(`Invalid environment:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}
