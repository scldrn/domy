import type { ShipmentStatus } from "./shipment-lifecycle.ts";

/** "En riesgo" with minutes remaining, or "Atrasado" with minutes overdue (FR-022). */
export type ShipmentFlag = { kind: "at_risk" | "late"; minutes: number };
export type ShipmentFlagKind = ShipmentFlag["kind"];

const flaggable: ReadonlySet<ShipmentStatus> = new Set([
  "registered",
  "assigned",
  "dispatched",
  "picked_up",
  "exception",
]);
const atRiskMinutes = 45;
const minuteMs = 60 * 1000;
const dayMinutes = 24 * 60;

export function shipmentFlag(
  shipment: { status: ShipmentStatus; windowEnd: Date | null },
  now: Date,
): ShipmentFlag | null {
  if (!shipment.windowEnd || !flaggable.has(shipment.status)) return null;
  const overdueMs = now.getTime() - shipment.windowEnd.getTime();
  if (overdueMs >= 0) return { kind: "late", minutes: Math.floor(overdueMs / minuteMs) };
  const minutes = Math.ceil(-overdueMs / minuteMs);
  return minutes <= atRiskMinutes ? { kind: "at_risk", minutes } : null;
}

export const shipmentFlagLabels: Record<ShipmentFlagKind, string> = {
  at_risk: "En riesgo",
  late: "Atrasado",
};

/** "17 min", "1 h 5 min", "2 días": how long a flag or a wait has lasted. */
export function formatDuration(minutes: number): string {
  if (minutes > dayMinutes) {
    const days = Math.floor(minutes / dayMinutes);
    return days === 1 ? "1 día" : `${String(days)} días`;
  }
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = `${String(Math.floor(minutes / 60))} h`;
  return minutes % 60 === 0 ? hours : `${hours} ${String(minutes % 60)} min`;
}

export function flagLabel(flag: ShipmentFlag): string {
  const time = formatDuration(flag.minutes);
  return `${shipmentFlagLabels[flag.kind]} · ${flag.kind === "at_risk" ? `quedan ${time}` : time}`;
}

/** The flags of a shipment's courier records (feature 003, FR-033, research R11). */
export const recordFlagKinds = [
  "no_photo",
  "photo_pending",
  "collection_differs",
  "pickup_problem",
  "needs_review",
] as const;
export type RecordFlagKind = (typeof recordFlagKinds)[number];
export const recordFlagLabels: Record<RecordFlagKind, string> = {
  no_photo: "Sin foto",
  photo_pending: "Foto pendiente",
  collection_differs: "Recaudo diferente",
  pickup_problem: "Problema de recogida",
  needs_review: "Por revisar",
};

/** A photo that has not arrived 24 hours after its record counts as missing (FR-023). */
const photoWaitMs = 24 * 60 * 60 * 1000;

/** True until the record has waited a full 24 hours for its photo metadata (FR-023). */
export function isWithinPhotoWait(recordedAt: Date, now: Date): boolean {
  return now.getTime() - recordedAt.getTime() < photoWaitMs;
}

export function recordFlags(
  input: {
    /** The latest applied delivery, return, or completed errand, with its proof photos. */
    proof: { recordedAt: Date; photos: { uploaded: boolean }[] } | null;
    /** The collected total of that delivery against the COD amount. */
    collection: { total: number; codAmount: number } | null;
    pickupProblem: boolean;
    needsReview: boolean;
    /** Other photos of the shipment's records still on their way, within 24 hours. */
    pendingPhotos?: number;
  },
  now: Date,
): RecordFlagKind[] {
  const flags: RecordFlagKind[] = [];
  if (input.proof) {
    const waiting = isWithinPhotoWait(input.proof.recordedAt, now);
    const arrived = input.proof.photos.some((photo) => photo.uploaded);
    const onTheWay = waiting && input.proof.photos.some((photo) => !photo.uploaded);
    if (onTheWay || (input.pendingPhotos ?? 0) > 0) flags.push("photo_pending");
    else if (!arrived) flags.push("no_photo");
  } else if ((input.pendingPhotos ?? 0) > 0) {
    flags.push("photo_pending");
  }
  if (input.collection && input.collection.total !== input.collection.codAmount) {
    flags.push("collection_differs");
  }
  if (input.pickupProblem) flags.push("pickup_problem");
  if (input.needsReview) flags.push("needs_review");
  return flags;
}
