import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { createDb } from "./db/client.ts";
import { readEnv } from "./env.ts";
import { createClock } from "./lib/clock.ts";
import { createMailer } from "./lib/email.ts";
import { setErrorReporter } from "./lib/errors.ts";
import { createLogger } from "./lib/logger.ts";

const env = readEnv();
const logger = createLogger(env.NODE_ENV === "production" ? "info" : "debug");

// Server error reporting, only when configured (research R14).
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  setErrorReporter((error) => Sentry.captureException(error));
}
const db = createDb(env.DATABASE_URL);
const mailer = createMailer({
  nodeEnv: env.NODE_ENV,
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  logger,
});
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseUrl: env.APP_URL,
  sendResetPassword: mailer.sendResetPassword,
});

let clock = createClock({
  nodeEnv: env.NODE_ENV,
  ...(env.DOMY_FAKE_NOW && { fakeNow: env.DOMY_FAKE_NOW }),
});

const app = createApp({
  db,
  auth,
  clock: () => clock(),
  logger,
  ...(env.NODE_ENV === "production" && { webDist: "../web/dist" }),
  ...(env.NODE_ENV === "test" && {
    setNow: (instant: string) => {
      clock = createClock({ nodeEnv: env.NODE_ENV, fakeNow: instant });
    },
    testEmails: mailer.outbox,
  }),
});

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "server listening");
});
