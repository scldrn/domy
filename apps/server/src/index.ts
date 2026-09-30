import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { createDb } from "./db/client.ts";
import { readEnv } from "./env.ts";
import { createClock } from "./lib/clock.ts";
import { createLogger } from "./lib/logger.ts";

const env = readEnv();
const logger = createLogger(env.NODE_ENV === "production" ? "info" : "debug");
const db = createDb(env.DATABASE_URL);
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseUrl: env.APP_URL,
  sendResetPassword: async ({ email }) => {
    // Replaced by lib/email.ts in task T111.
    logger.warn({ email }, "password reset email not sent: email is not configured yet");
    await Promise.resolve();
  },
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
  }),
});

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "server listening");
});
