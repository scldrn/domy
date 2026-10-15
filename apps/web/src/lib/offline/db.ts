import {
  courierRecordInput,
  noticeAcknowledgeInput,
  photoKinds,
  type CourierSnapshot,
} from "@domy/domain";
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import { z } from "zod";

/**
 * The courier app's data on the phone (feature 003, data-model.md §Data on the phone, research
 * R3): what the courier needs without signal, and everything not yet acknowledged by the
 * server.
 */

/** An item waiting to be sent: records first, then notice acknowledgments (FR-018, FR-027). */
export const outboxItem = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("record"),
    record: courierRecordInput,
    trackingNumber: z.string().optional(),
  }),
  noticeAcknowledgeInput.extend({ type: z.literal("acknowledgment") }),
]);
export type OutboxItem = z.output<typeof outboxItem>;

/** A compressed photo waiting for its record to be acknowledged (research R6). */
export const storedPhoto = z.object({
  id: z.uuid(),
  recordId: z.uuid(),
  kind: z.enum(photoKinds),
  image: z.instanceof(Blob),
});
export type StoredPhoto = z.output<typeof storedPhoto>;

export const courierMeta = z.object({
  /** The user the outbox belongs to: another user cannot sign in while it is not empty. */
  userId: z.uuid(),
  /** Server time minus phone time, from the `Date` header (research R7, R9). */
  clockOffsetMs: z.number(),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  sessionStatus: z.enum(["active", "expired", "withdrawn"]).optional(),
  sessionExpiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type Meta = z.output<typeof courierMeta>;

export interface CourierDbSchema extends DBSchema {
  /** The last `GET /api/courier/route`, under the key "current". */
  snapshot: { key: "current"; value: CourierSnapshot };
  /** Auto-incremented keys keep the order in which items were saved. */
  outbox: { key: number; value: OutboxItem };
  photos: { key: string; value: StoredPhoto; indexes: { byRecord: string } };
  meta: { key: "current"; value: Meta };
}

export type CourierDb = IDBPDatabase<CourierDbSchema>;

export const courierStores = ["snapshot", "outbox", "photos", "meta"] as const;
export type CourierTransaction = IDBPTransaction<
  CourierDbSchema,
  typeof courierStores,
  "readwrite"
>;

export class CourierDataError extends Error {
  readonly status = 409;
}

/** Reads persisted identity defensively; unknown ownership never authorizes sending (FR-021). */
export async function readCourierMeta(db: CourierDb): Promise<Meta | undefined> {
  const value = await db.get("meta", "current");
  if (!value) return undefined;
  const parsed = courierMeta.safeParse(value);
  if (!parsed.success)
    throw new CourierDataError(
      "No pudimos verificar la cuenta guardada en este teléfono. Tus registros siguen guardados; comunícate con el coordinador.",
    );
  return parsed.data;
}

/** Ownership and pending items are checked within the same transaction as a save (FR-021). */
export async function bindCourierIdentity(tx: CourierTransaction, userId: string): Promise<Meta> {
  const [value, records, photos] = await Promise.all([
    tx.objectStore("meta").get("current"),
    tx.objectStore("outbox").count(),
    tx.objectStore("photos").count(),
  ]);
  const parsed = value ? courierMeta.safeParse(value) : null;
  if (parsed && !parsed.success)
    throw new CourierDataError(
      "No pudimos verificar la cuenta guardada. Tus registros siguen en el teléfono; comunícate con el coordinador.",
    );
  const meta = parsed?.data;
  if (meta?.userId === userId) return meta;
  if (records > 0 || photos > 0) {
    throw new CourierDataError(
      meta
        ? "Los registros o fotos pendientes pertenecen a otra cuenta. Ingresa con esa cuenta para sincronizarlos."
        : "No pudimos verificar a qué cuenta pertenecen los registros pendientes. No los borres; comunícate con el coordinador.",
    );
  }
  const next = courierMeta.parse({
    userId,
    clockOffsetMs: 0,
    lastSyncedAt: null,
    sessionStatus: "active",
    sessionExpiresAt: null,
  });
  await Promise.all([
    tx.objectStore("snapshot").clear(),
    tx.objectStore("meta").put(next, "current"),
  ]);
  return next;
}

export async function claimCourierDb(db: CourierDb, userId: string): Promise<Meta> {
  const tx = db.transaction(courierStores, "readwrite");
  try {
    const meta = await bindCourierIdentity(tx, userId);
    await tx.done;
    return meta;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw error;
  }
}

/** Sign-out never clears pending records or photos (FR-004, FR-020). */
export async function clearCourierDb(db: CourierDb): Promise<void> {
  const tx = db.transaction(courierStores, "readwrite");
  try {
    const [records, photos] = await Promise.all([
      tx.objectStore("outbox").count(),
      tx.objectStore("photos").count(),
    ]);
    if (records > 0 || photos > 0)
      throw new CourierDataError(
        "Tienes registros o fotos pendientes por sincronizar. Espera a que lleguen antes de cerrar sesión.",
      );
    await Promise.all(courierStores.map((store) => tx.objectStore(store).clear()));
    await tx.done;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export function openCourierDb(name = "domy-mensajero"): Promise<CourierDb> {
  return openDB<CourierDbSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore("snapshot");
      db.createObjectStore("outbox", { autoIncrement: true });
      db.createObjectStore("photos", { keyPath: "id" }).createIndex("byRecord", "recordId");
      db.createObjectStore("meta");
    },
  });
}
