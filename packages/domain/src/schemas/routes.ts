import { z } from "zod";
import type { HandoverStatus, RouteStatus, StopKind, TaskStatus } from "../routes.ts";
import type { ShipmentStatus } from "../shipment-lifecycle.ts";
import type { ShipmentSummary } from "./search.ts";
import { calendarDate, reason } from "./shipment.ts";

/**
 * Route requests (feature 002). Route creation carries the route's `id`; every other action
 * carries an `actionId` and, on an existing route, its `version` (FR-020, FR-021).
 */

const actionId = z.uuid("Falta el identificador de la acción.");
const version = z.number().int().min(1);
/** Shipments per request: far beyond any route, short of a body that strains the server. */
export const maxShipmentsPerRequest = 200;
const shipmentIds = z
  .array(z.uuid())
  .min(1, "Elige al menos un envío.")
  .max(maxShipmentsPerRequest, `Elige máximo ${String(maxShipmentsPerRequest)} envíos a la vez.`);

export const routeCreateInput = z.object({
  id: z.uuid(),
  actionId,
  serviceDate: calendarDate,
  shipmentIds,
  courierId: z.uuid().optional(),
  /** Explicit confirmation of a route beyond 15 shipments (FR-005). */
  confirmed: z.boolean().optional(),
});
export type RouteCreateInput = z.input<typeof routeCreateInput>;

/** The routes board of a date (FR-018); today when omitted. */
export const routesBoardQuery = z.object({ date: calendarDate.optional() });

export const routeActionInput = z.object({ actionId, version });
export type RouteActionInput = z.input<typeof routeActionInput>;

export const routeCourierInput = z.object({
  actionId,
  version,
  courierId: z.uuid("Elige el mensajero."),
});
export type RouteCourierInput = z.input<typeof routeCourierInput>;

export const stopOrderInput = z.object({
  actionId,
  version,
  stopIds: z
    .array(z.uuid())
    .min(1, "La ruta no tiene paradas para ordenar.")
    .max(2 * maxShipmentsPerRequest + 100, "La ruta tiene demasiadas paradas para ordenarlas."),
});
export type StopOrderInput = z.input<typeof stopOrderInput>;

export const routeAddShipmentsInput = z.object({
  actionId,
  version,
  shipmentIds,
  confirmed: z.boolean().optional(),
});
export type RouteAddShipmentsInput = z.input<typeof routeAddShipmentsInput>;

/** Undo a dispatch or cancel a route: a reason of 5–200 characters (FR-016). */
export const routeReasonInput = z.object({ actionId, version, reason });
export type RouteReasonInput = z.input<typeof routeReasonInput>;

export const routeReassignInput = z.object({
  actionId,
  version,
  courierId: z.uuid("Elige el mensajero."),
  reason,
});
export type RouteReassignInput = z.input<typeof routeReassignInput>;

/** The shipments of a route in preparation join a route in progress (FR-009, FR-011). */
export const routeJoinInput = z.object({
  actionId,
  version,
  toRouteId: z.uuid("Elige la ruta."),
  confirmed: z.boolean().optional(),
});
export type RouteJoinInput = z.input<typeof routeJoinInput>;

export const shipmentReassignInput = z.object({
  actionId,
  toRouteId: z.uuid("Elige la ruta."),
  reason,
});
export type ShipmentReassignInput = z.input<typeof shipmentReassignInput>;

export const handoverActionInput = z.object({ actionId });
export type HandoverActionInput = z.input<typeof handoverActionInput>;

type Named = { id: string; name: string };
export type RouteCourier = Named & { phone: string };

export type RouteTask = {
  id: string;
  shipmentId: string;
  kind: StopKind;
  status: TaskStatus;
  completedAt: string | null;
  completedBy: Named | null;
  blockedByHandoverId: string | null;
  shipment: {
    trackingNumber: string;
    kind: ShipmentSummary["kind"];
    status: ShipmentStatus;
    merchant: Named;
    recipientName: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    codAmount: number;
  };
};

export type RouteStop = {
  id: string;
  position: number;
  kind: StopKind;
  address: string;
  neighborhood: Named | null;
  tasks: RouteTask[];
};

export type RouteEventType =
  | "created"
  | "shipment_added"
  | "shipment_removed"
  | "reordered"
  | "courier_set"
  | "dispatched"
  | "dispatch_undone"
  | "reassigned"
  | "handover_requested"
  | "handover_confirmed"
  | "handover_cancelled"
  | "cancelled"
  | "finished";

export type RouteEvent = {
  id: string;
  type: RouteEventType;
  actor: Named;
  occurredAt: string;
  shipment: { id: string; trackingNumber: string } | null;
  fromCourier: Named | null;
  toCourier: Named | null;
  reason: string | null;
  changes: Record<string, unknown> | null;
  /** Recorded by dispatch for a courier: "Registrado por despacho" (FR-025). */
  onBehalf: boolean;
};

export type Handover = {
  id: string;
  shipment: { id: string; trackingNumber: string };
  fromCourier: Named;
  toCourier: Named;
  fromRouteId: string | null;
  toRouteId: string;
  reason: string;
  status: HandoverStatus;
  requestedBy: Named;
  requestedAt: string;
  resolvedBy: Named | null;
  resolvedAt: string | null;
  resolvedOnBehalf: boolean;
};

export type RouteDetail = {
  id: string;
  number: number;
  serviceDate: string;
  status: RouteStatus;
  courier: RouteCourier | null;
  cancelReason: string | null;
  dispatchedAt: string | null;
  finishedAt: string | null;
  version: number;
  /** Sum of the COD amounts of the shipments on the route (FR-018). */
  codToCollect: number;
  progress: { completed: number; total: number };
  stops: RouteStop[];
  handovers: Handover[];
  events: RouteEvent[];
};

export type RouteSummary = {
  id: string;
  number: number;
  serviceDate: string;
  status: RouteStatus;
  courier: Named | null;
  completedStops: number;
  totalStops: number;
  codToCollect: number;
  atRiskCount: number;
  lateCount: number;
  pendingHandovers: number;
};

export type RoutesBoard = {
  date: string;
  serverTime: string;
  routes: RouteSummary[];
  routesFromPreviousDays: RouteSummary[];
  unassignedCount: number;
};

/** A shipment not on any route, with where it is picked up (FR-001). */
export type UnassignedShipment = ShipmentSummary & {
  heldBy: { courier: Named } | "office" | null;
  pickupPoint: { id: string; label: string } | null;
  pickupAddress: string;
  pickupNeighborhood: Named;
};
