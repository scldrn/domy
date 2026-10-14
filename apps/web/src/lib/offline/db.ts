import type { CourierRecordInput, CourierSnapshot, PhotoKind } from "@domy/domain";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * The courier app's data on the phone (feature 003, data-model.md §Data on the phone, research
 * R3): what the courier needs without signal, and everything not yet acknowledged by the
 * server.
 */

/** An item waiting to be sent: records first, then notice acknowledgments (FR-018, FR-027). */
export type OutboxItem =
  | { type: "record"; record: CourierRecordInput }
  | { type: "acknowledgment"; actionId: string; noticeIds: string[]; occurredAt: string };

/** A compressed photo waiting for its record to be acknowledged (research R6). */
export type StoredPhoto = { id: string; recordId: string; kind: PhotoKind; image: Blob };

export type Meta = {
  /** The user the outbox belongs to: another user cannot sign in while it is not empty. */
  userId: string;
  /** Server time minus phone time, from the `Date` header (research R7, R9). */
  clockOffsetMs: number;
  lastSyncedAt: string | null;
};

export interface CourierDbSchema extends DBSchema {
  /** The last `GET /api/courier/route`, under the key "current". */
  snapshot: { key: "current"; value: CourierSnapshot };
  /** Auto-incremented keys keep the order in which items were saved. */
  outbox: { key: number; value: OutboxItem };
  photos: { key: string; value: StoredPhoto; indexes: { byRecord: string } };
  meta: { key: "current"; value: Meta };
}

export type CourierDb = IDBPDatabase<CourierDbSchema>;

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
