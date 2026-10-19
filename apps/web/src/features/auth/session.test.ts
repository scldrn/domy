import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCourierDb } from "@/lib/offline/db";

function pathOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

const id = (n: number) => `0194d9f0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const originalIndexedDb = indexedDB;
const user = (n: number, role = "courier") => ({
  id: id(n),
  name: "Usuario de prueba",
  email: `usuario${String(n)}@example.com`,
  role,
});
const record = {
  id: id(1),
  shipmentId: id(2),
  kind: "pickup" as const,
  occurredAt: "2026-10-01T15:00:00Z",
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(async () => {
  const { courierDatabase } = await import("@/features/courier/courier-store");
  try {
    (await courierDatabase()).close();
  } catch {
    /* Storage may be blocked in this test. */
  }
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => {
    const request = originalIndexedDb.deleteDatabase("domy-mensajero");
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Could not remove the test database"));
    };
  });
});

async function seed(pending = true) {
  const db = await openCourierDb();
  await db.put("meta", { userId: id(700), clockOffsetMs: 0, lastSyncedAt: null }, "current");
  if (pending) await db.add("outbox", { type: "record", record });
  db.close();
}

/** US2 follows the shared auth consumers too: no cookie change can take over pending data. */
describe("authentication with courier data", () => {
  it("interrupts an in-flight session check when the phone loses connectivity (T131)", async () => {
    await seed();
    const entered = Promise.withResolvers<undefined>();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const requestSignal = init?.signal;
      if (requestSignal) signals.push(requestSignal);
      entered.resolve(undefined);
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("The connection was interrupted", "AbortError"));
          },
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const { QueryClient } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();
    const check = client.query({ ...sessionQuery, retry: false });
    try {
      await entered.promise;
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      const interruptedSignal = signals[0];
      const refused = expect(check).rejects.toMatchObject({ status: 0, code: "network_error" });
      window.dispatchEvent(new Event("offline"));
      await refused;
      expect(interruptedSignal?.aborted).toBe(true);
      const { courierDatabase } = await import("@/features/courier/courier-store");
      expect(await (await courierDatabase()).count("outbox")).toBe(1);
      fetcher.mockImplementationOnce((_input, init) => {
        if (init?.signal) signals.push(init.signal);
        return Promise.resolve(Response.json({ user: user(700) }));
      });
      await expect(client.query({ ...sessionQuery, retry: false })).resolves.toEqual(user(700));
      const completedSignal = signals[1];
      expect(signals).toHaveLength(2);
      expect(completedSignal?.aborted).toBe(false);
      window.dispatchEvent(new Event("offline"));
      expect(completedSignal?.aborted).toBe(false);
    } finally {
      client.clear();
      await check.catch(() => undefined);
    }
  });

  it("keeps offline interruption during the session response body a network error", async () => {
    const entered = Promise.withResolvers<undefined>();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const requestSignal = init?.signal;
        if (requestSignal) signals.push(requestSignal);
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            requestSignal?.addEventListener("abort", () => {
              controller.error(new DOMException("The response was interrupted", "AbortError"));
            });
          },
        });
        entered.resolve(undefined);
        return Promise.resolve(new Response(body));
      }),
    );
    const { QueryClient } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();
    const check = client.query({ ...sessionQuery, retry: false });
    try {
      await entered.promise;
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      const refused = expect(check).rejects.toMatchObject({ status: 0, code: "network_error" });
      window.dispatchEvent(new Event("offline"));
      await refused;
    } finally {
      client.clear();
      await check.catch(() => undefined);
    }
  });

  it("does not start an uninterruptible session read if connectivity was already lost", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.signal?.aborted
        ? Promise.reject(new DOMException("Already offline", "AbortError"))
        : Promise.resolve(Response.json({ user: user(700) })),
    );
    vi.stubGlobal("fetch", fetcher);
    const { QueryClient } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();
    try {
      await expect(client.query({ ...sessionQuery, retry: false })).rejects.toMatchObject({
        status: 0,
        code: "network_error",
      });
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      client.clear();
    }
  });

  it("forwards native Query cancellation to the session transport", async () => {
    const entered = Promise.withResolvers<undefined>();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        if (signal) signals.push(signal);
        entered.resolve(undefined);
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Cancelled", "AbortError"));
          });
        });
      }),
    );
    const { QueryClient, CancelledError } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();
    const check = client.query({ ...sessionQuery, retry: false });
    const cancelled = check.catch((error: unknown) => error);
    try {
      await entered.promise;
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      await client.cancelQueries({ queryKey: sessionQuery.queryKey });
      expect(await cancelled).toBeInstanceOf(CancelledError);
      expect(signals[0]?.aborted).toBe(true);
    } finally {
      client.clear();
      await cancelled;
    }
  });

  it.each([
    { status: 401, body: null, outcome: null },
    { status: 403, body: {}, outcome: { status: 403, code: "session_refused" } },
    { status: 200, body: {}, outcome: { status: 502, code: "invalid_session" } },
  ])("preserves authoritative session refusal at $status", async ({ status, body, outcome }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(body, { status }))),
    );
    const { QueryClient } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();
    try {
      const check = client.query({ ...sessionQuery, retry: false });
      if (outcome === null) await expect(check).resolves.toBeNull();
      else await expect(check).rejects.toMatchObject(outcome);
    } finally {
      client.clear();
    }
  });

  it("distinguishes server unavailability from an absent session", async () => {
    await seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({ error: { message: "Temporalmente no disponible" } }, { status: 503 }),
        ),
      ),
    );
    const { QueryClient } = await import("@tanstack/react-query");
    const { sessionQuery } = await import("./session");
    const client = new QueryClient();

    await expect(client.query({ ...sessionQuery, retry: false })).rejects.toMatchObject({
      status: 503,
      code: "session_unavailable",
    });
    const { courierDatabase } = await import("@/features/courier/courier-store");
    expect(await (await courierDatabase()).count("outbox")).toBe(1);
  });

  it("ends an unverified successful sign-in instead of leaving its cookie over pending data", async () => {
    await seed();
    const fetcher = vi.fn(() => Promise.resolve(Response.json({ user: { id: id(701) } })));
    vi.stubGlobal("fetch", fetcher);
    const { signIn } = await import("./session");
    await expect(signIn("usuario701@example.com", "password")).rejects.toMatchObject({
      code: "invalid_session",
    });
    expect(fetcher.mock.calls).toHaveLength(2);
  });

  it("refuses sign-out for a photo alone, without contacting authentication", async () => {
    await seed(false);
    const { courierDatabase } = await import("@/features/courier/courier-store");
    const db = await courierDatabase();
    await db.put("photos", {
      id: id(300),
      recordId: id(1),
      kind: "proof",
      image: new Blob(["jpeg"]),
    });
    const fetcher = vi.fn(() => Promise.resolve(Response.json({ success: true })));
    vi.stubGlobal("fetch", fetcher);
    const { signOut } = await import("./session");
    await expect(signOut()).rejects.toMatchObject({ status: 409 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.count("photos")).toBe(1);
  });
  it("refuses a different account and ends that new session without deleting pending records", async () => {
    await seed();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      return pathOf(input).endsWith("sign-in/email")
        ? Response.json({ user: user(701) })
        : Response.json({ success: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const { signIn } = await import("./session");

    await expect(signIn("usuario701@example.com", "password")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("otra cuenta"),
    });

    expect(fetcher.mock.calls.map(([input]) => pathOf(input))).toEqual([
      "/api/auth/sign-in/email",
      "/api/auth/sign-out",
    ]);
    const { courierDatabase } = await import("@/features/courier/courier-store");
    const db = await courierDatabase();
    expect(await db.count("outbox")).toBe(1);
    expect((await db.get("meta", "current"))?.userId).toBe(id(700));
  });

  it("allows the same courier to sign in again and keeps pending records", async () => {
    await seed();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await Promise.resolve();
        return Response.json({ user: user(700) });
      }),
    );
    const { signIn } = await import("./session");
    await expect(signIn("usuario700@example.com", "password")).resolves.toBeUndefined();
    const { courierDatabase } = await import("@/features/courier/courier-store");
    expect(await (await courierDatabase()).count("outbox")).toBe(1);
  });

  it("refuses sign-out before contacting authentication when anything is pending", async () => {
    await seed();
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return Response.json({ success: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const { signOut } = await import("./session");
    await expect(signOut()).rejects.toMatchObject({ status: 409 });
    expect(fetcher).not.toHaveBeenCalled();
    const { courierDatabase } = await import("@/features/courier/courier-store");
    expect(await (await courierDatabase()).count("outbox")).toBe(1);
  });

  it("clears all local stores only after a successful sign-out with no pending items", async () => {
    await seed(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await Promise.resolve();
        return Response.json({ success: true });
      }),
    );
    const { signOut } = await import("./session");
    await signOut();
    const { courierDatabase } = await import("@/features/courier/courier-store");
    const db = await courierDatabase();
    expect(
      await Promise.all([
        db.count("snapshot"),
        db.count("outbox"),
        db.count("photos"),
        db.count("meta"),
      ]),
    ).toEqual([0, 0, 0, 0]);
  });

  it("fails closed with actionable guidance when stored ownership cannot be checked", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("storage unavailable");
      },
    });
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return Response.json({ user: user(701, "owner") });
    });
    vi.stubGlobal("fetch", fetcher);
    const { signIn } = await import("./session");

    await expect(signIn("usuario701@example.com", "password")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("almacenamiento"),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
