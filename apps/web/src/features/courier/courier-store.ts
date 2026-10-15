import { courierSnapshot, type CourierRecordInput, type CourierSnapshot } from "@domy/domain";
import { useEffect, useSyncExternalStore } from "react";
import { setClockOffset } from "@/lib/clock";
import {
  claimCourierDb,
  courierMeta,
  courierStores,
  CourierDataError,
  openCourierDb,
  outboxItem,
  storedPhoto,
  type CourierDb,
  type Meta,
  type OutboxItem,
  type StoredPhoto,
} from "@/lib/offline/db";
import { replayRecords, saveRecord } from "@/lib/offline/outbox";
import { synchronize, SyncError } from "@/lib/offline/sync";

/**
 * What the courier app shows (feature 003, research R3, R4): the last snapshot with the
 * outbox replayed on top, and the synchronization state. One store for every courier screen.
 */

export type CourierState = {
  userId: string | null;
  /** False until the phone's database has been read once. */
  loaded: boolean;
  /** The snapshot with the records not yet sent applied, as the server will apply them. */
  view: CourierSnapshot | null;
  pendingRecords: number;
  pendingPhotos: number;
  pending: OutboxItem[];
  photos: StoredPhoto[];
  meta: Meta | null;
  sessionStatus: "active" | "expired" | "withdrawn";
  syncing: boolean;
  /** The last synchronization failed for lack of signal. */
  offline: boolean;
  /** The server's explanation when it refused the phone, such as an account not linked. */
  refusal: string | null;
};

const emptyState: CourierState = {
  userId: null,
  loaded: false,
  view: null,
  pendingRecords: 0,
  pendingPhotos: 0,
  pending: [],
  photos: [],
  meta: null,
  sessionStatus: "active",
  syncing: false,
  offline: false,
  refusal: null,
};
let state = emptyState;
const listeners = new Set<() => void>();
let database: Promise<CourierDb> | null = null;

function update(next: Partial<CourierState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function courierDatabase(): Promise<CourierDb> {
  database ??= openCourierDb();
  return database;
}

/** Identity changes and sign-out must not leave the previous person's view in memory. */
export function resetCourierState(): void {
  update(emptyState);
}

/** Reads the phone's database again and recomputes what the courier sees. */
async function reload(userId: string): Promise<void> {
  const store = await courierDatabase();
  const tx = store.transaction(courierStores);
  const [savedSnapshot, savedItems, savedPhotos, savedMeta] = await Promise.all([
    tx.objectStore("snapshot").get("current"),
    tx.objectStore("outbox").getAll(),
    tx.objectStore("photos").getAll(),
    tx.objectStore("meta").get("current"),
  ]);
  await tx.done;
  const meta = courierMeta.parse(savedMeta);
  if (meta.userId !== userId)
    throw new CourierDataError(
      "Los datos guardados pertenecen a otra cuenta. Ingresa con esa cuenta para sincronizarlos.",
    );
  const pending = savedItems.map((item) => outboxItem.parse(item));
  const records = pending.flatMap((item) => (item.type === "record" ? [item.record] : []));
  const photos = savedPhotos.map((photo) => storedPhoto.parse(photo));
  const snapshot = savedSnapshot ? courierSnapshot.parse(savedSnapshot) : null;
  // Flags follow the server's clock, also without signal (research R9).
  setClockOffset(meta.clockOffsetMs);
  update({
    userId,
    loaded: true,
    view: snapshot ? replayRecords(snapshot, records) : null,
    pendingRecords: records.length,
    pendingPhotos: photos.length,
    pending,
    photos,
    meta,
    sessionStatus: meta.sessionStatus ?? "active",
  });
}

let running: Promise<void> | null = null;
let paused = false;

/** Finish the old account's in-flight work before its cookie can change (FR-021). */
export async function pauseCourierSynchronization(): Promise<void> {
  paused = true;
  await running;
}
export function resumeCourierSynchronization(): void {
  paused = false;
}

/** Synchronizes now, once at a time; a failure leaves everything on the phone (FR-020). */
export function synchronizeNow(userId: string): Promise<void> {
  if (paused) return Promise.resolve();
  running ??= (async () => {
    update({ syncing: true });
    try {
      await synchronize(await courierDatabase(), { userId });
      update({ offline: false, refusal: null });
    } catch (error) {
      const offline = error instanceof SyncError && error.status === 0;
      update({
        offline,
        refusal: offline
          ? null
          : error instanceof SyncError || error instanceof CourierDataError
            ? error.message
            : "No pudimos sincronizar. Tus registros siguen guardados; reintentaremos cuando haya conexión.",
      });
    } finally {
      await reload(userId).catch(() => {
        update({
          loaded: true,
          view: null,
          refusal:
            "No pudimos leer los datos guardados. No los borres; comunícate con el coordinador.",
        });
      });
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
  if (paused)
    throw new CourierDataError("Espera a que termine el cambio de sesión antes de guardar.");
  const trackingNumber = state.view?.route?.stops
    .flatMap((stop) => stop.tasks)
    .find((task) => task.shipmentId === record.shipmentId)?.trackingNumber;
  await saveRecord(await courierDatabase(), record, photos, {
    userId,
    ...(trackingNumber && { trackingNumber }),
  });
  await reload(userId);
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
export function useSynchronization(userId: string | null): void {
  useEffect(() => {
    let disposed = false;
    if (!userId) {
      update({ ...emptyState, loaded: true, offline: !navigator.onLine });
      return;
    }
    const run = () => {
      if (!disposed && document.visibilityState === "visible") void synchronizeNow(userId);
    };
    void courierDatabase()
      .then(async (store) => {
        await claimCourierDb(store, userId);
        await reload(userId);
        run();
      })
      .catch((error: unknown) => {
        if (!disposed)
          update({
            loaded: true,
            view: null,
            refusal:
              error instanceof CourierDataError
                ? error.message
                : "No pudimos abrir los datos del teléfono. Comunícate con el coordinador.",
          });
      });
    const timer = window.setInterval(run, syncEveryMs);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [userId]);
}
