import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { createDb, type Db } from "../src/db/client.ts";
import { createLogger } from "../src/lib/logger.ts";
import type { RuntimeState } from "../src/lib/runtime-lifecycle.ts";
import type { PhotoStorage } from "../src/lib/storage.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

const noStorage: PhotoStorage = {
  putPhoto: () => Promise.reject(new Error("Unexpected photo write in runtime health test")),
  getPhoto: () => Promise.reject(new Error("Unexpected photo read in runtime health test")),
  deletePhoto: () => Promise.resolve(),
  ensureBucket: () => Promise.resolve(),
};

let database: TestDatabase;

function createRuntimeTestApp(
  db: Db,
  options: { runtime?: RuntimeState; browserReportingOrigin?: string } = {},
) {
  const deps = {
    db,
    authConfig: {
      secret: "test-secret-with-at-least-thirty-two-characters",
      baseUrl: "http://localhost:3000",
      sendResetPassword: () => Promise.resolve(),
    },
    clock: () => new Date("2026-10-01T15:00:00.000Z"),
    logger: createLogger("silent"),
    publicBaseUrl: "http://localhost:5173",
    storage: noStorage,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    ...(options.browserReportingOrigin === undefined
      ? {}
      : { browserReportingOrigin: options.browserReportingOrigin }),
  };
  return createApp(deps);
}

async function withNativeServer<Result>(
  app: ReturnType<typeof createRuntimeTestApp>,
  action: (origin: string) => Promise<Result>,
): Promise<Result> {
  // Node ignores listener return values; the Hono listener handles asynchronous requests.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(getRequestListener(app.fetch));
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback listener");
    return await action(`http://127.0.0.1:${String(address.port)}`);
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        }),
      );
    }
  }
}

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

describe("runtime health and CSP over native HTTP", () => {
  it("answers liveness without touching PostgreSQL", async () => {
    const transaction = vi.spyOn(database.db, "transaction");
    const app = createRuntimeTestApp(database.db);

    try {
      await withNativeServer(app, async (origin) => {
        for (let attempt = 0; attempt < 61; attempt += 1) {
          const response = await fetch(`${origin}/health/live`);
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toContain("no-store");
          expect(await response.json()).toEqual({ status: "ok" });
        }
      });

      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });

  it("reports readiness after a read-only PostgreSQL query succeeds", async () => {
    const app = createRuntimeTestApp(database.db);

    await withNativeServer(app, async (origin) => {
      const response = await fetch(`${origin}/health/ready`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ status: "ready" });
    });
  });

  it("returns a generic unavailable response when its isolated PostgreSQL server is stopped", async () => {
    const unavailableFixture = await startDatabase();
    const unavailableDb = createDb(unavailableFixture.url);
    let fixtureStopped = false;
    const app = createRuntimeTestApp(unavailableDb);

    try {
      await unavailableFixture.stop();
      fixtureStopped = true;

      await withNativeServer(app, async (origin) => {
        const response = await fetch(`${origin}/health/ready`);
        const body = await response.text();

        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(body).toBe('{"status":"unavailable"}');
        expect(body).not.toContain(unavailableFixture.url);
        expect(body).not.toMatch(/ECONNREFUSED|postgres|password|database/iu);
      });
    } finally {
      await unavailableDb.$client.end({ timeout: 2 });
      if (!fixtureStopped) await unavailableFixture.stop();
    }
  });

  it("returns a generic unavailable response immediately while draining", async () => {
    const runtime: RuntimeState = { draining: true, readinessProbe: undefined };
    const transaction = vi.spyOn(database.db, "transaction");
    const app = createRuntimeTestApp(database.db, { runtime });

    try {
      await withNativeServer(app, async (origin) => {
        const response = await fetch(`${origin}/health/ready`);
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(await response.json()).toEqual({ status: "unavailable" });
      });

      expect(transaction).not.toHaveBeenCalled();
      expect(runtime.readinessProbe).toBeUndefined();
    } finally {
      transaction.mockRestore();
    }
  });

  it("remains unavailable when draining starts during an active readiness probe", async () => {
    const runtime: RuntimeState = { draining: false, readinessProbe: undefined };
    const app = createRuntimeTestApp(database.db, { runtime });
    const connections = await Promise.all(
      Array.from({ length: 10 }, () => database.db.$client.reserve()),
    );
    let connectionsReleased = false;
    const releaseConnections = (): void => {
      if (connectionsReleased) return;
      connectionsReleased = true;
      for (const connection of connections) connection.release();
    };

    try {
      await withNativeServer(app, async (origin) => {
        const responsePromise = fetch(`${origin}/health/ready`);
        await vi.waitFor(
          () => {
            expect(runtime.readinessProbe).toBeDefined();
          },
          { timeout: 250 },
        );
        runtime.draining = true;
        releaseConnections();

        const response = await responsePromise;
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ status: "unavailable" });
      });
    } finally {
      releaseConnections();
    }
  });

  it("bounds saturated-pool checks and coalesces one pending PostgreSQL probe", async () => {
    const runtime: RuntimeState = { draining: false, readinessProbe: undefined };
    const transaction = vi.spyOn(database.db, "transaction");
    const app = createRuntimeTestApp(database.db, { runtime });
    const connections = await Promise.all(
      Array.from({ length: 10 }, () => database.db.$client.reserve()),
    );
    const blockers = connections.map((connection) => connection`select pg_sleep(2)`);
    let pendingProbe: Promise<void> | undefined;

    try {
      await withNativeServer(app, async (origin) => {
        const started = performance.now();
        const first = fetch(`${origin}/health/ready`);
        await vi.waitFor(
          () => {
            expect(runtime.readinessProbe).toBeDefined();
          },
          { timeout: 250 },
        );
        const second = fetch(`${origin}/health/ready`);
        const responses = await Promise.all([first, second]);

        expect(responses.map((response) => response.status)).toEqual([503, 503]);
        expect(performance.now() - started).toBeLessThan(1500);
        expect(transaction).toHaveBeenCalledTimes(1);
        pendingProbe = runtime.readinessProbe;
        expect(pendingProbe).toBeDefined();
        for (const response of responses) {
          expect(response.headers.get("cache-control")).toContain("no-store");
          expect(await response.json()).toEqual({ status: "unavailable" });
        }
      });
    } finally {
      await Promise.allSettled(blockers);
      for (const connection of connections) connection.release();
      transaction.mockRestore();
    }

    await pendingProbe;
    expect(runtime.readinessProbe).toBeUndefined();
  });

  it("emits one strict CSP with only the configured browser reporting origin", async () => {
    const app = createRuntimeTestApp(database.db, {
      browserReportingOrigin: "https://errors.example",
    });

    await withNativeServer(app, async (origin) => {
      const response = await fetch(`${origin}/not-found`);
      const policy = response.headers.get("content-security-policy");
      expect(policy).toBe(
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
          "script-src 'self'; script-src-elem 'self'; script-src-attr 'none'; " +
          "style-src 'self'; style-src-elem 'self' 'sha256-kLmvWqfziFavKtqHqRsb90f006UAK2Dmd0It5Iz2KFA=' " +
          "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=' " +
          "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='; " +
          "style-src-attr 'unsafe-inline'; " +
          "img-src 'self' blob:; font-src 'self'; connect-src 'self' https://errors.example; " +
          "worker-src 'self'; manifest-src 'self'; form-action 'self'; frame-src 'none'",
      );
      expect(policy?.match(/frame-ancestors/g)).toHaveLength(1);
      expect(policy).not.toContain("unsafe-eval");
      expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
    });

    const appWithoutReporting = createRuntimeTestApp(database.db);
    await withNativeServer(appWithoutReporting, async (origin) => {
      const response = await fetch(`${origin}/not-found`);
      expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
      expect(response.headers.get("content-security-policy")).not.toContain("https://");
    });
  });
});
