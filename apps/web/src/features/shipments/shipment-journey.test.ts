import type { CourierRecord, ShipmentDetail, ShipmentEvent } from "@domy/domain";
import { describe, expect, it } from "vitest";
import type { SentencePart } from "@/components/summary-sentence";
import {
  collectedOn,
  deliveryOf,
  detailSentence,
  historyItems,
  holderOf,
  journeySteps,
} from "./shipment-journey";

const sara = { id: "u1", name: "Sara Ríos" };
const camilo = { id: "c1", name: "Camilo Restrepo" };
const daniela = { id: "c2", name: "Daniela Arango" };

const event = (extra: Partial<ShipmentEvent>): ShipmentEvent => ({
  id: crypto.randomUUID(),
  type: "status_changed",
  fromStatus: null,
  toStatus: null,
  actor: sara,
  occurredAt: "2026-11-03T15:02:00.000Z",
  recordedAt: "2026-11-03T15:02:00.000Z",
  reason: null,
  changes: null,
  onBehalf: false,
  ...extra,
});

const record = (extra: Partial<CourierRecord>): CourierRecord => ({
  id: crypto.randomUUID(),
  shipmentId: "s1",
  kind: "delivery",
  outcome: "applied",
  courier: camilo,
  author: camilo,
  onBehalf: false,
  occurredAt: "2026-11-03T21:12:00.000Z",
  recordedAt: "2026-11-03T21:12:00.000Z",
  location: null,
  receivedByName: "Laura Gómez",
  cashAmount: 0,
  companyTransferAmount: 0,
  merchantTransferAmount: 0,
  exceptionReason: null,
  note: null,
  disbursementAmount: null,
  payee: null,
  photos: [],
  reverted: null,
  ...extra,
});

const route = {
  id: "r1",
  number: 2,
  serviceDate: "2026-11-03",
  status: "in_progress" as const,
  courier: camilo,
};

const assigned = event({ fromStatus: "registered", toStatus: "assigned" });
const dispatched = event({
  fromStatus: "assigned",
  toStatus: "dispatched",
  occurredAt: "2026-11-03T16:30:00.000Z",
});
const pickedUp = event({
  fromStatus: "dispatched",
  toStatus: "picked_up",
  actor: camilo,
  occurredAt: "2026-11-03T17:05:00.000Z",
  changes: { custodyCourierId: [null, "Camilo Restrepo"] },
});

const shipment = (extra: Partial<ShipmentDetail>): ShipmentDetail => ({
  id: "s1",
  trackingNumber: "PQ7R2KDM",
  kind: "delivery",
  status: "registered",
  serviceDate: "2026-11-03",
  merchant: { id: "m1", name: "Amy Tecnology" },
  pickupPointId: null,
  pickupAddress: "Carrera 52 # 49-28",
  pickupNeighborhood: { id: "n1", name: "Centro" },
  recipientName: "Laura Gómez",
  recipientPhone: "3104567890",
  recipientAddress: "Carrera 80 # 34-12",
  recipientNeighborhood: { id: "n2", name: "Laureles", municipality: "Medellín" },
  carrier: null,
  destinationTown: null,
  errandDescription: null,
  rateZone: { id: "z1", name: "Medellín" },
  serviceLevel: "standard",
  calculatedFee: 9700,
  fee: 9700,
  feeOverrideReason: null,
  feeNeedsReview: false,
  paymentMode: "cash_on_delivery",
  codAmount: 85000,
  windowStart: null,
  windowEnd: "2026-11-04T01:00:00.000Z",
  packageSize: null,
  packageCount: null,
  merchantReference: null,
  instructions: null,
  voidReason: null,
  version: 1,
  registeredAt: "2026-11-03T14:14:00.000Z",
  registeredBy: sara,
  trackingCode: "abc",
  notifiedAt: null,
  notifiedBy: null,
  heldAtOffice: false,
  returnDecided: false,
  needsReview: false,
  route: null,
  custodyCourier: null,
  handover: null,
  events: [event({ type: "created", toStatus: "registered" })],
  records: [],
  attempts: [],
  recordFlags: [],
  ...extra,
});

const read = (parts: SentencePart[]) => parts.map((part) => part.text).join("");

describe("journeySteps (approved «Detalle de envío»)", () => {
  it("rings the current step and leaves the rest pending", () => {
    const steps = journeySteps(shipment({ status: "assigned", events: [assigned] }));
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Registrado", "done"],
      ["Asignado", "now"],
      ["En ruta", "todo"],
      ["Recogido", "todo"],
      ["Entregado", "todo"],
    ]);
    expect(steps[0]?.at).toBe("2026-11-03T14:14:00.000Z");
    expect(steps[2]?.at).toBeNull();
  });

  it("ends the path at a novelty with its time", () => {
    const exception = event({
      fromStatus: "picked_up",
      toStatus: "exception",
      occurredAt: "2026-11-03T19:41:00.000Z",
    });
    const steps = journeySteps(
      shipment({ status: "exception", events: [assigned, dispatched, pickedUp, exception] }),
    );
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Registrado", "done"],
      ["Asignado", "done"],
      ["En ruta", "done"],
      ["Recogido", "done"],
      ["Novedad", "exception"],
    ]);
    expect(steps[4]?.at).toBe("2026-11-03T19:41:00.000Z");
  });

  it("leaves out a skipped step and an errand's pickup", () => {
    const direct = event({ fromStatus: "registered", toStatus: "dispatched" });
    const steps = journeySteps(
      shipment({ kind: "errand", status: "dispatched", events: [direct] }),
    );
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Registrado", "done"],
      ["En ruta", "now"],
      ["Entregado", "todo"],
    ]);
  });

  it("marks a delivery and a void as the end of the path", () => {
    const delivered = event({ fromStatus: "picked_up", toStatus: "delivered" });
    expect(
      journeySteps(
        shipment({ status: "delivered", events: [assigned, dispatched, pickedUp, delivered] }),
      ).every((step) => step.state === "done"),
    ).toBe(true);
    const voided = event({ type: "voided", fromStatus: "assigned", toStatus: "voided" });
    expect(
      journeySteps(shipment({ status: "voided", events: [assigned, voided] })).map((step) => [
        step.label,
        step.state,
      ]),
    ).toEqual([
      ["Registrado", "done"],
      ["Asignado", "done"],
      ["Anulado", "exception"],
    ]);
  });
});

describe("historyItems", () => {
  it("puts custody, changes, and decisions in one list, newest first", () => {
    const items = historyItems([assigned, pickedUp]);
    expect(items.map((item) => [item.title, item.custody, item.tone])).toEqual([
      ["Cambio de estado: Recogido", "Lo recoge Camilo Restrepo", "custody"],
      ["Cambio de estado: Asignado", null, "neutral"],
    ]);
  });
});

describe("detailSentence", () => {
  it("tells an assigned shipment it can still be edited or voided", () => {
    expect(
      read(detailSentence(shipment({ status: "assigned", route: { ...route, status: "draft" } }))),
    ).toBe(
      "Entrega para Laura Gómez en Laureles, antes de las 8:00 p. m. Va en la Ruta 2 de Camilo Restrepo, que todavía no sale; aún se puede editar o anular.",
    );
  });

  it("names who has the package and who receives a pending handover", () => {
    const parts = detailSentence(
      shipment({
        status: "picked_up",
        windowEnd: null,
        route,
        custodyCourier: camilo,
        handover: {
          id: "h1",
          shipment: { id: "s1", trackingNumber: "PQ7R2KDM" },
          fromCourier: camilo,
          toCourier: daniela,
          fromRouteId: "r1",
          toRouteId: "r2",
          reason: "Cambia de zona",
          status: "pending",
          requestedBy: sara,
          requestedAt: "2026-11-03T19:58:00.000Z",
          resolvedBy: null,
          resolvedAt: null,
          resolvedOnBehalf: false,
        },
      }),
    );
    expect(read(parts)).toBe(
      "Entrega para Laura Gómez en Laureles. Lo tiene Camilo Restrepo y pasa a Daniela Arango cuando lo reciba.",
    );
  });

  it("asks for the decision on a novelty", () => {
    expect(
      read(
        detailSentence(shipment({ status: "exception", windowEnd: null, custodyCourier: camilo })),
      ),
    ).toBe(
      "Entrega para Laura Gómez en Laureles. Camilo Restrepo conserva el paquete tras una novedad: falta decidir si se intenta de nuevo, se devuelve o se recibe en oficina.",
    );
  });

  it("tells a delivery and a collection that differs, in the warning tone", () => {
    const parts = detailSentence(
      shipment({ status: "delivered", records: [record({ cashAmount: 80000 })] }),
    );
    expect(read(parts)).toBe(
      "Entregado a Laura Gómez a las 4:12 p. m. Camilo Restrepo cobró $ 80.000 de $ 85.000.",
    );
    expect(parts.find((part) => part.text === "$ 80.000")?.tone).toBe("warning");
  });
});

describe("detailSentence of a voided shipment", () => {
  it("says it no longer goes out, leaving the reason to «Recorrido»", () => {
    expect(
      read(
        detailSentence(
          shipment({ status: "voided", windowEnd: null, voidReason: "El cliente canceló." }),
        ),
      ),
    ).toBe(
      "Entrega para Laura Gómez en Laureles. Se anuló y ya no sale; sigue aquí para consultarlo.",
    );
  });
});

describe("delivery and holder", () => {
  it("reads the delivery that stands and what was collected on it", () => {
    const reverted = record({
      cashAmount: 1,
      reverted: { at: "2026-11-03T22:00:00.000Z", by: sara, reason: "Error" },
    });
    const standing = record({ cashAmount: 50000, companyTransferAmount: 30000 });
    expect(deliveryOf([standing, reverted])).toBe(standing);
    expect(collectedOn(standing)).toBe(80000);
  });

  it("says who has the package", () => {
    expect(holderOf(shipment({ heldAtOffice: true, custodyCourier: camilo }))).toBe("La oficina");
    expect(holderOf(shipment({ custodyCourier: camilo }))).toBe("Camilo Restrepo");
    expect(holderOf(shipment({ status: "delivered" }))).toBe("Nadie: ya se entregó");
    expect(holderOf(shipment({ status: "voided" }))).toBe("Nadie: se anuló");
    expect(holderOf(shipment({}))).toBe("Nadie todavía");
  });
});
