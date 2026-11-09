import {
  courierRecordResults,
  courierSnapshot,
  maxRecordsPerRequest,
  type CourierSnapshot,
} from "@domy/domain";
import { z } from "zod";
import {
  claimCourierDb,
  courierMeta,
  CourierDataError,
  outboxItem,
  readCourierMeta,
  storedPhoto,
  type CourierDb,
  type OutboxItem,
} from "./db";

/** One sync: records, notice acknowledgments, photos, then atomic outbox/snapshot commit (US2). */
export class SyncError extends Error {
  readonly status: number;
  readonly serverTime: string | null;
  /** The API's error code, such as `courier_not_linked`, when the server sent one. */
  readonly code: string | null;
  constructor(
    status: number,
    message: string,
    serverTime: string | null = null,
    code: string | null = null,
  ) {
    super(message);
    this.status = status;
    this.serverTime = serverTime;
    this.code = code;
  }
}

type Fetch = typeof fetch;
type Entry = { key: number; item: OutboxItem };
const errorBody = z.object({
  error: z.object({ code: z.string().optional(), message: z.string() }),
});

/** ROB-4: a stalled request fails like a lost connection instead of holding the sync forever. */
export const requestTimeoutMs = 20_000;
/** A ~200 KB photo on a weak signal needs longer (FR-009). */
export const photoTimeoutMs = 60_000;

/**
 * One request and its JSON body (null when empty), both bounded by `timeoutMs`. The race also
 * covers a fetcher that ignores its signal.
 */
async function request(
  fetcher: Fetch,
  path: string,
  init?: RequestInit,
  timeoutMs = requestTimeoutMs,
): Promise<unknown> {
  const controller = new AbortController();
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => {
      reject(new SyncError(0, "Sin conexión."));
    });
  });
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await Promise.race([exchange(fetcher, path, init, controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
  }
}

async function exchange(
  fetcher: Fetch,
  path: string,
  init: RequestInit | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(path, { ...init, credentials: "include", signal });
  } catch {
    throw new SyncError(0, "Sin conexión.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBody.safeParse(body);
    throw new SyncError(
      response.status,
      parsed.success
        ? parsed.data.error.message
        : "No se pudo sincronizar. Tus registros siguen guardados.",
      response.headers.get("date"),
      parsed.success ? (parsed.data.error.code ?? null) : null,
    );
  }
  return body;
}

/** Cursor keys and values belong to one read transaction, including items added during a sync. */
async function entries(db: CourierDb): Promise<Entry[]> {
  const tx = db.transaction("outbox");
  const result: Entry[] = [];
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const parsed = outboxItem.safeParse(cursor.value);
    if (!parsed.success)
      throw new CourierDataError(
        "Un registro guardado no se pudo leer. No lo borres; comunícate con el coordinador.",
      );
    result.push({ key: cursor.key, item: parsed.data });
    cursor = await cursor.continue();
  }
  await tx.done;
  return result;
}

async function sendRecords(
  db: CourierDb,
  fetcher: Fetch,
  now: () => Date,
  accepted: Set<number>,
): Promise<void> {
  for (;;) {
    const batch = (await entries(db))
      .flatMap(({ key, item }) =>
        item.type === "record" && !accepted.has(key) ? [{ key, record: item.record }] : [],
      )
      .slice(0, maxRecordsPerRequest);
    if (batch.length === 0) return;
    const body = await request(fetcher, "/api/courier/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceNow: now().toISOString(),
        records: batch.map((entry) => entry.record),
      }),
    });
    const parsed = courierRecordResults.safeParse(body);
    if (!parsed.success)
      throw new SyncError(
        502,
        "El servidor no confirmó tus registros. Siguen guardados en el teléfono.",
      );
    const acknowledged = new Set(parsed.data.results.map((entry) => entry.id));
    for (const entry of batch) if (acknowledged.has(entry.record.id)) accepted.add(entry.key);
    // A partial/empty answer is retried on the next trigger, never in an unbounded loop.
    if (batch.some((entry) => !accepted.has(entry.key))) return;
  }
}

async function sendAcknowledgments(
  db: CourierDb,
  fetcher: Fetch,
  accepted: Set<number>,
): Promise<void> {
  const pending = await entries(db);
  if (pending.some(({ key, item }) => item.type === "record" && !accepted.has(key))) return;
  for (const { key, item } of pending) {
    if (item.type !== "acknowledgment") continue;
    await request(fetcher, "/api/courier/notices/acknowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionId: item.actionId,
        noticeIds: item.noticeIds,
        occurredAt: item.occurredAt,
      }),
    });
    accepted.add(key);
  }
}

/**
 * A photo problem never blocks a record or the route refresh (FR-009, ROB-2): a refused (400,
 * 404, 413) or failed (network, timeout, 5xx) upload stays on the phone for a later sync and
 * is reported after the snapshot and outbox are committed. Only an ended session (401, 403)
 * stops the sync. A 409 is not an acknowledgment of the local image: preserve its bytes and
 * report the conflict after refreshing the route, just like other upload refusals.
 */
async function uploadPhotos(
  db: CourierDb,
  fetcher: Fetch,
  accepted: Set<number>,
): Promise<SyncError | null> {
  const waiting = new Set(
    (await entries(db)).flatMap(({ key, item }) =>
      item.type === "record" && !accepted.has(key) ? [item.record.id] : [],
    ),
  );
  let failure: SyncError | null = null;
  for (const value of await db.getAll("photos")) {
    const parsed = storedPhoto.safeParse(value);
    if (!parsed.success)
      throw new CourierDataError(
        "Una foto guardada no se pudo leer. No la borres; comunícate con el coordinador.",
      );
    const photo = parsed.data;
    if (waiting.has(photo.recordId)) continue;
    try {
      await request(
        fetcher,
        `/api/courier/photos/${photo.id}`,
        { method: "PUT", headers: { "content-type": "image/jpeg" }, body: photo.image },
        photoTimeoutMs,
      );
    } catch (error) {
      if (!(error instanceof SyncError) || error.status === 401 || error.status === 403)
        throw error;
      failure ??= error;
      // Without a connection the next photos would only wait out their own timeouts.
      if (error.status === 0) break;
      continue;
    }
    await db.delete("photos", photo.id);
  }
  return failure;
}

/** Expiry keeps the route; withdrawal removes it, while neither removes pending work (FR-004). */
export async function refuseCourierSession(
  db: CourierDb,
  options: { userId: string; now: () => Date; serverTime?: string | null; status?: 401 | 403 },
): Promise<void> {
  const meta = await readCourierMeta(db);
  if (!meta || meta.userId !== options.userId) return;
  // A malformed stored snapshot cannot lend authority to one valid-looking field (T098).
  const stored = courierSnapshot.safeParse(await db.get("snapshot", "current"));
  const known = meta.sessionExpiresAt ?? (stored.success ? stored.data.sessionExpiresAt : null);
  const receivedTime = Date.parse(options.serverTime ?? "");
  const time = Number.isFinite(receivedTime)
    ? receivedTime
    : options.now().getTime() + meta.clockOffsetMs;
  const withdrawn = options.status === 403 || !known || time < Date.parse(known);
  const tx = db.transaction(["meta", "snapshot"], "readwrite");
  try {
    const value = await tx.objectStore("meta").get("current");
    const current = value ? courierMeta.parse(value) : null;
    if (current?.userId === options.userId) {
      await tx.objectStore("meta").put(
        {
          ...current,
          sessionStatus: withdrawn ? "withdrawn" : "expired",
          sessionExpiresAt: known,
          ...(Number.isFinite(receivedTime) && {
            clockOffsetMs: receivedTime - options.now().getTime(),
          }),
        },
        "current",
      );
      if (withdrawn) await tx.objectStore("snapshot").clear();
    }
    await tx.done;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function synchronize(
  db: CourierDb,
  options: { userId: string; fetcher?: Fetch; now?: () => Date },
): Promise<CourierSnapshot> {
  const fetcher = options.fetcher ?? fetch.bind(globalThis);
  const now = options.now ?? (() => new Date());
  await claimCourierDb(db, options.userId);
  try {
    const accepted = new Set<number>();
    await sendRecords(db, fetcher, now, accepted);
    await sendAcknowledgments(db, fetcher, accepted);
    const photoFailure = await uploadPhotos(db, fetcher, accepted);
    const parsed = courierSnapshot.safeParse(await request(fetcher, "/api/courier/route"));
    if (!parsed.success)
      throw new SyncError(
        502,
        "No pudimos cargar la ruta actualizada. Tus registros siguen guardados; reintentaremos la sincronización.",
      );
    const snapshot = parsed.data;
    const tx = db.transaction(["snapshot", "meta", "outbox"], "readwrite");
    try {
      const meta = courierMeta.parse(await tx.objectStore("meta").get("current"));
      if (meta.userId !== options.userId)
        throw new CourierDataError(
          "La cuenta cambió durante la sincronización. Tus registros siguen guardados.",
        );
      await Promise.all([
        tx.objectStore("snapshot").put(snapshot, "current"),
        tx.objectStore("meta").put(
          {
            ...meta,
            clockOffsetMs: Date.parse(snapshot.serverTime) - now().getTime(),
            lastSyncedAt: snapshot.serverTime,
            sessionStatus: "active",
            sessionExpiresAt: snapshot.sessionExpiresAt,
          },
          "current",
        ),
        ...[...accepted].map((key) => tx.objectStore("outbox").delete(key)),
      ]);
      await tx.done;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw error;
    }
    if (photoFailure) throw photoFailure;
    return snapshot;
  } catch (error) {
    if (error instanceof SyncError && (error.status === 401 || error.status === 403))
      await refuseCourierSession(db, {
        userId: options.userId,
        now,
        serverTime: error.serverTime,
        status: error.status,
      });
    throw error;
  }
}
