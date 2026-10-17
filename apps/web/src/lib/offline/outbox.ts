import {
  resolveCourierRecord,
  courierRecordInput,
  noticeAcknowledgeInput,
  maxNoticesPerAcknowledgment,
  daySummary,
  routeProgress,
  type SummaryRecord,
  type NoticeAcknowledgeInput,
  type CourierRecordInput,
  type CourierSnapshot,
  type CourierTask,
  type ShipmentForRecord,
} from "@domy/domain";
import {
  bindCourierIdentity,
  courierStores,
  outboxItem,
  storedPhoto,
  type CourierDb,
  type StoredPhoto,
} from "./db";

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
  identity?: { userId: string; trackingNumber?: string },
): Promise<void> {
  const input = courierRecordInput.parse(record);
  const images = photos.map((photo) => storedPhoto.parse(photo));
  const tx = db.transaction(courierStores, "readwrite");
  const requests: Promise<unknown>[] = [tx.done];
  try {
    if (identity) await bindCourierIdentity(tx, identity.userId);
    requests.push(
      tx.objectStore("outbox").add({
        type: "record",
        record: input,
        ...(identity?.trackingNumber && { trackingNumber: identity.trackingNumber }),
      }),
    );
    for (const photo of images) requests.push(tx.objectStore("photos").put(photo));
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
  const items = (await db.getAll("outbox")).map((item) => outboxItem.parse(item));
  return items.flatMap((item) => (item.type === "record" ? [item.record] : []));
}

/** FR-018/FR-027: "Entendido" is persisted under the same account guard as a record. */
export async function saveAcknowledgment(
  db: CourierDb,
  input: NoticeAcknowledgeInput,
  userId: string,
): Promise<void> {
  const batches = [];
  // One click owns every shown notice; transport-sized chunks share one atomic local write.
  for (
    let offset = 0;
    offset < Math.max(1, input.noticeIds.length);
    offset += maxNoticesPerAcknowledgment
  ) {
    batches.push(
      noticeAcknowledgeInput.parse({
        ...input,
        actionId: offset === 0 ? input.actionId : crypto.randomUUID(),
        noticeIds: input.noticeIds.slice(offset, offset + maxNoticesPerAcknowledgment),
      }),
    );
  }
  const tx = db.transaction(courierStores, "readwrite");
  const done = tx.done;
  void done.catch(() => undefined);
  try {
    await bindCourierIdentity(tx, userId);
    for (const batch of batches)
      await tx.objectStore("outbox").add({ type: "acknowledgment", ...batch });
    await done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* The failed transaction may already have ended. */
    }
    throw error;
  }
}

/** The phone stands in for its courier: the route in the snapshot is theirs. */
const me = "courier";

/** A shipment of the route as the record rules see it, from what the phone knows. */
export function shipmentOnRoute(
  route: NonNullable<CourierSnapshot["route"]>,
  tasks: CourierTask[],
  applied: ShipmentForRecord["appliedRecords"],
): ShipmentForRecord {
  const [first] = tasks;
  if (!first) throw new Error("A shipment of the route has tasks");
  const blocked = tasks.find((task) => task.blockedByHandover)?.blockedByHandover ?? null;
  const pending = tasks.filter((task) => task.status === "pending");
  // T060/FR-041: a decided return stays in exception even before its office pickup.
  const heldAtOffice =
    pending.some((task) => task.kind === "pickup") &&
    pending.some((task) => task.kind === "return");
  const held = ["picked_up", "exception"].includes(first.shipmentStatus);
  return {
    kind: first.shipmentKind,
    status: first.shipmentStatus,
    // Until the handover is confirmed, another courier holds the package (FR-025).
    custodyCourierId: held && !blocked && !heldAtOffice ? me : null,
    heldAtOffice,
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
  acknowledgedNoticeIds: string[] = [],
  day: { date: string; clockOffsetMs: number } = { date: snapshot.summary.date, clockOffsetMs: 0 },
): CourierSnapshot {
  const state = structuredClone(snapshot);
  state.notices = state.notices.filter((notice) => !acknowledgedNoticeIds.includes(notice.id));
  const route = state.route;
  const summaryRecords: SummaryRecord[] = [];
  const applied = new Map<string, ShipmentForRecord["appliedRecords"]>();
  for (const record of records) {
    const tasks = (route?.stops ?? [])
      .flatMap((stop) => stop.tasks)
      .filter((task) => task.shipmentId === record.shipmentId);
    const before = applied.get(record.shipmentId) ?? [];
    const held = state.heldOffRoute.find((shipment) => shipment.shipmentId === record.shipmentId);
    const shipment: ShipmentForRecord | null =
      route && tasks.length > 0
        ? shipmentOnRoute(route, tasks, before)
        : held && record.kind === "disbursement"
          ? {
              kind: "delivery",
              status: held.status,
              custodyCourierId: me,
              heldAtOffice: false,
              returnDecided: held.returnDecided,
              route: null,
              pendingTasks: [],
              pendingHandover: null,
              appliedRecords: before,
            }
          : null;
    if (!shipment) continue;
    const resolution = resolveCourierRecord(shipment, {
      kind: record.kind,
      courierId: me,
    });
    if (resolution.outcome !== "applied") continue;
    // US7/FR-037: totals share precisely the route replay's applied outcomes, not inputs.
    summaryRecords.push({
      kind: record.kind,
      outcome: resolution.outcome,
      reverted: false,
      occurredAt: new Date(Date.parse(record.occurredAt) + day.clockOffsetMs),
      cashAmount: record.kind === "delivery" ? record.cashAmount : 0,
      companyTransferAmount: record.kind === "delivery" ? record.companyTransferAmount : 0,
      merchantTransferAmount: record.kind === "delivery" ? record.merchantTransferAmount : 0,
      disbursementAmount: record.kind === "disbursement" ? record.amount : 0,
    });
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
  const progress = routeProgress(route?.stops ?? []);
  state.summary = daySummary(
    summaryRecords,
    {
      date: day.date,
      pendingStops: progress.total - progress.completed,
    },
    snapshot.summary,
  );
  return state;
}
