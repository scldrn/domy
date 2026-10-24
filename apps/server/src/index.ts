import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { createApp } from "./app.ts";
import type { AuthConfig } from "./auth.ts";
import { createDb } from "./db/client.ts";
import { readEnv } from "./env.ts";
import { createClock } from "./lib/clock.ts";
import { createMailer } from "./lib/email.ts";
import { errorForLog, setErrorReporter } from "./lib/errors.ts";
import { createLogger } from "./lib/logger.ts";
import { reportingPrivacy } from "./lib/reporting-privacy.ts";
import { registerGracefulShutdown, type RuntimeState } from "./lib/runtime-lifecycle.ts";
import { createStorage } from "./lib/storage.ts";

const env = readEnv();
const logger = createLogger(env.NODE_ENV === "production" ? "info" : "debug");

// Server error reporting, only when configured (research R14).
if (env.SENTRY_DSN) {
  Sentry.init({ ...reportingPrivacy, dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  setErrorReporter((error) => Sentry.captureException(error));
}
const db = createDb(env.DATABASE_URL);
const mailer = createMailer({
  nodeEnv: env.NODE_ENV,
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  logger,
});
const authConfig: AuthConfig = {
  secret: env.BETTER_AUTH_SECRET,
  baseUrl: env.APP_URL,
  sendResetPassword: mailer.sendResetPassword,
};
const runtime: RuntimeState = { draining: false, readinessProbe: undefined };

const storage = createStorage(env.storage);
if (env.NODE_ENV !== "production") {
  // Development and tests create the bucket; production provisions it with its 12-month
  // lifecycle rule (research R6).
  await storage.ensureBucket().catch(() => {
    logger.warn({ outcome: "failed" }, "photo storage unavailable; photos will fail");
  });
}

let clock = createClock({
  nodeEnv: env.NODE_ENV,
  ...(env.DOMY_FAKE_NOW && { fakeNow: env.DOMY_FAKE_NOW }),
});

const app = createApp({
  db,
  authConfig,
  clock: () => clock(),
  logger,
  publicBaseUrl: env.PUBLIC_BASE_URL,
  storage,
  push: env.push,
  runtime,
  ...(env.DOMY_TRUSTED_PROXY_IP === undefined ? {} : { trustedProxyIp: env.DOMY_TRUSTED_PROXY_IP }),
  ...(env.browserReportingOrigin === undefined
    ? {}
    : { browserReportingOrigin: env.browserReportingOrigin }),
  ...(env.NODE_ENV === "production" && { webDist: "../web/dist" }),
  ...(env.NODE_ENV === "test" && {
    setNow: (instant: string) => {
      clock = createClock({ nodeEnv: env.NODE_ENV, fakeNow: instant });
    },
    testEmails: mailer.outbox,
  }),
});

// The adapter handles asynchronous listener errors; Node ignores its return value.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(getRequestListener(app.fetch));
server.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "server listening");
});
registerGracefulShutdown({ server, db, runtime, logger });

// Release review ROB-6: Ctrl-C drains like the orchestrator's SIGTERM; an unexpected failure is
// logged without its text (it may hold recipients' data) and drains with exit code 1, so the
// container restarts instead of running on in an unknown state. A hung drain cannot outlive
// the compose stop grace period.
const FATAL_EXIT_DEADLINE_MS = 15_000;
process.on("SIGINT", () => process.emit("SIGTERM", "SIGTERM"));
function drainAfterFailure(kind: "uncaught_exception" | "unhandled_rejection", error: unknown) {
  process.exitCode = 1;
  logger.fatal(
    {
      kind,
      error:
        error instanceof Error
          ? errorForLog(error)
          : { type: "Error", message: "Unexpected application error." },
    },
    "unexpected process failure; draining",
  );
  setTimeout(() => process.exit(1), FATAL_EXIT_DEADLINE_MS).unref();
  process.emit("SIGTERM", "SIGTERM");
}
process.on("uncaughtException", (error) => {
  drainAfterFailure("uncaught_exception", error);
});
process.on("unhandledRejection", (reason) => {
  drainAfterFailure("unhandled_rejection", reason);
});
