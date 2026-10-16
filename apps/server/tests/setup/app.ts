import type { UserRole } from "@domy/domain";
import pino, { type Logger } from "pino";
import { createApp } from "../../src/app.ts";
import { createAuth } from "../../src/auth.ts";
import type { Db } from "../../src/db/client.ts";
import type { PhotoStorage } from "../../src/lib/storage.ts";

export type SentEmail = { email: string; name: string; url: string };

/** Storage for tests that use no photos; `startStorage` gives a real one (research R6). */
const noStorage: PhotoStorage = {
  putPhoto: () => Promise.reject(new Error("This test has no photo storage")),
  getPhoto: () => Promise.reject(new Error("This test has no photo storage")),
  ensureBucket: () => Promise.resolve(),
};

/** The real app wired to a test database, a controllable clock, and captured emails. */
export function createTestApp(
  db: Db,
  options: {
    now?: string;
    logger?: Logger;
    storage?: PhotoStorage;
    /** US5/T061 uses real VAPID configuration; only the external push transport is spied. */
    push?: { publicKey: string; privateKey: string; subject: string };
  } = {},
) {
  let now = new Date(options.now ?? "2026-10-01T15:00:00Z");
  const emails: SentEmail[] = [];
  const auth = createAuth({
    db,
    secret: "test-secret-with-at-least-thirty-two-characters",
    baseUrl: "http://localhost:3000",
    sendResetPassword: async (email) => {
      emails.push(email);
      await Promise.resolve();
    },
  });
  const app = createApp({
    db,
    auth,
    clock: () => now,
    logger: options.logger ?? pino({ level: "silent" }),
    storage: options.storage ?? noStorage,
    ...(options.push && { push: options.push }),
  });

  /** Creates an active user with a role and returns it with the cookie of a new session. */
  async function signIn(role: UserRole, overrides: { email?: string; name?: string } = {}) {
    const email = overrides.email ?? `${role}-${crypto.randomUUID()}@domy.test`;
    const password = "contrasena-segura";
    const { user } = await auth.api.createUser({
      body: { email, password, name: overrides.name ?? `Usuario ${role}`, role },
    });
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Sign-in failed with ${String(response.status)}`);
    }
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return { user, email, password, cookie };
  }

  /** Sends a JSON request as a signed-in user. */
  async function request(
    path: string,
    init: { method?: string; cookie?: string; body?: unknown } = {},
  ) {
    return app.request(path, {
      method: init.method ?? "GET",
      headers: {
        ...(init.cookie && { cookie: init.cookie }),
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    });
  }

  return {
    app,
    auth,
    emails,
    signIn,
    request,
    now: () => now,
    setNow: (instant: string) => {
      now = new Date(instant);
    },
  };
}
