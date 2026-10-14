import {
  resolveCourierRecord,
  type CourierRecordInput,
  type CourierSnapshot,
  type CourierTask,
  type ShipmentForRecord,
} from "@domy/domain";
import type { CourierDb, StoredPhoto } from "./db";

/**
 * The courier's records on the phone (feature 003, research R3, R5): saved before any network
 * call (FR-018), and replayed over the last snapshot with the rules the server uses, so each
 * result shows at once and matches what the server will compute.
 */

/** Saves a record and its photos together: both are kept, or neither (Constitution II). */
export async function saveRecord(
  db: CourierDb,
  record: CourierRecordInput,
  photos: StoredPhoto[] = [],
): Promise<void> {
  const tx = db.transaction(["outbox", "photos"], "readwrite");
  const requests: Promise<unknown>[] = [tx.done];
  try {
    requests.push(tx.objectStore("outbox").add({ type: "record", record }));
    for (const photo of photos) requests.push(tx.objectStore("photos").put(photo));
  } catch (error) {
    // A request refused outright (an invalid photo) does not end the transaction by itself.
    for (const request of requests) request.catch(() => undefined);
    tx.abort();
    throw error;
  }
  await Promise.all(requests);
}

/** The records not yet acknowledged by the server, in the order they were saved. */
export async function pendingRecords(db: CourierDb): Promise<CourierRecordInput[]> {
  const items = await db.getAll("outbox");
  return items.flatMap((item) => (item.type === "record" ? [item.record] : []));
}

/** The phone stands in for its courier: the route in the snapshot is theirs. */
const me = "courier";

/** A shipment of the route as the record rules see it, from what the phone knows. */
function shipmentOnRoute(
  route: NonNullable<CourierSnapshot["route"]>,
  tasks: CourierTask[],
  applied: ShipmentForRecord["appliedRecords"],
): ShipmentForRecord {
  const [first] = tasks;
  if (!first) throw new Error("A shipment of the route has tasks");
  const blocked = tasks.find((task) => task.blockedByHandover)?.blockedByHandover ?? null;
  const pending = tasks.filter((task) => task.status === "pending");
  const held = ["picked_up", "exception"].includes(first.shipmentStatus);
  return {
    kind: first.shipmentKind,
    status: first.shipmentStatus,
    // Until the handover is confirmed, another courier holds the package (FR-025).
    custodyCourierId: held && !blocked ? me : null,
    heldAtOffice: false,
    returnDecided: pending.some((task) => task.kind === "return"),
    route: { id: route.id, status: route.status, courierId: me },
    pendingTasks: pending.map((task) => ({
      id: task.id,
      kind: task.kind,
      routeId: route.id,
      routeStatus: route.status,
      routeCourierId: me,
    })),
    pendingHandover: blocked ? { id: blocked.id, toCourierId: me, toRouteId: route.id } : null,
    appliedRecords: applied,
  };
}

/** The snapshot with the outbox's records applied in order; the snapshot is not changed. */
export function replayRecords(
  snapshot: CourierSnapshot,
  records: CourierRecordInput[],
): CourierSnapshot {
  const state = structuredClone(snapshot);
  const route = state.route;
  if (!route) return state;
  const applied = new Map<string, ShipmentForRecord["appliedRecords"]>();
  for (const record of records) {
    const tasks = route.stops
      .flatMap((stop) => stop.tasks)
      .filter((task) => task.shipmentId === record.shipmentId);
    // Records for packages off the route change nothing the phone shows.
    if (tasks.length === 0) continue;
    const before = applied.get(record.shipmentId) ?? [];
    const resolution = resolveCourierRecord(shipmentOnRoute(route, tasks, before), {
      kind: record.kind,
      courierId: me,
    });
    if (resolution.outcome !== "applied") continue;
    applied.set(record.shipmentId, [...before, { kind: record.kind, courierId: me }]);
    const { effect } = resolution;
    for (const task of tasks) {
      if (effect.status) task.shipmentStatus = effect.status;
      if (task.id === effect.completeTaskId || task.id === effect.failTaskId) {
        task.status = task.id === effect.completeTaskId ? "completed" : "failed";
        task.problemNote = null;
      }
      if (task.id === effect.problemNoteTaskId && record.kind === "problem") {
        task.problemNote = record.note;
      }
      if (effect.confirmHandoverId) task.blockedByHandover = null;
    }
  }
  return state;
}
