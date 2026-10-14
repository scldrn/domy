import { maxRecordsPerRequest, type CourierSnapshot } from "@domy/domain";
import type { CourierDb } from "./db";

/**
 * One synchronization (feature 003, research R4): send the outbox in order, upload the photos
 * whose record was acknowledged, then fetch the route and replace the snapshot. A failed step
 * stops there until the next run; nothing leaves the phone before the server acknowledges it.
 */

export class SyncError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Fetch = typeof fetch;

async function request(fetcher: Fetch, path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(path, { ...init, credentials: "include" });
  } catch {
    throw new SyncError(0, "Sin conexión.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    throw new SyncError(response.status, body?.error?.message ?? "No se pudo sincronizar.");
  }
  return response;
}

/** Sends the records of the outbox, oldest first, at most 50 per request (FR-019). */
async function sendRecords(db: CourierDb, fetcher: Fetch, now: () => Date): Promise<void> {
  for (;;) {
    const keys = await db.getAllKeys("outbox", null, maxRecordsPerRequest);
    const items = await db.getAll("outbox", null, maxRecordsPerRequest);
    const batch = items.flatMap((item, index) =>
      item.type === "record" ? [{ key: keys[index], record: item.record }] : [],
    );
    if (batch.length === 0) return;
    const response = await request(fetcher, "/api/courier/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceNow: now().toISOString(),
        records: batch.map((item) => item.record),
      }),
    });
    const { results } = (await response.json()) as { results: { id: string }[] };
    const acknowledged = new Set(results.map((result) => result.id));
    const tx = db.transaction("outbox", "readwrite");
    await Promise.all([
      ...batch
        .filter((item) => item.key !== undefined && acknowledged.has(item.record.id))
        .map((item) => tx.store.delete(item.key as number)),
      tx.done,
    ]);
    if (batch.length < maxRecordsPerRequest) return;
  }
}

/** Uploads the photos of acknowledged records; a photo the server refuses never blocks. */
async function uploadPhotos(db: CourierDb, fetcher: Fetch): Promise<void> {
  const waiting = new Set(
    (await db.getAll("outbox")).flatMap((item) => (item.type === "record" ? [item.record.id] : [])),
  );
  for (const photo of await db.getAll("photos")) {
    if (waiting.has(photo.recordId)) continue;
    try {
      await request(fetcher, `/api/courier/photos/${photo.id}`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: photo.image,
      });
    } catch (error) {
      // Too large, malformed, or unknown to the server: keeping it would block the rest, and a
      // photo problem never blocks (FR-009). A failed connection keeps it for the next run.
      const refused = error instanceof SyncError && [400, 404, 413].includes(error.status);
      if (!refused) throw error;
    }
    await db.delete("photos", photo.id);
  }
}

export async function synchronize(
  db: CourierDb,
  options: { userId: string; fetcher?: Fetch; now?: () => Date },
): Promise<CourierSnapshot> {
  const fetcher = options.fetcher ?? fetch.bind(globalThis);
  const now = options.now ?? (() => new Date());
  await sendRecords(db, fetcher, now);
  await uploadPhotos(db, fetcher);
  const response = await request(fetcher, "/api/courier/route");
  const snapshot = (await response.json()) as CourierSnapshot;
  const tx = db.transaction(["snapshot", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("snapshot").put(snapshot, "current"),
    tx.objectStore("meta").put(
      {
        userId: options.userId,
        clockOffsetMs: Date.parse(snapshot.serverTime) - now().getTime(),
        lastSyncedAt: snapshot.serverTime,
      },
      "current",
    ),
    tx.done,
  ]);
  return snapshot;
}
