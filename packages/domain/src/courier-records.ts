import type { RouteStatus, StopKind } from "./routes.ts";
import type { ShipmentKind } from "./schemas/enums.ts";
import type { ShipmentStatus } from "./shipment-lifecycle.ts";
import { formatTrackingNumber } from "./tracking-numbers.ts";

/**
 * What a courier record does to its shipment (feature 003, data-model.md §What each record
 * does, research R5). One pure function, run by the server to apply a record and by the
 * phone to show its outbox over the last snapshot (Constitution III). A record is never
 * refused for the shipment's state (FR-024): it is applied, a duplicate, or kept as "No
 * aplicado".
 */

export const courierRecordKinds = [
  "pickup",
  "delivery",
  "exception",
  "problem",
  "return",
  "disbursement",
  "handover_confirmation",
] as const;
export type CourierRecordKind = (typeof courierRecordKinds)[number];
export const courierRecordKindLabels: Record<CourierRecordKind, string> = {
  pickup: "Recogida",
  delivery: "Entrega",
  exception: "Novedad",
  problem: "Problema de recogida",
  return: "Devolución",
  disbursement: "Pago por cuenta del cliente",
  handover_confirmation: "Traspaso recibido",
};

export const recordOutcomes = ["applied", "duplicate", "not_applied"] as const;
export type RecordOutcome = (typeof recordOutcomes)[number];

export const exceptionReasons = ["recipient_absent", "wrong_address", "rejected"] as const;
export type ExceptionReason = (typeof exceptionReasons)[number];
export const exceptionReasonLabels: Record<ExceptionReason, string> = {
  recipient_absent: "Destinatario ausente",
  wrong_address: "Dirección errada",
  rejected: "Rechazado",
};

export const notAppliedReasons = [
  "voided",
  "delivered",
  "returned",
  "already_picked_up",
  "not_picked_up",
  "not_in_custody",
  "no_task",
  "no_handover",
  "invalid_for_shipment",
] as const;
export type NotAppliedReason = (typeof notAppliedReasons)[number];
/** Why a record was kept without effect, for the courier's notice and the history (FR-026). */
export const notAppliedReasonLabels: Record<NotAppliedReason, string> = {
  voided: "El envío está anulado.",
  delivered: "El envío ya fue entregado.",
  returned: "El envío ya fue devuelto al cliente.",
  already_picked_up: "Otro mensajero ya tiene el paquete.",
  not_picked_up: "El envío no se ha recogido.",
  not_in_custody: "El paquete no está en tu custodia.",
  no_task: "El envío no tiene esa parada pendiente en tu ruta.",
  no_handover: "No hay un traspaso pendiente para ti.",
  invalid_for_shipment: "El registro no cumple lo que pide este envío.",
};

/** Every change to a courier's route that the courier must see (FR-027). */
export const noticeTypes = [
  "route_dispatched",
  "shipment_added",
  "shipment_removed",
  "shipment_voided",
  "shipment_updated",
  "stops_reordered",
  "shipment_reassigned_in",
  "shipment_reassigned_out",
  "route_reassigned",
  "dispatch_undone",
  "handover_requested",
  "handover_confirmed",
  "handover_cancelled",
  "exception_decided",
  "office_received",
  "record_corrected",
  "record_reverted",
  "record_not_applied",
] as const;
export type NoticeType = (typeof noticeTypes)[number];

/**
 * The notice in Spanish. The phone notification carries only the type and the route number
 * (FR-040), so every text also reads well without the shipment.
 */
export function noticeText(
  type: NoticeType,
  about: { routeNumber?: number; trackingNumber?: string },
): string {
  const guide = about.trackingNumber ? formatTrackingNumber(about.trackingNumber) : null;
  const route =
    about.routeNumber === undefined ? "tu ruta" : `la Ruta ${String(about.routeNumber)}`;
  const on = (text: string) => (guide ? `${text}: ${guide}` : text);
  const texts: Record<NoticeType, string> = {
    route_dispatched:
      about.routeNumber === undefined
        ? "Te despacharon una ruta."
        : `Te despacharon la Ruta ${String(about.routeNumber)}.`,
    shipment_added: `${on("Envío agregado a tu ruta")}.`,
    shipment_removed: `${on("Envío quitado de tu ruta")}.`,
    shipment_voided: `${on("Envío anulado")}.`,
    shipment_updated: `${on("Envío actualizado")}. Revisa la dirección y las indicaciones.`,
    stops_reordered: `El coordinador cambió el orden de las paradas de ${route}.`,
    shipment_reassigned_in: guide
      ? `Te reasignaron el envío ${guide}.`
      : "Te reasignaron un envío.",
    shipment_reassigned_out: guide
      ? `El envío ${guide} pasó a otro mensajero.`
      : "Un envío de tu ruta pasó a otro mensajero.",
    route_reassigned: `${about.routeNumber === undefined ? "Tu ruta" : `La Ruta ${String(about.routeNumber)}`} pasó a otro mensajero.`,
    dispatch_undone: `Se deshizo el despacho de ${route}.`,
    handover_requested: `${on("Traspaso pendiente")}.`,
    handover_confirmed: `${on("Traspaso confirmado")}.`,
    handover_cancelled: guide ? `Se canceló el traspaso de ${guide}.` : "Se canceló un traspaso.",
    exception_decided: guide
      ? `Hay una decisión sobre la novedad de ${guide}.`
      : "Hay una decisión sobre una novedad.",
    office_received: guide
      ? `La oficina recibió el paquete ${guide}.`
      : "La oficina recibió un paquete que tenías.",
    record_corrected: guide
      ? `El coordinador corrigió un registro de ${guide}.`
      : "El coordinador corrigió uno de tus registros.",
    record_reverted: guide
      ? `El coordinador revirtió un registro de ${guide}.`
      : "El coordinador revirtió uno de tus registros.",
    record_not_applied: guide
      ? `Un registro de ${guide} no se aplicó; el coordinador lo revisará.`
      : "Uno de tus registros no se aplicó; el coordinador lo revisará.",
  };
  return texts[type];
}

/** A shipment as the record rules see it: status, custody, route, and pending work. */
export type ShipmentForRecord = {
  kind: ShipmentKind;
  status: ShipmentStatus;
  custodyCourierId: string | null;
  heldAtOffice: boolean;
  returnDecided: boolean;
  /** The route that carries it now, if any. */
  route: { id: string; status: RouteStatus; courierId: string | null } | null;
  /** Its pending tasks, on whatever route they are. */
  pendingTasks: {
    id: string;
    kind: StopKind;
    routeId: string;
    routeStatus: RouteStatus;
    routeCourierId: string | null;
  }[];
  pendingHandover: { id: string; toCourierId: string; toRouteId: string } | null;
  /** Its courier records already applied and not reverted. */
  appliedRecords: { kind: CourierRecordKind; courierId: string }[];
};

/** FR-034: the panel and server must name the same courier, including held-off-route work. */
export function onBehalfCourierId(state: {
  custodyCourierId: string | null;
  route: { status: RouteStatus; courierId: string | null } | null;
}): string | null {
  return (
    state.custodyCourierId ?? (state.route?.status === "in_progress" ? state.route.courierId : null)
  );
}

export type RecordEffect = {
  status?: ShipmentStatus;
  /** Who holds the package after the record: a courier, the office, or nobody. */
  custody?: { courierId: string | null; heldAtOffice: boolean };
  completeTaskId?: string;
  failTaskId?: string;
  /** Pending tasks to take off their route (a route in preparation, or another courier's). */
  removeTaskIds?: string[];
  /** The shipment leaves its route and waits off route with its holder (FR-031). */
  leaveRoute?: boolean;
  requestHandover?: { toCourierId: string; toRouteId: string };
  confirmHandoverId?: string;
  cancelHandoverId?: string;
  problemNoteTaskId?: string;
  returnDecided?: false;
  /** "Por revisar": the record arrived after the dispatcher changed the shipment (FR-025). */
  needsReview: boolean;
};

export type RecordResolution =
  | { outcome: "applied"; effect: RecordEffect }
  | { outcome: "duplicate" }
  | { outcome: "not_applied"; reason: NotAppliedReason };

/** 003 FR-032: corrections keep their identity; reverts and unapplied facts are not attempts. */
export function deliveryAttempts<
  T extends { kind: CourierRecordKind; outcome: RecordOutcome; reverted: unknown },
>(records: readonly T[]): T[] {
  return records.filter(
    (record) =>
      (record.kind === "delivery" || record.kind === "exception") &&
      record.outcome === "applied" &&
      record.reverted === null,
  );
}

const custodyTo = (courierId: string | null) => ({ courierId, heldAtOffice: false });

/** A final shipment takes no record; the reason names its status. */
const finalReasons: Partial<Record<ShipmentStatus, NotAppliedReason>> = {
  voided: "voided",
  delivered: "delivered",
  returned: "returned",
};

/**
 * FR-008: a delivery names who received it unless the shipment is an errand. A name the record
 * carries already passed the input schema (2–100 characters, `receivedByNameProblem`); what is
 * left to decide against the shipment is its absence, as when an errand became a package.
 */
function lacksReceivedBy(shipmentKind: ShipmentKind, name: string | undefined): boolean {
  return shipmentKind !== "errand" && (name === undefined || name.trim().length < 2);
}

export function resolveCourierRecord(
  shipment: ShipmentForRecord,
  record: {
    kind: CourierRecordKind;
    courierId: string;
    /**
     * A delivery's fields checked against the shipment (ROB-3, FR-024): a well-formed record
     * that does not fit it is kept as "No aplicado" rather than refused. Without them the check
     * is skipped (a caller that only asks whether a kind of record would apply).
     */
    delivery?: { receivedByName: string | undefined };
  },
): RecordResolution {
  const author = record.courierId;
  /** A pending task of these kinds on the author's route in progress. */
  const onAuthorRoute = (...kinds: StopKind[]) =>
    shipment.pendingTasks.find(
      (task) =>
        kinds.includes(task.kind) &&
        task.routeStatus === "in_progress" &&
        task.routeCourierId === author,
    );
  const elsewhere = (...kinds: StopKind[]) =>
    shipment.pendingTasks.filter(
      (task) =>
        kinds.includes(task.kind) &&
        !(task.routeStatus === "in_progress" && task.routeCourierId === author),
    );
  const holds = shipment.custodyCourierId === author;
  const repeated = shipment.appliedRecords.some(
    (applied) => applied.kind === record.kind && applied.courierId === author,
  );
  const refuse = (reason: NotAppliedReason): RecordResolution =>
    repeated ? { outcome: "duplicate" } : { outcome: "not_applied", reason };
  const finalReason = (): NotAppliedReason | null => finalReasons[shipment.status] ?? null;

  /**
   * A delivery, exception, or return by the holder (FR-025): applied on the author's route,
   * or else applied as a fact that takes the task off another route and cancels a handover.
   */
  const byHolder = (
    kind: StopKind,
    effect: Omit<RecordEffect, "needsReview">,
  ): RecordResolution => {
    const task = onAuthorRoute(kind);
    if (task) {
      return {
        outcome: "applied",
        effect: {
          ...effect,
          ...(effect.status === "exception"
            ? { failTaskId: task.id }
            : { completeTaskId: task.id }),
          needsReview: false,
        },
      };
    }
    const others = elsewhere(kind).map((other) => other.id);
    return {
      outcome: "applied",
      effect: {
        ...effect,
        ...(others.length > 0 && { removeTaskIds: others }),
        ...(shipment.pendingHandover && { cancelHandoverId: shipment.pendingHandover.id }),
        needsReview: true,
      },
    };
  };

  switch (record.kind) {
    case "pickup": {
      const task = onAuthorRoute("pickup");
      if (task && shipment.status === "dispatched") {
        return {
          outcome: "applied",
          effect: {
            status: "picked_up",
            custody: custodyTo(author),
            completeTaskId: task.id,
            needsReview: false,
          },
        };
      }
      // The office hands over a package whose return was decided (FR-041).
      if (task && shipment.heldAtOffice && shipment.status === "exception") {
        return {
          outcome: "applied",
          effect: { custody: custodyTo(author), completeTaskId: task.id, needsReview: false },
        };
      }
      if (["registered", "assigned", "dispatched"].includes(shipment.status)) {
        // A late pickup of a shipment the dispatcher moved meanwhile (FR-025).
        const effect: RecordEffect = {
          status: "picked_up",
          custody: custodyTo(author),
          needsReview: true,
        };
        const other = elsewhere("pickup").find((each) => each.routeStatus === "in_progress");
        if (other && other.routeCourierId) {
          return {
            outcome: "applied",
            effect: {
              ...effect,
              completeTaskId: other.id,
              requestHandover: { toCourierId: other.routeCourierId, toRouteId: other.routeId },
            },
          };
        }
        if (shipment.route) {
          return {
            outcome: "applied",
            effect: {
              ...effect,
              removeTaskIds: shipment.pendingTasks.map((each) => each.id),
              leaveRoute: true,
            },
          };
        }
        return { outcome: "applied", effect };
      }
      return refuse(finalReason() ?? "already_picked_up");
    }

    case "delivery": {
      if (shipment.kind === "errand" && shipment.status === "dispatched") {
        return byHolder("errand", { status: "delivered" });
      }
      if (shipment.status === "picked_up" && holds) {
        if (record.delivery && lacksReceivedBy(shipment.kind, record.delivery.receivedByName))
          return refuse("invalid_for_shipment");
        return byHolder("delivery", { status: "delivered", custody: custodyTo(null) });
      }
      return refuse(
        finalReason() ?? (shipment.status === "picked_up" ? "not_in_custody" : "not_picked_up"),
      );
    }

    case "exception": {
      if (shipment.status === "picked_up" && holds) {
        return byHolder("delivery", { status: "exception" });
      }
      return refuse(
        finalReason() ?? (shipment.status === "picked_up" ? "not_in_custody" : "not_picked_up"),
      );
    }

    case "return": {
      if (shipment.status === "exception" && shipment.returnDecided && holds) {
        return byHolder("return", {
          status: "returned",
          custody: custodyTo(null),
          returnDecided: false,
        });
      }
      return refuse(finalReason() ?? (holds ? "no_task" : "not_in_custody"));
    }

    case "problem": {
      const task = onAuthorRoute("pickup", "errand", "return");
      return task
        ? { outcome: "applied", effect: { problemNoteTaskId: task.id, needsReview: false } }
        : { outcome: "not_applied", reason: finalReason() ?? "no_task" };
    }

    case "disbursement": {
      if (shipment.status === "voided") return { outcome: "not_applied", reason: "voided" };
      const ownRoute = shipment.route?.courierId === author || holds;
      return { outcome: "applied", effect: { needsReview: !ownRoute } };
    }

    case "handover_confirmation": {
      const handover = shipment.pendingHandover;
      if (handover?.toCourierId === author) {
        return {
          outcome: "applied",
          effect: {
            custody: custodyTo(author),
            confirmHandoverId: handover.id,
            needsReview: false,
          },
        };
      }
      // Already the holder with nothing pending: confirmed before, by them or by dispatch.
      return holds && !handover
        ? { outcome: "duplicate" }
        : { outcome: "not_applied", reason: "no_handover" };
    }
  }
}
