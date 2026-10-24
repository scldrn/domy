import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { sessions } from "../src/db/schema/index.ts";
import { createLogger } from "../src/lib/logger.ts";
import type { PhotoStorage } from "../src/lib/storage.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
});

/** The Node adapter's transport bindings, as @hono/node-server passes them to the app. */
const fromPeer = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

const noStorage: PhotoStorage = {
  putPhoto: () => Promise.reject(new Error("No photo storage in this test")),
  getPhoto: () => Promise.reject(new Error("No photo storage in this test")),
  deletePhoto: () => Promise.resolve(),
  ensureBucket: () => Promise.resolve(),
};

describe("anonymous sign-in flood (SEC-1, FR-033)", () => {
  it("does not hold the database pool: office reads stay fast during a flood", async () => {
    const t = createTestApp(database.db);
    const { cookie } = await t.signIn("dispatcher");
    // Warm the office path so the measurement only reflects pool contention.
    expect((await t.request("/api/rate-zones", { cookie })).status).toBe(200);

    const flood = Array.from({ length: 60 }, async () =>
      t.app.request(
        "/api/auth/sign-in/email",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "nadie@domy.test", password: "equivocada" }),
        },
        fromPeer("203.0.113.7"),
      ),
    );
    // Let the flood reach its handlers before the office request competes with it.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const started = performance.now();
    const office = await t.request("/api/rate-zones", { cookie });
    const elapsed = performance.now() - started;
    const statuses = (await Promise.all(flood)).map((response) => response.status);

    expect(office.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
    // Every attempt is answered: wrong credentials or the catalogued rate limit, never a 5xx.
    expect(statuses.every((status) => status === 401 || status === 429)).toBe(true);
    expect(statuses).toContain(429);
  });

  it("limits sign-in attempts per client address and answers rate_limited", async () => {
    const t = createTestApp(database.db);
    const attempt = (peer: string) =>
      t.app.request(
        "/api/auth/sign-in/email",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "nadie@domy.test", password: "equivocada" }),
        },
        fromPeer(peer),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await attempt("198.51.100.20")).status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(20);
    const refused = await attempt("198.51.100.20");
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ error: { code: "rate_limited" } });
    // Another client keeps its own budget.
    expect((await attempt("198.51.100.21")).status).toBe(401);
  });
});

describe("Better Auth client address (SEC-8)", () => {
  function appWith(trustedProxyIp?: string) {
    const t = createTestApp(database.db);
    const app = createApp({
      db: database.db,
      authConfig: {
        secret: "test-secret-with-at-least-thirty-two-characters",
        baseUrl: "http://localhost:3000",
        sendResetPassword: () => Promise.resolve(),
      },
      clock: () => new Date("2026-10-01T15:00:00.000Z"),
      logger: createLogger("silent"),
      publicBaseUrl: "http://localhost:5173",
      storage: noStorage,
      ...(trustedProxyIp && { trustedProxyIp }),
    });
    return { t, app };
  }

  async function sessionIp(trustedProxyIp: string | undefined, peer: string, forwarded: string) {
    const { t, app } = appWith(trustedProxyIp);
    const email = `ip-${crypto.randomUUID()}@domy.test`;
    const { user } = await t.auth.api.createUser({
      body: { email, password: "contrasena-segura", name: "Usuario", role: "dispatcher" },
    });
    const response = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Domy-Client-IP": forwarded,
          "X-Forwarded-For": "192.0.2.99",
        },
        body: JSON.stringify({ email, password: "contrasena-segura" }),
      },
      fromPeer(peer),
    );
    expect(response.status).toBe(200);
    const [session] = await database.db
      .select({ ipAddress: sessions.ipAddress })
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    return session?.ipAddress;
  }

  it("ignores client-supplied forwarding headers without a trusted proxy", async () => {
    expect(await sessionIp(undefined, "198.51.100.30", "192.0.2.50")).toBe("198.51.100.30");
  });

  it("reads X-Domy-Client-IP only from the configured proxy peer", async () => {
    expect(await sessionIp("10.0.0.2", "10.0.0.2", "192.0.2.50")).toBe("192.0.2.50");
    expect(await sessionIp("10.0.0.2", "198.51.100.31", "192.0.2.50")).toBe("198.51.100.31");
  });
});
