import "fake-indexeddb/auto";
import { courierRecordInput, courierRecordsBatch, type CourierSnapshot } from "@domy/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCourierDb, type CourierDb, type OutboxItem } from "./db";
import { pendingRecords } from "./outbox";
import { synchronize, SyncError } from "./sync";

function pathOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

const id = (n: number) => `0194d9f0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const owner = id(900);
const time = "2026-10-01T15:00:00.000Z";
const now = () => new Date(time);
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

let db: CourierDb;
let databaseName: string;
beforeEach(async () => {
  databaseName = `domy-sync-${crypto.randomUUID()}`;
  db = await openCourierDb(databaseName);
  await db.put("meta", { userId: owner, clockOffsetMs: 0, lastSyncedAt: time }, "current");
  await db.put("snapshot", structuredClone(snapshot), "current");
});
afterEach(() => {
  db.close();
  indexedDB.deleteDatabase(databaseName);
});

function record(n: number) {
  return courierRecordInput.parse({
    id: id(n),
    shipmentId: id(800),
    kind: "pickup",
    occurredAt: time,
  });
}

async function queue(...numbers: number[]) {
  for (const n of numbers) await db.add("outbox", { type: "record", record: record(n) });
}

const json = (body: unknown) => Response.json(body);
const batch = (init?: RequestInit) =>
  courierRecordsBatch.parse(JSON.parse(typeof init?.body === "string" ? init.body : ""));
const acknowledged = (init?: RequestInit) =>
  json({ results: batch(init).records.map((entry) => ({ id: entry.id, outcome: "applied" })) });
const remaining = async () => (await pendingRecords(db)).map((entry) => entry.id);
const run = (fetcher: typeof fetch, userId = owner) => synchronize(db, { userId, now, fetcher });

/** US2 T041: real IndexedDB semantics with controlled transport and time (FR-018–FR-023). */
describe("synchronize", () => {
  it("does not trust expiry from a malformed stored snapshot when refusing a session (T098)", async () => {
    await queue(1);
    await db.put(
      "snapshot",
      { sessionExpiresAt: "2026-09-30T15:00:00Z" } as CourierSnapshot,
      "current",
    );
    const fetcher = vi.fn(() =>
      Promise.resolve(
        Response.json({ error: { message: "Inicia sesión de nuevo." } }, { status: 401 }),
      ),
    );

    await expect(run(fetcher)).rejects.toMatchObject({ status: 401 });

    expect(await db.get("snapshot", "current")).toBeUndefined();
    expect(await remaining()).toEqual([id(1)]);
    expect(await db.get("meta", "current")).toMatchObject({
      sessionStatus: "withdrawn",
      sessionExpiresAt: null,
    });
  });
  it.each(["records", "route"] as const)(
    "withdraws cached route access on a forbidden %s response without losing pending work",
    async (step) => {
      await queue(1);
      const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(
          pathOf(input).endsWith(`/${step}`)
            ? Response.json(
                { error: { message: "Tu cuenta ya no tiene acceso a esa ruta." } },
                { status: 403 },
              )
            : pathOf(input).endsWith("/records")
              ? acknowledged(init)
              : json(snapshot),
        ),
      );

      await expect(run(fetcher)).rejects.toMatchObject({ status: 403, code: null });
      expect(await db.get("snapshot", "current")).toBeUndefined();
      expect(await remaining()).toEqual([id(1)]);
      expect(await db.get("meta", "current")).toMatchObject({ sessionStatus: "withdrawn" });
    },
  );

  it("keeps the server's code on a refusal, such as an account not linked (feature 006, US4)", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        pathOf(input).endsWith("/route")
          ? Response.json(
              {
                error: {
                  code: "courier_not_linked",
                  message:
                    "Tu cuenta no está vinculada a un mensajero. Pide al propietario que la vincule.",
                },
              },
              { status: 403 },
            )
          : json(snapshot),
      ),
    );

    await expect(run(fetcher)).rejects.toMatchObject({ status: 403, code: "courier_not_linked" });
  });
  it("refuses a malformed snapshot without replacing the last usable data or removing records", async () => {
    await queue(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      return pathOf(input).endsWith("/records") ? acknowledged(init) : json({ route: null });
    });

    await expect(run(fetcher)).rejects.toThrow();
    expect(await remaining()).toEqual([id(1)]);
    expect(await db.get("snapshot", "current")).toEqual(snapshot);
  });

  it("does not treat an invalid outcome as acknowledgment", async () => {
    await queue(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      return pathOf(input).endsWith("/records")
        ? json({ results: [{ id: id(1), outcome: "unknown" }] })
        : json(snapshot);
    });

    await expect(run(fetcher)).rejects.toThrow();
    expect(await remaining()).toEqual([id(1)]);
  });
  it("sends the saved order in batches of at most 50 with deviceNow", async () => {
    const numbers = Array.from({ length: 105 }, (_, index) => index + 1);
    await queue(...numbers);
    const sent: string[][] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) {
        expect(batch(init).deviceNow).toBe(time);
        sent.push(batch(init).records.map((entry) => entry.id));
        return acknowledged(init);
      }
      return json(snapshot);
    });

    await run(fetcher);

    expect(sent.map((entries) => entries.length)).toEqual([50, 50, 5]);
    expect(sent.flat()).toEqual(numbers.map(id));
    expect(await remaining()).toEqual([]);
  });

  it("does not let acknowledgments at the front hide records beyond the first 50 items", async () => {
    for (let index = 0; index < 55; index++) {
      await db.add("outbox", {
        type: "acknowledgment",
        actionId: id(100 + index),
        noticeIds: [id(500)],
        occurredAt: time,
      });
    }
    await queue(1, 2);
    const paths: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      const path = pathOf(input);
      paths.push(path);
      if (path.endsWith("/records")) return acknowledged(init);
      if (path.endsWith("/acknowledge")) return new Response(null, { status: 204 });
      return json(snapshot);
    });

    await run(fetcher);

    expect(paths[0]).toBe("/api/courier/records");
    expect(paths.filter((path) => path.endsWith("/acknowledge"))).toHaveLength(55);
    expect(paths.at(-1)).toBe("/api/courier/route");
    expect(await db.count("outbox")).toBe(0);
  });

  it("removes only acknowledged records and never uploads an unacknowledged record's photo", async () => {
    await queue(1, 2);
    for (const n of [1, 2]) {
      await db.put("photos", {
        id: id(300 + n),
        recordId: id(n),
        kind: "proof",
        image: new Blob(["jpeg"], { type: "image/jpeg" }),
      });
    }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) {
        return json({ results: [{ id: id(1), outcome: "applied" }] });
      }
      if (pathOf(input).includes("/photos/")) return new Response(null, { status: 204 });
      return json(snapshot);
    });

    await run(fetcher);

    expect(await remaining()).toEqual([id(2)]);
    expect((await db.getAll("photos")).map((photo) => photo.id)).toEqual([id(302)]);
    expect(fetcher.mock.calls.map(([path]) => pathOf(path))).not.toContain(
      `/api/courier/photos/${id(302)}`,
    );
  });

  it("keeps acknowledged records for replay when the snapshot refresh fails", async () => {
    await queue(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) return acknowledged(init);
      throw new TypeError("response lost");
    });

    await expect(run(fetcher)).rejects.toMatchObject({ status: 0 });

    expect(await remaining()).toEqual([id(1)]);
    expect(await db.get("snapshot", "current")).toEqual(snapshot);
  });

  it("retains records and photos when a response is lost and safely replays the same ids", async () => {
    await queue(1);
    const applied = new Set<string>();
    let loseResponse = true;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) {
        for (const entry of batch(init).records) applied.add(entry.id);
        if (loseResponse) {
          loseResponse = false;
          throw new TypeError("response lost after commit");
        }
        return acknowledged(init);
      }
      return json(snapshot);
    });

    await expect(run(fetcher)).rejects.toBeInstanceOf(SyncError);
    expect(await remaining()).toEqual([id(1)]);
    await run(fetcher);
    expect(applied.size).toBe(1);
    expect(await remaining()).toEqual([]);
  });

  it.each([
    ["withdrawn", "2026-10-02T15:00:00Z", false],
    ["expired", "2026-11-01T15:00:00Z", true],
  ] as const)(
    "distinguishes a %s session using server time, retaining every pending item",
    async (status, serverTime, keepSnapshot) => {
      await queue(1);
      const fetcher = vi.fn(async () => {
        await Promise.resolve();
        return Response.json(
          { error: { message: "Inicia sesión de nuevo." } },
          { status: 401, headers: { date: new Date(serverTime).toUTCString() } },
        );
      });

      await expect(run(fetcher)).rejects.toMatchObject({ status: 401 });

      expect(await remaining()).toEqual([id(1)]);
      expect(await db.get("snapshot", "current")).toEqual(keepSnapshot ? snapshot : undefined);
      expect(await db.get("meta", "current")).toMatchObject({
        userId: owner,
        sessionStatus: status,
      });
    },
  );

  it.each(["record", "photo"] as const)(
    "refuses another account before any request when a %s is pending",
    async (pending) => {
      if (pending === "record") await queue(1);
      else
        await db.put("photos", {
          id: id(301),
          recordId: id(1),
          kind: "proof",
          image: new Blob(["jpeg"]),
        });
      const fetcher = vi.fn(async () => {
        await Promise.resolve();
        return json(snapshot);
      });

      await expect(run(fetcher, id(901))).rejects.toThrow("otra cuenta");

      expect(fetcher).not.toHaveBeenCalled();
      expect(await db.get("meta", "current")).toMatchObject({ userId: owner });
      expect(await db.get("snapshot", "current")).toEqual(snapshot);
    },
  );

  it("never assigns an ownerless non-empty outbox to the next signed-in user", async () => {
    await queue(1);
    await db.clear("meta");
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return json(snapshot);
    });

    await expect(run(fetcher)).rejects.toThrow();

    expect(fetcher).not.toHaveBeenCalled();
    expect(await remaining()).toEqual([id(1)]);
  });

  it("clears a previous account's empty snapshot before contacting the server as a new user", async () => {
    const fetcher = vi.fn(async () => {
      expect(await db.get("snapshot", "current")).toBeUndefined();
      return json(snapshot);
    });

    await run(fetcher, id(901));

    expect(await db.get("meta", "current")).toMatchObject({ userId: id(901) });
  });

  it("preserves new records added while an earlier batch is in flight", async () => {
    await queue(1);
    let first = true;
    const sent: string[][] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input).endsWith("/records")) {
        sent.push(batch(init).records.map((entry) => entry.id));
        if (first) {
          first = false;
          await queue(2);
        }
        return acknowledged(init);
      }
      return json(snapshot);
    });

    await run(fetcher);

    expect(sent).toEqual([[id(1)], [id(2)]]);
    expect(await remaining()).toEqual([]);
  });

  it("stops an unacknowledged full batch without an unbounded retry loop", async () => {
    await queue(...Array.from({ length: 50 }, (_, index) => index + 1));
    let attempts = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) {
        attempts++;
        if (attempts > 2) throw new TypeError("retry loop");
        return json({ results: [] });
      }
      return json(snapshot);
    });

    await run(fetcher);

    expect(attempts).toBe(1);
    expect(await remaining()).toHaveLength(50);
  });

  it.each([400, 404, 413])(
    "keeps an unacknowledged photo after HTTP %s without blocking other uploads or the snapshot",
    async (status) => {
      for (const n of [1, 2])
        await db.put("photos", {
          id: id(300 + n),
          recordId: id(n),
          kind: "proof",
          image: new Blob(["jpeg"]),
        });
      const fetcher = vi.fn(async (input: RequestInfo | URL) => {
        await Promise.resolve();
        if (pathOf(input).endsWith(id(301)))
          return Response.json({ error: { message: "No se pudo enviar la foto." } }, { status });
        if (pathOf(input).includes("/photos/")) return new Response(null, { status: 204 });
        return json({ ...snapshot, serverTime: "2026-10-01T15:01:00Z" });
      });

      await expect(run(fetcher)).rejects.toMatchObject({ status });

      expect((await db.getAll("photos")).map((photo) => photo.id)).toEqual([id(301)]);
      expect((await db.get("snapshot", "current"))?.serverTime).toBe("2026-10-01T15:01:00Z");
    },
  );

  it("keeps the measured clock offset and removes a finished route's data after acknowledgment", async () => {
    await queue(1);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      return pathOf(input).endsWith("/records") ? acknowledged(init) : json(snapshot);
    });

    await synchronize(db, { userId: owner, fetcher, now: () => new Date("2026-10-01T15:03:00Z") });

    expect(await db.get("meta", "current")).toMatchObject({
      userId: owner,
      clockOffsetMs: -180_000,
      lastSyncedAt: time,
    });
    expect(await db.get("snapshot", "current")).toEqual(snapshot);
    expect(await db.count("outbox")).toBe(0);
    expect(await db.count("photos")).toBe(0);
  });

  it("transports every record kind and leaves its input unchanged", async () => {
    const inputs = [
      { kind: "pickup" },
      { kind: "delivery", receivedByName: "Laura Gómez" },
      { kind: "exception", reason: "recipient_absent" },
      { kind: "problem", note: "No estaba listo" },
      { kind: "return", receivedByName: "Ana Ruiz" },
      { kind: "disbursement", amount: 5000, payee: "Coonorte" },
      { kind: "handover_confirmation" },
    ].map((input, index) => courierRecordInput.parse({ ...record(index + 1), ...input }));
    for (const input of inputs)
      await db.add("outbox", { type: "record", record: input } satisfies OutboxItem);
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      if (pathOf(input).endsWith("/records")) {
        expect(batch(init).records).toEqual(inputs);
        return acknowledged(init);
      }
      return json(snapshot);
    });

    await run(fetcher);
    expect(await db.count("outbox")).toBe(0);
  });
});

/** ROB-2/C003-2 and ROB-4: a photo or a stalled request never blocks records or the route. */
describe("synchronize robustness", () => {
  const fresh = { ...snapshot, serverTime: "2026-10-01T15:05:00.000Z" };
  async function queueWithPhoto() {
    await queue(1);
    await db.put("photos", {
      id: id(301),
      recordId: id(1),
      kind: "proof",
      image: new Blob(["jpeg"], { type: "image/jpeg" }),
    });
  }
  function photoFetcher(photo: () => Promise<Response>) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      const path = pathOf(input);
      if (path.endsWith("/records")) return acknowledged(init);
      if (path.includes("/photos/")) return photo();
      return json(fresh);
    });
  }
  const photoIds = async () => (await db.getAll("photos")).map((photo) => photo.id);
  const routeFetched = (fetcher: ReturnType<typeof photoFetcher>) =>
    fetcher.mock.calls.some(([path]) => pathOf(path).endsWith("/api/courier/route"));

  // FR-009 "a photo problem MUST never block a record"; FR-020/FR-022 the route still refreshes.
  it.each([
    ["HTTP 500", 500, () => Response.json({ error: { message: "Error." } }, { status: 500 })],
    [
      "HTTP 503 storage_unavailable",
      503,
      () =>
        Response.json(
          { error: { code: "storage_unavailable", message: "Fotos no disponibles." } },
          { status: 503 },
        ),
    ],
    [
      "a network failure",
      0,
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ] as const)(
    "W3 keeps a photo after %s for a later retry and still refreshes the route and acknowledges records",
    async (_label, status, answer) => {
      await queueWithPhoto();
      const fetcher = photoFetcher(() => Promise.resolve().then(answer));

      await expect(run(fetcher)).rejects.toMatchObject({ status });

      expect(routeFetched(fetcher)).toBe(true);
      expect((await db.get("snapshot", "current"))?.serverTime).toBe(fresh.serverTime);
      expect(await remaining()).toEqual([]);
      expect(await photoIds()).toEqual([id(301)]);
    },
  );

  // A conflict is not an acknowledgment of these bytes: retain them (Constitution II).
  it("C003-2 retains a conflicting photo while committing records and refreshing the route", async () => {
    await queueWithPhoto();
    const fetcher = photoFetcher(() =>
      Promise.resolve(
        Response.json(
          { error: { code: "photo_immutable", message: "Esta foto ya fue subida." } },
          { status: 409 },
        ),
      ),
    );

    await expect(run(fetcher)).rejects.toMatchObject({ status: 409 });

    expect(routeFetched(fetcher)).toBe(true);
    expect((await db.get("snapshot", "current"))?.serverTime).toBe(fresh.serverTime);
    expect(await remaining()).toEqual([]);
    expect(await photoIds()).toEqual([id(301)]);
  });

  describe("ROB-4 timeouts", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    /** Waits on IndexedDB's real macrotasks without moving the faked clock. */
    async function until(condition: () => boolean) {
      while (!condition())
        await new Promise((resolve) => {
          setImmediate(resolve);
        });
    }
    /** A request that never answers, but honors its abort signal as real fetch does. */
    const stalled = (init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason as Error);
        });
      });

    it("turns a records request that never answers into a network error after 20 s", async () => {
      await queue(1);
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => stalled(init));
      const outcome = run(fetcher).then(
        () => "resolved",
        (error: unknown) => error,
      );

      await until(() => fetcher.mock.calls.length > 0);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(await Promise.race([outcome, Promise.resolve("pending")])).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);

      expect(await outcome).toBeInstanceOf(SyncError);
      expect(await outcome).toMatchObject({ status: 0 });
      expect(await remaining()).toEqual([id(1)]);
    });

    it("gives up on a request that ignores its abort signal", async () => {
      await queue(1);
      const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
      const outcome = run(fetcher).then(
        () => "resolved",
        (error: unknown) => error,
      );

      await until(() => fetcher.mock.calls.length > 0);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(await Promise.race([outcome, Promise.resolve("pending")])).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);

      expect(await outcome).toMatchObject({ status: 0 });
    });

    it("waits up to 60 s for a photo upload, then keeps it and refreshes the route", async () => {
      await queueWithPhoto();
      const fetcher = photoFetcher(() => new Promise<Response>(() => undefined));
      const outcome = run(fetcher).then(
        () => "resolved",
        (error: unknown) => error,
      );

      await until(() => fetcher.mock.calls.some(([path]) => pathOf(path).includes("/photos/")));
      await vi.advanceTimersByTimeAsync(59_999);
      expect(routeFetched(fetcher)).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await outcome).toMatchObject({ status: 0 });
      expect(routeFetched(fetcher)).toBe(true);
      expect(await remaining()).toEqual([]);
      expect(await photoIds()).toEqual([id(301)]);
    });
  });
});
