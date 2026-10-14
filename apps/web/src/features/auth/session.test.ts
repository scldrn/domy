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
