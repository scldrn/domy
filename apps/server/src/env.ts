import { z } from "zod";
import { publicOriginSchema } from "@domy/domain";
import { normalizeIpAddress } from "./lib/client-address.ts";

const optional = z.string().optional();
const browserReportingOriginSchema = z.string().transform((value, context) => {
  let dsn: URL;
  try {
    dsn = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "Must be a valid HTTPS Sentry DSN" });
    return z.NEVER;
  }

  const pathSegments = dsn.pathname.split("/").filter(Boolean);
  if (
    !/^https:\/\//iu.test(value) ||
    dsn.protocol !== "https:" ||
    !dsn.hostname ||
    !dsn.username ||
    dsn.password ||
    pathSegments.length === 0 ||
    dsn.search ||
    dsn.hash ||
    value.includes("?") ||
    value.includes("#")
  ) {
    context.addIssue({
      code: "custom",
      message: "Must be an HTTPS Sentry DSN with a public key and project path",
    });
    return z.NEVER;
  }

  return dsn.origin;
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    APP_URL: publicOriginSchema,
    PUBLIC_BASE_URL: publicOriginSchema.optional(),
    DOMY_TRUSTED_PROXY_IP: z
      .string()
      .transform((value, context) => {
        const normalized = normalizeIpAddress(value);
        if (normalized === undefined) {
          context.addIssue({ code: "custom", message: "Must be one valid IPv4 or IPv6 address" });
          return z.NEVER;
        }
        return normalized;
      })
      .optional(),
    VITE_SENTRY_DSN: browserReportingOriginSchema.optional(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    EMAIL_FROM: z.string().min(3),
    RESEND_API_KEY: optional,
    SENTRY_DSN: optional,
    DOMY_FAKE_NOW: optional,
    // Photo storage, S3-compatible (feature 003, research R6).
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: optional,
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
    // Phone notifications, Web Push (feature 003, research R8).
    VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
    VAPID_SUBJECT: optional,
  })
  .superRefine((env, context) => {
    const production = env.NODE_ENV === "production";
    if (production && !env.PUBLIC_BASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["PUBLIC_BASE_URL"],
        message: "Required in production",
      });
    }
    if (production && env.PUBLIC_BASE_URL) {
      if (!env.PUBLIC_BASE_URL.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: ["PUBLIC_BASE_URL"],
          message: "Must use HTTPS in production",
        });
      }
      if (env.PUBLIC_BASE_URL !== env.APP_URL) {
        context.addIssue({
          code: "custom",
          path: ["PUBLIC_BASE_URL"],
          message: "Must match APP_URL in production",
        });
      }
    }
    // Outside production the storage of compose.yaml stands in; production names its own.
    if (production) {
      for (const key of [
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
      ] as const) {
        if (!env[key]) {
          context.addIssue({ code: "custom", path: [key], message: "Required in production" });
        }
      }
    }
    // Notifications are an aid (FR-040): off in development without keys, never half set.
    const keys = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
    if (production || keys.some((key) => env[key])) {
      for (const key of keys) {
        if (!env[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: production ? "Required in production" : "Set the three VAPID keys or none",
          });
        }
      }
    }
  })
  .transform(
    ({
      S3_ENDPOINT,
      S3_REGION,
      S3_BUCKET,
      S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY,
      S3_FORCE_PATH_STYLE,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
      VAPID_SUBJECT,
      VITE_SENTRY_DSN,
      PUBLIC_BASE_URL,
      ...rest
    }) => ({
      ...rest,
      PUBLIC_BASE_URL: PUBLIC_BASE_URL ?? rest.APP_URL,
      ...(VITE_SENTRY_DSN === undefined ? {} : { browserReportingOrigin: VITE_SENTRY_DSN }),
      storage: {
        endpoint: S3_ENDPOINT ?? "http://localhost:9100",
        region: S3_REGION ?? "us-east-1",
        bucket: S3_BUCKET ?? "domy-fotos",
        accessKeyId: S3_ACCESS_KEY_ID ?? "domy",
        secretAccessKey: S3_SECRET_ACCESS_KEY ?? "domy-secreto",
        forcePathStyle: (S3_FORCE_PATH_STYLE ?? (S3_ENDPOINT ? "false" : "true")) === "true",
      },
      push:
        VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
          ? { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT }
          : null,
    }),
  );

export type Env = z.infer<typeof envSchema>;

/** Validates an environment; empty optional values count as absent except strict proxy IP. */
export function parseEnv(
  source: Record<string, string | undefined>,
): { success: true; data: Env } | { success: false; error: string } {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(
      ([key, value]) => value !== "" || key === "DOMY_TRUSTED_PROXY_IP",
    ),
  );
  const result = envSchema.safeParse(cleaned);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: z.prettifyError(result.error) };
}

/** Reads and validates the environment; the process exits with a clear message if invalid. */
export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = parseEnv(source);
  if (!result.success) {
    console.error(`Invalid environment:\n${result.error}`);
    process.exit(1);
  }
  return result.data;
}
