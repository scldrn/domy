import {
  bogotaToday,
  formatCop,
  resolveCodAmount,
  shipmentStatusLabels,
  type CourierRecord,
  type ShipmentDetail,
  type ShipmentEvent,
  type ShipmentStatus,
} from "@domy/domain";
import type { SentencePart } from "@/components/summary-sentence";
import { custodyChange } from "@/features/routes/route-history";
import { formatDateTime, formatTime, formatWindow } from "@/lib/format";

/** "9:14 a. m." on the shipment's service date, the date too on any other day. */
export function whenOf(instant: string, serviceDate: string): string {
  return bogotaToday(new Date(instant)) === serviceDate
    ? formatTime(instant)
    : formatDateTime(instant);
}

export type JourneyStep = {
  label: string;
  /** When the shipment reached it; null while it is still ahead. */
  at: string | null;
  state: "done" | "now" | "todo" | "exception";
};

/** Where a shipment leaves the delivery path, and how its step reads. */
const offPath: Partial<Record<ShipmentStatus, JourneyStep["state"]>> = {
  exception: "exception",
  returned: "done",
  voided: "exception",
};

/**
 * "Recorrido" of the approved "Detalle de envío" (feature 006): the delivery path with the
 * time the shipment last entered each step, read from its history; an errand has no pickup.
 * A step the shipment skipped is left out, and a novelty, return, or void ends the path.
 */
export function journeySteps(
  shipment: Pick<ShipmentDetail, "kind" | "status" | "registeredAt" | "events">,
): JourneyStep[] {
  const path: ShipmentStatus[] =
    shipment.kind === "errand"
      ? ["registered", "assigned", "dispatched", "delivered"]
      : ["registered", "assigned", "dispatched", "picked_up", "delivered"];
  const enteredAt = (status: ShipmentStatus) =>
    status === "registered"
      ? shipment.registeredAt
      : (shipment.events.findLast(
          (event) => event.toStatus === status && event.fromStatus !== status,
        )?.occurredAt ?? null);
  const step = (status: ShipmentStatus, state: JourneyStep["state"]): JourneyStep => ({
    label: shipmentStatusLabels[status],
    at: state === "todo" ? null : enteredAt(status),
    state,
  });
  const ending = offPath[shipment.status];
  const reach = ending
    ? path.findLastIndex((status, index) => index === 0 || enteredAt(status) !== null)
    : path.indexOf(shipment.status);
  const steps = path.flatMap((status, index): JourneyStep[] => {
    if (index > reach) return ending ? [] : [step(status, "todo")];
    if (index > 0 && enteredAt(status) === null) return [];
    const now = index === reach && !ending && status !== "delivered";
    return [step(status, now ? "now" : "done")];
  });
  if (shipment.status === "returned") steps.push(step("exception", "done"));
  if (ending) steps.push(step(shipment.status, ending));
  return steps;
}

export type HistoryItem = {
  event: ShipmentEvent;
  title: string;
  /** Who had the package after this event, when it changed (SC-005). */
  custody: string | null;
  tone: "exception" | "delivered" | "custody" | "neutral";
};

const eventLabels: Record<ShipmentEvent["type"], string> = {
  created: "Creado",
  updated: "Editado",
  fee_confirmed: "Tarifa confirmada",
  voided: "Anulado",
  status_changed: "Cambio de estado",
  reassigned: "Reasignado",
  handover_confirmed: "Traspaso confirmado",
  handover_cancelled: "Traspaso cancelado",
  exception_decided: "Decisión de la novedad",
  office_received: "Recibido en oficina",
  record_corrected: "Registro corregido",
  record_reverted: "Registro revertido",
  review_cleared: "Revisión resuelta",
  notified: "Notificado",
};

/**
 * One "Historial" for changes, custody, and decisions (approved "Detalle de envío"), newest
 * first, where feature 002 had "Custodia del paquete" and "Historial de cambios" apart.
 */
export function historyItems(events: ShipmentEvent[]): HistoryItem[] {
  return events.toReversed().map((event) => {
    const custody = custodyChange(event);
    const status =
      event.type === "status_changed" && event.toStatus
        ? `: ${shipmentStatusLabels[event.toStatus]}`
        : "";
    return {
      event,
      title: `${eventLabels[event.type]}${status}`,
      custody,
      tone:
        event.toStatus === "exception"
          ? "exception"
          : event.toStatus === "delivered"
            ? "delivered"
            : custody
              ? "custody"
              : "neutral",
    };
  });
}

/** The courier's delivery that stands: applied and not reverted (003 FR-032). */
export function deliveryOf(records: CourierRecord[]): CourierRecord | null {
  return (
    records.findLast(
      (record) => record.kind === "delivery" && record.outcome === "applied" && !record.reverted,
    ) ?? null
  );
}

/** What the courier collected on that delivery, by every payment method. */
export function collectedOn(record: CourierRecord): number {
  return record.cashAmount + record.companyTransferAmount + record.merchantTransferAmount;
}

/** Who has the package now, as "Lo tiene" says it. */
export function holderOf(
  shipment: Pick<ShipmentDetail, "status" | "heldAtOffice" | "custodyCourier">,
): string {
  if (shipment.heldAtOffice) return "La oficina";
  if (shipment.custodyCourier) return shipment.custodyCourier.name;
  if (shipment.status === "delivered") return "Nadie: ya se entregó";
  if (shipment.status === "returned") return "Nadie: ya se devolvió";
  if (shipment.status === "voided") return "Nadie: se anuló";
  return "Nadie todavía";
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Closes a sentence whose last piece may already end in a period ("8:00 p. m."). */
function closed(parts: SentencePart[]): SentencePart[] {
  return parts.at(-1)?.text.endsWith(".") ? parts : [...parts, { text: "." }];
}

function destination(shipment: ShipmentDetail): SentencePart[] {
  const place = shipment.recipientNeighborhood ? ` en ${shipment.recipientNeighborhood.name}` : "";
  const who = shipment.recipientName ?? "Sin destinatario";
  switch (shipment.kind) {
    case "errand":
      return [{ text: `Diligencia: ${shipment.errandDescription ?? "sin describir"}` }];
    case "carrier_handoff":
      return [
        { text: "Entrega a " },
        { text: shipment.carrier?.name ?? "la transportadora", strong: true },
        { text: shipment.destinationTown ? ` para ${shipment.destinationTown}` : "" },
      ];
    case "reverse_pickup":
      return [{ text: "Recogida inversa de " }, { text: who, strong: true }, { text: place }];
    case "delivery":
      return [{ text: "Entrega para " }, { text: who, strong: true }, { text: place }];
  }
}

const decide = "falta decidir si se intenta de nuevo, se devuelve o se recibe en oficina.";

/** What is left to know about the shipment in its current state. */
function stateClause(shipment: ShipmentDetail): SentencePart[] {
  const route = shipment.route;
  const onRoute: SentencePart[] = route
    ? [
        { text: "Va en la " },
        { text: `Ruta ${String(route.number)}`, strong: true },
        ...(route.courier
          ? [{ text: " de " }, { text: route.courier.name, strong: true }]
          : [{ text: ", todavía sin mensajero" }]),
      ]
    : [{ text: "Todavía no tiene ruta" }];
  const holder = shipment.custodyCourier?.name;
  switch (shipment.status) {
    case "registered":
    case "assigned":
      return [
        ...onRoute,
        { text: route ? ", que todavía no sale; " : "; " },
        { text: "aún se puede editar o anular." },
      ];
    case "dispatched":
      return [...onRoute, { text: ", que ya salió; aún se puede editar o anular." }];
    case "picked_up":
      return [
        ...(holder
          ? [{ text: "Lo tiene " }, { text: holder, strong: true }]
          : [{ text: shipment.heldAtOffice ? "Está en la oficina" : "Ya se recogió" }]),
        ...(shipment.handover
          ? [
              { text: " y pasa a " },
              { text: shipment.handover.toCourier.name, strong: true },
              { text: " cuando lo reciba." },
            ]
          : [{ text: "." }]),
      ];
    case "exception":
      if (shipment.heldAtOffice)
        return [
          {
            text: shipment.returnDecided
              ? "Está en la oficina tras una novedad; la devolución está en curso."
              : "Está en la oficina tras una novedad; falta decidir si se intenta de nuevo o se devuelve.",
          },
        ];
      if (shipment.returnDecided)
        return holder
          ? [
              { text: holder, strong: true },
              { text: " lo lleva de vuelta: la devolución está en curso." },
            ]
          : [{ text: "Tiene una novedad y la devolución está en curso." }];
      return holder
        ? [
            { text: holder, strong: true },
            { text: ` conserva el paquete tras una novedad: ${decide}` },
          ]
        : [{ text: `Tiene una novedad: ${decide}` }];
    case "returned":
      return [
        { text: "Se devolvió a " },
        { text: shipment.merchant.name, strong: true },
        { text: "." },
      ];
    case "voided":
      return [{ text: "Se anuló y ya no sale; sigue aquí para consultarlo." }];
    case "delivered":
      return [];
  }
}

/** "Entregado a Laura Gómez a las 4:12 p. m. Camilo Restrepo cobró $ 80.000 de $ 85.000." */
function deliveredSentence(shipment: ShipmentDetail): SentencePart[] {
  const record = deliveryOf(shipment.records);
  const at =
    record?.occurredAt ??
    shipment.events.findLast((event) => event.toStatus === "delivered")?.occurredAt;
  const when: SentencePart[] = at
    ? bogotaToday(new Date(at)) === shipment.serviceDate
      ? [{ text: " a las " }, { text: formatTime(at), strong: true }]
      : [{ text: " el " }, { text: formatDateTime(at), strong: true }]
    : [];
  const receiver = record?.receivedByName ?? shipment.recipientName;
  const parts = closed([
    { text: "Entregado" },
    ...(receiver ? [{ text: " a " }, { text: receiver, strong: true }] : []),
    ...when,
  ]);
  const expected = resolveCodAmount(shipment.paymentMode, shipment.fee, shipment.codAmount);
  if (!record || expected === 0) return parts;
  const collected = collectedOn(record);
  return [
    ...parts,
    { text: " " },
    { text: record.courier.name, strong: true },
    { text: " cobró " },
    collected === expected
      ? { text: formatCop(collected), strong: true }
      : { text: formatCop(collected), strong: true, tone: "warning" },
    ...(collected === expected
      ? [{ text: "." }]
      : [{ text: " de " }, { text: formatCop(expected), strong: true }, { text: "." }]),
  ];
}

/**
 * The sentence under the tracking number (FR-007; approved "Detalle de envío"): where it goes
 * and when, then what is left to know or decide in its state.
 */
export function detailSentence(shipment: ShipmentDetail): SentencePart[] {
  if (shipment.status === "delivered") return deliveredSentence(shipment);
  const window = formatWindow(shipment.windowStart, shipment.windowEnd);
  return [
    ...closed([
      ...destination(shipment),
      ...(window ? [{ text: ", " }, { text: lowerFirst(window), strong: true }] : []),
    ]),
    { text: " " },
    ...stateClause(shipment),
  ];
}
