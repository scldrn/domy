import "fake-indexeddb/auto";
import { courierRecordsBatch, type CourierSnapshot } from "@domy/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import type { CourierDb } from "@/lib/offline/db";

const userId = "0194d9f0-0000-7000-8000-000000000900";
const time = "2026-10-01T15:00:00.000Z";
const snapshot: CourierSnapshot = {
  serverTime: time,
  sessionExpiresAt: "2026-10-31T15:00:00.000Z",
  route: null,
  heldOffRoute: [],
  handoversToGive: [],
  notices: [],
  summary: {
    date: "2026-10-01",
    deliveries: 0,
    exceptions: 0,
    returns: 0,
    pendingStops: 0,
    cash: 0,
    companyTransfer: 0,
    merchantTransfer: 0,
    disbursements: 0,
    cashToHandOver: 0,
  },
};
let store: typeof import("./courier-store");
let db: CourierDb;
beforeEach(async () => {
  vi.resetModules();
  store = await import("./courier-store");
  db = await store.courierDatabase();
  await db.put("meta", { userId, clockOffsetMs: 0, lastSyncedAt: time }, "current");
  await db.put("snapshot", structuredClone(snapshot), "current");
});
afterEach(async () => {
  await store.pauseCourierSynchronization();
  db.close();
  await deleteDB(db.name);
  vi.unstubAllGlobals();
});

/** T121/FR-020: real store, storage and transport; no timer or invented sync mock. */
describe("overlapping synchronization triggers", () => {
  it("retains a reconnect that arrives before an offline attempt finishes", async () => {
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    let requests = 0;
    const fetcher = vi.fn(async () => {
      requests++;
      if (requests === 1) {
        entered.resolve(undefined);
        await release.promise;
        throw new TypeError("controlled offline failure");
      }
      return Response.json(snapshot);
    });
    vi.stubGlobal("fetch", fetcher);
    const first = store.synchronizeNow(userId);
    await entered.promise;
    const reconnect = store.synchronizeNow(userId);
    release.resolve(undefined);
    await Promise.all([first, reconnect]);
    expect(requests).toBe(2);
  });

  it("sends a newly saved record after the running pass already read its outbox", async () => {
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    let snapshots = 0;
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      if (path === "/api/courier/records") {
        if (typeof init?.body !== "string") throw new Error("Expected a JSON record batch");
        const batch = courierRecordsBatch.parse(JSON.parse(init.body));
        sent.push(...batch.records.map((record) => record.id));
        return Response.json({
          results: batch.records.map((record) => ({ id: record.id, outcome: "applied" })),
        });
      }
      if (++snapshots === 1) {
        entered.resolve(undefined);
        await release.promise;
      }
      return Response.json(snapshot);
    });
    const first = store.synchronizeNow(userId);
    await entered.promise;
    const recordId = "0194d9f0-0000-7000-8000-000000000001";
    await store.saveCourierRecord(userId, {
      id: recordId,
      shipmentId: "0194d9f0-0000-7000-8000-000000000002",
      kind: "pickup",
      occurredAt: time,
    });
    release.resolve(undefined);
    await first;
    expect(sent).toEqual([recordId]);
    expect(await db.count("outbox")).toBe(0);
  });

  it("coalesces overlapping triggers and keeps transport serial", async () => {
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    let calls = 0;
    let active = 0;
    let peak = 0;
    vi.stubGlobal("fetch", async () => {
      peak = Math.max(peak, ++active);
      if (++calls === 1) {
        entered.resolve(undefined);
        await release.promise;
      }
      active--;
      return Response.json(snapshot);
    });
    const first = store.synchronizeNow(userId);
    await entered.promise;
    const triggers = Array.from({ length: 8 }, () => store.synchronizeNow(userId));
    release.resolve(undefined);
    await Promise.all([first, ...triggers]);
    expect(calls).toBe(2);
    expect(peak).toBe(1);
  });

  it("pause prevents a queued pass before changing the account", async () => {
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      entered.resolve(undefined);
      await release.promise;
      return Response.json(snapshot);
    });
    const first = store.synchronizeNow(userId);
    await entered.promise;
    const queued = store.synchronizeNow(userId);
    const paused = store.pauseCourierSynchronization();
    release.resolve(undefined);
    await Promise.all([first, queued, paused]);
    expect(calls).toBe(1);
    await store.synchronizeNow(userId);
    expect(calls).toBe(1);
    store.resumeCourierSynchronization();
    await store.synchronizeNow(userId);
    expect(calls).toBe(2);
  });

  it("does not retry a failure without another trigger", async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError("controlled offline failure")));
    vi.stubGlobal("fetch", fetcher);
    await store.synchronizeNow(userId);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("stops after the coalesced pass fails too, without creating a retry loop", async () => {
    const entered = Promise.withResolvers<undefined>();
    const release = Promise.withResolvers<undefined>();
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      if (++calls === 1) {
        entered.resolve(undefined);
        await release.promise;
      }
      throw new TypeError("controlled offline failure");
    });
    const first = store.synchronizeNow(userId);
    await entered.promise;
    const queued = store.synchronizeNow(userId);
    release.resolve(undefined);
    await Promise.all([first, queued]);
    expect(calls).toBe(2);
  });
});
