import type { ShipmentKind } from "./schemas/enums.ts";

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
const finalStatuses: readonly ShipmentStatus[] = ["delivered", "returned", "voided"];

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return transitions[from].includes(to);
}

/**
 * A transition for a given shipment (feature 003): only an errand, which has no pickup, is
 * delivered straight from "En ruta"; every other kind is picked up first (FR-007).
 */
export function canChangeStatus(
  shipment: { kind: ShipmentKind; status: ShipmentStatus },
  to: ShipmentStatus,
): boolean {
  if (shipment.status === "dispatched" && to === "delivered") return shipment.kind === "errand";
  return canTransition(shipment.status, to);
}

/** A shipment can be edited until it is picked up (FR-015). */
export function isEditable(status: ShipmentStatus): boolean {
  return editableStatuses.includes(status);
}

export function isFinal(status: ShipmentStatus): boolean {
  return finalStatuses.includes(status);
}

export function canVoid(status: ShipmentStatus): boolean {
  return canTransition(status, "voided");
}
