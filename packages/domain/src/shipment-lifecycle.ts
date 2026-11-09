import type { ShipmentKind } from "./schemas/enums.ts";
import type { ExceptionDecisionInput } from "./schemas/courier.ts";
import type { CourierRecordKind, RecordOutcome } from "./courier-records.ts";
import type { RouteStatus, StopKind } from "./routes.ts";
import type { ShipmentEvent } from "./schemas/shipment.ts";

/**
 * The shared shipment lifecycle (data-model.md of feature 001, completed by features 002 and
 * 003). Every status change in the system goes through this table.
 */
export const shipmentStatuses = [
  "registered",
  "assigned",
  "dispatched",
  "picked_up",
  "delivered",
  "exception",
  "returned",
  "voided",
] as const;

export type ShipmentStatus = (typeof shipmentStatuses)[number];

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  registered: "Registrado",
  assigned: "Asignado",
  dispatched: "En ruta",
  picked_up: "Recogido",
  delivered: "Entregado",
  exception: "Novedad",
  returned: "Devuelto",
  voided: "Anulado",
};

const transitions: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  registered: ["assigned", "dispatched", "picked_up", "voided"],
  assigned: ["registered", "dispatched", "picked_up", "voided"],
  dispatched: ["registered", "assigned", "picked_up", "delivered", "voided"],
  picked_up: ["delivered", "exception"],
  delivered: ["picked_up"],
  exception: ["picked_up", "registered", "returned"],
  returned: ["exception"],
  voided: [],
};

const editableStatuses: readonly ShipmentStatus[] = ["registered", "assigned", "dispatched"];
/** The statuses no operation leaves, except a correction or revert (DESIGN-2). */
export const finalStatuses = [
  "delivered",
  "returned",
  "voided",
] as const satisfies readonly ShipmentStatus[];

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return transitions[from].includes(to);
}

/** A shipment can be edited until it is picked up (FR-015). */
export function isEditable(status: ShipmentStatus): boolean {
  return editableStatuses.includes(status);
}

export function isFinal(status: ShipmentStatus): boolean {
  return (finalStatuses as readonly ShipmentStatus[]).includes(status);
}

export function canVoid(status: ShipmentStatus): boolean {
  return canTransition(status, "voided");
}

/** FR-035 / A2: metadata edits do not rewind operations; custody and dispatch decisions do. */
export function blocksRecordRevert(type: ShipmentEvent["type"]): boolean {
  return (
    [
      "status_changed",
      "reassigned",
      "handover_confirmed",
      "handover_cancelled",
      "exception_decided",
      "office_received",
      "record_reverted",
      "voided",
    ] as readonly ShipmentEvent["type"][]
  ).includes(type);
}

/** 003 FR-035, owner clarifications A1/A2: reverting is contextual, never a route transition. */
export function recordRevertState(
  state: {
    kind: ShipmentKind;
    status: ShipmentStatus;
    custodyCourierId: string | null;
    heldAtOffice: boolean;
  },
  record: {
    kind: CourierRecordKind;
    courierId: string;
    routeId: string | null;
    outcome: RecordOutcome;
    reverted: boolean;
    isLatest: boolean;
    hasLaterOperation: boolean;
  },
  route: { id: string; status: RouteStatus; courierId: string | null } | null,
): {
  status: ShipmentStatus;
  routeId: string | null;
  custodyCourierId: string | null;
  heldAtOffice: false;
  returnDecided: boolean;
  taskKind: StopKind;
} | null {
  if (record.outcome !== "applied" || record.reverted || !record.isLatest) return null;
  const expected =
    record.kind === "delivery"
      ? "delivered"
      : record.kind === "exception"
        ? "exception"
        : record.kind === "return"
          ? "returned"
          : null;
  if (!expected || state.status !== expected) return null;
  const routeId =
    route?.id === record.routeId &&
    route.status === "in_progress" &&
    route.courierId === record.courierId
      ? route.id
      : null;
  if (state.kind === "errand") {
    if (record.kind !== "delivery") return null;
    return {
      status: routeId ? "dispatched" : "registered",
      routeId,
      custodyCourierId: null,
      heldAtOffice: false,
      returnDecided: false,
      taskKind: "errand",
    };
  }
  if (
    record.hasLaterOperation ||
    state.heldAtOffice ||
    (state.custodyCourierId !== null && state.custodyCourierId !== record.courierId)
  )
    return null;
  return {
    status: record.kind === "return" ? "exception" : "picked_up",
    routeId,
    custodyCourierId: record.courierId,
    heldAtOffice: false,
    returnDecided: record.kind === "return",
    taskKind: record.kind === "return" ? "return" : "delivery",
  };
}

/** 003 FR-041: only office receipt may register a picked-up package, and only off route. */
export function officeReceiptStatus(state: {
  status: ShipmentStatus;
  routeId: string | null;
  custodyCourierId: string | null;
}): ShipmentStatus | null {
  if (!state.custodyCourierId) return null;
  if (state.status === "exception") return "exception";
  return state.status === "picked_up" && state.routeId === null ? "registered" : null;
}

/** Packages routed without another merchant pickup (003 FR-029/FR-031). */
export function isHeldForRouting(state: {
  status: ShipmentStatus;
  returnDecided: boolean;
}): boolean {
  return state.status === "picked_up" || (state.status === "exception" && state.returnDecided);
}

/** 003 FR-029/FR-041: declare the decision transition once, independently of storage. */
export function exceptionDecisionState(
  state: {
    status: ShipmentStatus;
    heldAtOffice: boolean;
    returnDecided: boolean;
    serviceDate: string;
  },
  input: ExceptionDecisionInput,
  today: string,
): {
  status: ShipmentStatus;
  returnDecided: boolean;
  serviceDate: string;
  routeId: string | null;
} | null {
  if (state.status !== "exception" || (state.returnDecided && input.decision !== "new_attempt"))
    return null;
  if (input.decision === "return")
    return {
      status: "exception",
      returnDecided: true,
      serviceDate: state.serviceDate,
      routeId: input.routeId ?? null,
    };
  const status = state.heldAtOffice ? "registered" : "picked_up";
  if (!canTransition(state.status, status)) return null;
  const serviceDate = input.serviceDate ?? today;
  return {
    status,
    returnDecided: false,
    serviceDate,
    routeId: serviceDate > today ? null : (input.routeId ?? null),
  };
}
