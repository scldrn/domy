import type { CourierRecordInput, CourierSnapshot } from "@domy/domain";
import { useEffect, useSyncExternalStore } from "react";
import { setClockOffset } from "@/lib/clock";
import { openCourierDb, type CourierDb, type StoredPhoto } from "@/lib/offline/db";
import { pendingRecords, replayRecords, saveRecord } from "@/lib/offline/outbox";
import { synchronize, SyncError } from "@/lib/offline/sync";

/**
 * What the courier app shows (feature 003, research R3, R4): the last snapshot with the
 * outbox replayed on top, and the synchronization state. One store for every courier screen.
 */

export type CourierState = {
  /** False until the phone's database has been read once. */
  loaded: boolean;
  /** The snapshot with the records not yet sent applied, as the server will apply them. */
  view: CourierSnapshot | null;
  pendingRecords: number;
  pendingPhotos: number;
  syncing: boolean;
  /** The last synchronization failed for lack of signal. */
  offline: boolean;
  /** The server's explanation when it refused the phone, such as an account not linked. */
  refusal: string | null;
};

let state: CourierState = {
  loaded: false,
  view: null,
  pendingRecords: 0,
  pendingPhotos: 0,
  syncing: false,
  offline: false,
  refusal: null,
};
const listeners = new Set<() => void>();
let database: Promise<CourierDb> | null = null;

function update(next: Partial<CourierState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function db(): Promise<CourierDb> {
  database ??= openCourierDb();
  return database;
}

/** Reads the phone's database again and recomputes what the courier sees. */
async function reload(): Promise<void> {
  const store = await db();
  const [snapshot, records, photos, meta] = await Promise.all([
    store.get("snapshot", "current"),
    pendingRecords(store),
    store.count("photos"),
    store.get("meta", "current"),
  ]);
  // Flags follow the server's clock, also without signal (research R9).
  if (meta) setClockOffset(meta.clockOffsetMs);
  update({
    loaded: true,
    view: snapshot ? replayRecords(snapshot, records) : null,
    pendingRecords: records.length,
    pendingPhotos: photos,
  });
}

let running: Promise<void> | null = null;

/** Synchronizes now, once at a time; a failure leaves everything on the phone (FR-020). */
export function synchronizeNow(userId: string): Promise<void> {
  running ??= (async () => {
    update({ syncing: true });
    try {
      await synchronize(await db(), { userId });
      update({ offline: false, refusal: null });
    } catch (error) {
      const offline = !(error instanceof SyncError) || error.status === 0;
      update({ offline, refusal: offline ? null : error.message });
    } finally {
      await reload();
      update({ syncing: false });
      running = null;
    }
  })();
  return running;
}

/**
 * Saves a record on the phone first (FR-018); it shows as done at once and is sent in the
 * background. Rejects when it could not be saved, and then nothing is shown as done.
 */
export async function saveCourierRecord(
  userId: string,
  record: CourierRecordInput,
  photos: StoredPhoto[] = [],
): Promise<void> {
  await saveRecord(await db(), record, photos);
  await reload();
  void synchronizeNow(userId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCourierState(): CourierState {
  return useSyncExternalStore(subscribe, () => state);
}

/** How often the app synchronizes while it is visible (research R4; FR-020, FR-022). */
const syncEveryMs = 30_000;

/**
 * Keeps the phone in sync while the courier app is open: at once, when the connection
 * returns, when the app becomes visible again, and every 30 seconds.
 */
export function useSynchronization(userId: string): void {
  useEffect(() => {
    void reload();
    const run = () => {
      if (document.visibilityState === "visible") void synchronizeNow(userId);
    };
    run();
    const timer = window.setInterval(run, syncEveryMs);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [userId]);
}
