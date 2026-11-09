import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as domain from "./index.ts";
import * as publicSchemas from "./schemas/public.ts";
import {
  bogotaLocalTime,
  publicTrackingSchema,
  publicTrackingStage,
  shipmentKinds,
  shipmentStatuses,
} from "./index.ts";
import type { ShipmentKind, ShipmentStatus } from "./index.ts";

const publicTrackingKeys = new Set([
  "merchantName",
  "trackingNumber",
  "kind",
  "serviceDate",
  "window",
  "support",
  "neighborhood",
  "carrierName",
  "destinationTown",
  "statusText",
  "reasonText",
  "deliveriesBefore",
  "courier",
  "amountToPay",
  "deliveredTo",
  "deliveredAt",
  "expired",
]);

const outputObject = z.record(z.string(), z.unknown());
const projectionFunction = z.function({
  input: [z.unknown(), z.unknown(), z.date()],
  output: z.unknown(),
});

const now = new Date("2026-10-01T20:45:00.000Z");
const deliveredAt = "2026-10-01T20:45:00.000Z";
const intendedRecipient = "PRIVATE_INTENDED_RECIPIENT";
const recipientPhone = "PRIVATE_RECIPIENT_PHONE";
const recipientAddress = "PRIVATE_RECIPIENT_ADDRESS";
const pickupAddress = "PRIVATE_PICKUP_ADDRESS";
const oldReceiver = "PRIVATE_OLD_RECEIVER";
const privateNote = "PRIVATE_RECORD_NOTE";
const privatePhotoKey = "PRIVATE_PHOTO_KEY";

const shipmentBase = {
  id: "shipment-1",
  trackingNumber: "12345678",
  serviceDate: "2026-10-02",
  merchant: { id: "merchant-1", name: "Tienda Aurora" },
  pickupPointId: "pickup-1",
  pickupAddress,
  pickupNeighborhood: { id: "pickup-neighborhood-1", name: "El Estadio" },
  recipientName: intendedRecipient,
  recipientPhone,
  recipientAddress,
  recipientNeighborhood: {
    id: "recipient-neighborhood-1",
    name: "Laureles",
    municipality: "Medellín",
  },
  carrier: { id: "carrier-1", name: "Coonorte" },
  destinationTown: "Copacabana",
  errandDescription: "PRIVATE_ERRAND_DESCRIPTION",
  rateZone: { id: "zone-1", name: "PRIVATE_RATE_ZONE" },
  serviceLevel: "standard",
  calculatedFee: 13_000,
  fee: 13_000,
  feeOverrideReason: "PRIVATE_FEE_REASON",
  feeNeedsReview: false,
  paymentMode: "cash_on_delivery",
  codAmount: 85_000,
  windowStart: "2026-10-01T20:00:00.000Z",
  windowEnd: "2026-10-01T21:00:00.000Z",
  packageSize: "small",
  packageCount: 1,
  merchantReference: "PRIVATE_MERCHANT_REFERENCE",
  instructions: "PRIVATE_INSTRUCTIONS",
  voidReason: "PRIVATE_VOID_REASON",
  version: 4,
  registeredAt: "2026-10-01T19:00:00.000Z",
  registeredBy: { id: "user-1", name: "PRIVATE_REGISTERED_BY" },
  events: [
    {
      type: "status_changed",
      actor: { id: "user-2", name: "PRIVATE_EVENT_ACTOR" },
      changes: { recipientName: ["PRIVATE_OLD_NAME", intendedRecipient] },
    },
  ],
  records: [
    {
      id: "record-old",
      kind: "delivery",
      outcome: "applied",
      receivedByName: oldReceiver,
      reverted: { at: "2026-10-01T20:00:00.000Z", by: { name: "PRIVATE_REVERTOR" } },
      note: privateNote,
      photos: [{ id: "photo-1", storageKey: privatePhotoKey }],
    },
  ],
};

function shipmentFixture(
  kind: ShipmentKind,
  status: ShipmentStatus,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...shipmentBase, kind, status, ...overrides };
}

function contextFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    support: { phone: "3005550101", companyName: "Cohex" },
    route: {
      id: "route-1",
      status: "in_progress",
      courier: { id: "courier-route", name: "Luz María Ríos", phone: "3002223344" },
      stops: [],
    },
    custodyCourier: null,
    heldAtOffice: false,
    returnDecided: false,
    handover: null,
    exceptionReason: "recipient_absent",
    deliveriesBefore: 3,
    effectiveDeliveryRecord: {
      id: "record-current",
      kind: "delivery",
      outcome: "applied",
      receivedByName: "María López",
      occurredAt: deliveredAt,
      reverted: null,
    },
    effectiveFinalEvent: { occurredAt: deliveredAt, recordedAt: "2026-10-01T20:46:00.000Z" },
    ...overrides,
  };
}

function projectionExport(): unknown {
  const exports: unknown = domain;
  if (typeof exports !== "object" || exports === null || !("publicTrackingView" in exports)) {
    return undefined;
  }
  return exports["publicTrackingView"];
}

function publicTrackingView(
  shipment: unknown,
  context: unknown,
  at: Date = now,
): Record<string, unknown> {
  const candidate = projectionExport();
  if (candidate === undefined) {
    throw new Error("T013 must export publicTrackingView before the T009 assertions can run.");
  }
  const project = projectionFunction.parse(candidate);
  return outputObject.parse(project(shipment, context, at));
}

function parsePublicTracking(value: unknown): unknown {
  return publicTrackingSchema.parse(value);
}

const merchantProjectionFunction = z.function({
  input: [z.unknown()],
  output: z.unknown(),
});

function exportedValue(module: unknown, name: string): unknown {
  if (typeof module !== "object" || module === null || !(name in module)) return undefined;
  return Reflect.get(module, name);
}

function merchantProjection(name: "merchantDayView" | "merchantShipmentView", input: unknown) {
  const candidate = exportedValue(domain, name);
  if (candidate === undefined) {
    throw new Error(`T026 must export ${name} before the T023 assertions can run.`);
  }
  return outputObject.parse(merchantProjectionFunction.parse(candidate)(input));
}

function merchantShipmentId(index: number): string {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function merchantPhotoId(index: number): string {
  return `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function merchantRecordId(index: number): string {
  return `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function merchantTrackingCode(index: number): string {
  return `${"A".repeat(20)}${index.toString(16).padStart(2, "0")}`;
}

const merchantSupportNotice = "Para conocer más detalles, contacta con soporte.";

type ParseSchema = { parse: (value: unknown) => unknown };

function isParseSchema(value: unknown): value is ParseSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "parse" in value &&
    typeof value.parse === "function"
  );
}

function parseMerchantSchema(name: string, value: unknown): unknown {
  const candidate = exportedValue(publicSchemas, name);
  if (!isParseSchema(candidate)) {
    throw new Error(`T026 must export strict ${name} from schemas/public.ts.`);
  }
  return candidate.parse(value);
}

function merchantShipmentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: merchantShipmentId(1),
    trackingNumber: "82001001",
    trackingCode: merchantTrackingCode(1),
    kind: "delivery",
    status: "registered",
    serviceDate: "2026-10-02",
    merchantReference: "ORDER-1001",
    recipientName: "Ana Rivera",
    recipientPhone: "3001234567",
    recipientAddress: "Calle 10 # 43-12, Torre Peñón",
    pickupAddress: "Carrera 50 # 20-30",
    neighborhood: "Laureles",
    windowStart: "2026-10-02T15:00:00.000Z",
    windowEnd: "2026-10-02T17:00:00.000Z",
    fee: 18_000,
    feeNeedsReview: false,
    codAmount: 0,
    effectiveDelivery: null,
    privateDebugValue: "PRIVATE_MERCHANT_SOURCE_ONLY",
    ...overrides,
  };
}

function merchantDayInput(
  shipments: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    merchant: { id: "40000000-0000-4000-8000-000000000001", name: "Tienda Aurora" },
    date: "2026-10-02",
    support: { phone: "3005550101", companyName: "Cohex" },
    publicBaseUrl: "https://tracking.example.test",
    shipments,
    ...overrides,
  };
}

function merchantRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: merchantRecordId(1),
    kind: "delivery",
    outcome: "applied",
    reverted: null,
    occurredAt: "2026-10-02T17:15:00.000Z",
    recordedAt: "2026-10-02T17:16:00.000Z",
    receivedByName: "ACTUAL_RECEIVER",
    cashAmount: 0,
    companyTransferAmount: 0,
    merchantTransferAmount: 0,
    exceptionReason: null,
    note: null,
    photos: [],
    courierIdentity: "PRIVATE_COURIER_IDENTITY",
    authorIdentity: "PRIVATE_AUTHOR_IDENTITY",
    location: { latitude: 6.25, longitude: -75.57, accuracyM: 3 },
    disbursementAmount: 44_000,
    payee: "PRIVATE_PAYEE",
    ...overrides,
  };
}

function merchantCollectionSource(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "delivery",
    outcome: "applied",
    reverted: null,
    cashAmount: 0,
    companyTransferAmount: 0,
    merchantTransferAmount: 0,
    ...overrides,
  };
}

function merchantShipmentInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    shipment: merchantShipmentRow({ status: "delivered" }),
    publicBaseUrl: "https://tracking.example.test",
    now: new Date("2026-10-03T17:15:00.000Z"),
    statusAt: "2026-10-02T17:15:00.000Z",
    effectiveRecord: merchantRecord(),
    attempts: [],

    ...overrides,
  };
}

const merchantSummaryKeys = [
  "id",
  "trackingNumber",
  "kind",
  "status",
  "serviceDate",
  "merchantReference",
  "recipientName",
  "neighborhood",
  "window",
  "fee",
  "feeToConfirm",
  "codAmount",
  "trackingLink",
] as const;

const merchantDayKeys = ["merchantName", "date", "support", "shipments", "totals"] as const;

const merchantShipmentKeys = [
  ...merchantSummaryKeys,
  "statusAt",
  "receivedByName",
  "collected",
  "photos",
] as const;

function expectExactKeys(value: unknown, allowed: readonly string[]): void {
  const object = outputObject.parse(value);
  expect(Object.keys(object).sort()).toEqual([...allowed].sort());
}

function expectNoPrivateValues(value: unknown, privateValues: readonly string[]): void {
  const serialized = JSON.stringify(value);
  for (const privateValue of privateValues) {
    expect(serialized).not.toContain(privateValue);
  }
}

function expectPublicKeys(view: Record<string, unknown>): void {
  for (const key of Object.keys(view)) expect(publicTrackingKeys.has(key)).toBe(true);
}

function expectedStatusText(kind: ShipmentKind, status: ShipmentStatus): string {
  if (status === "exception") return "No pudimos entregar tu envío";
  if (status === "returned") return "Devuelto al remitente";
  if (status === "voided") return "Este envío fue anulado";

  if (kind === "reverse_pickup") {
    if (status === "registered" || status === "assigned" || status === "dispatched") {
      return "Recogeremos el paquete en tu dirección";
    }
    if (status === "picked_up") return "En camino al remitente";
    return "Entregado al remitente a las 3:45 p. m.";
  }

  if (kind === "errand") {
    if (status === "registered" || status === "assigned") return "Programada";
    if (status === "dispatched" || status === "picked_up") return "En curso";
    return "Realizada";
  }

  if (status === "registered" || status === "assigned") return "Recibimos tu envío";
  if (status === "dispatched") {
    return "Tu envío va a ser recogido";
  }
  if (status === "picked_up") {
    return "En camino";
  }
  if (kind === "carrier_handoff") {
    return "Entregado a la transportadora Coonorte para Copacabana";
  }
  return "Entregado a María López a las 3:45 p. m.";
}

describe("publicTrackingView (T009, FR-003–FR-014)", () => {
  describe.each(shipmentKinds)("status wording for %s", (kind) => {
    it.each(shipmentStatuses)("projects %s without widening the public contract", (status) => {
      const view = publicTrackingView(
        shipmentFixture(kind, status),
        contextFixture({
          route:
            status === "dispatched" || status === "picked_up" ? contextFixture()["route"] : null,
          deliveriesBefore: 3,
        }),
      );

      expect(view["statusText"]).toBe(expectedStatusText(kind, status));
      expect(view["merchantName"]).toBe("Tienda Aurora");
      expect(view["trackingNumber"]).toBe("12345678");
      expect(view["kind"]).toBe(kind);
      expect(view["serviceDate"]).toBe("2026-10-02");
      expect(view["window"]).toEqual({
        start: "2026-10-01T20:00:00.000Z",
        end: "2026-10-01T21:00:00.000Z",
      });
      expect(view["support"]).toEqual({ phone: "3005550101", companyName: "Cohex" });
      expect(view["expired"]).toBe(false);
      expectPublicKeys(view);

      const serialized = JSON.stringify(view);
      for (const forbidden of [
        intendedRecipient,
        recipientPhone,
        recipientAddress,
        pickupAddress,
        oldReceiver,
        privateNote,
        privatePhotoKey,
        "PRIVATE_ERRAND_DESCRIPTION",
        "PRIVATE_EVENT_ACTOR",
        "PRIVATE_INSTRUCTIONS",
        "PRIVATE_FEE_REASON",
        "PRIVATE_MERCHANT_REFERENCE",
        "PRIVATE_RATE_ZONE",
        "PRIVATE_REGISTERED_BY",
        "PRIVATE_REVERTOR",
        "PRIVATE_VOID_REASON",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }

      if (kind === "carrier_handoff") {
        expect(view["carrierName"]).toBe("Coonorte");
        expect(view["destinationTown"]).toBe("Copacabana");
        expect(view).not.toHaveProperty("neighborhood");
      } else {
        expect(view).not.toHaveProperty("carrierName");
        expect(view).not.toHaveProperty("destinationTown");
        expect(view["neighborhood"]).toBe(kind === "errand" ? null : "Laureles");
      }

      if (status === "delivered") {
        expect(view["deliveredAt"]).toBe(deliveredAt);
        if (kind === "delivery" || kind === "reverse_pickup") {
          expect(view["deliveredTo"]).toBe("María López");
        } else if (kind === "carrier_handoff") {
          expect(view["deliveredTo"]).toBe("Coonorte para Copacabana");
        } else {
          expect(view["deliveredTo"]).toBeNull();
        }
        if (kind === "reverse_pickup") {
          expect(view["statusText"]).not.toContain(intendedRecipient);
        }
      } else {
        expect(view).not.toHaveProperty("deliveredTo");
        expect(view).not.toHaveProperty("deliveredAt");
      }
    });
  });

  it("keeps the window key with a null or partial UTC window", () => {
    const absent = publicTrackingView(
      shipmentFixture("delivery", "registered", { windowStart: null, windowEnd: null }),
      contextFixture(),
    );
    const partial = publicTrackingView(
      shipmentFixture("delivery", "registered", {
        windowStart: "2026-10-01T20:00:00.000Z",
        windowEnd: null,
      }),
      contextFixture(),
    );

    expect(absent["window"]).toBeNull();
    expect(partial["window"]).toEqual({ start: "2026-10-01T20:00:00.000Z", end: null });
  });

  it("keeps the support company when its phone is not configured", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "registered"),
      contextFixture({ support: { phone: null, companyName: "Cohex" } }),
    );

    expect(view["support"]).toEqual({ phone: null, companyName: "Cohex" });
  });

  it.each([
    ["recipient_absent", "No encontramos a nadie"],
    ["wrong_address", "La dirección no es correcta"],
    ["rejected", "El envío no fue recibido"],
  ] as const)("uses recipient-friendly exception text for %s", (reason, expected) => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "exception"),
      contextFixture({ exceptionReason: reason, returnDecided: false }),
    );

    expect(view["reasonText"]).toBe(expected);
  });

  it("hides the exception reason when return has been decided", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "exception"),
      contextFixture({ returnDecided: true }),
    );

    expect(view["statusText"]).toBe("Tu envío será devuelto al remitente");
    expect(view).not.toHaveProperty("reasonText");
  });

  it.each(["registered", "assigned"] as const)(
    "marks a %s shipment reprogrammed after an exception",
    (status) => {
      const view = publicTrackingView(
        shipmentFixture("delivery", status),
        contextFixture({ reprogrammedAfterException: true }),
      );

      expect(view["statusText"]).toMatch(/^Reprogramado para .+/);
      expect(view["statusText"]).toContain("2 de octubre de 2026");
    },
  );

  it("shows a reprogrammed service date when a picked-up shipment is off route or held at the office", () => {
    for (const context of [
      contextFixture({ route: null, custodyCourier: { id: "holder", name: "Ana Ruiz" } }),
      contextFixture({ route: null, custodyCourier: null, heldAtOffice: true }),
      contextFixture({ heldAtOffice: true, custodyCourier: null }),
    ]) {
      const view = publicTrackingView(shipmentFixture("delivery", "picked_up"), context);

      expect(view["statusText"]).toMatch(/^Reprogramado/);
      expect(view).not.toHaveProperty("courier");
      expect(view).not.toHaveProperty("deliveriesBefore");
    }
  });

  it.each(["reverse_pickup", "carrier_handoff"] as const)(
    "reprograms a picked-up %s off route or held at the office",
    (kind) => {
      for (const context of [
        contextFixture({ route: null }),
        contextFixture({
          route: { id: "route-1", status: "finished", courier: null },
        }),
        contextFixture({ heldAtOffice: true }),
      ]) {
        const view = publicTrackingView(shipmentFixture(kind, "picked_up"), context);

        expect(view["statusText"]).toBe("Reprogramado para 2 de octubre de 2026");
        expect(view).not.toHaveProperty("courier");
        expect(view).not.toHaveProperty("deliveriesBefore");
      }
    },
  );

  it("shows the route courier before pickup and the current custodian after pickup", () => {
    const dispatched = publicTrackingView(
      shipmentFixture("delivery", "dispatched"),
      contextFixture({ custodyCourier: null }),
    );
    const pickedUp = publicTrackingView(
      shipmentFixture("delivery", "picked_up"),
      contextFixture({
        custodyCourier: { id: "courier-holder", name: "Beto Gómez", phone: "3003334455" },
      }),
    );

    expect(dispatched["courier"]).toEqual({ firstName: "Luz", phone: "3002223344" });
    expect(pickedUp["courier"]).toEqual({ firstName: "Beto", phone: "3003334455" });
  });

  it.each(["dispatched", "picked_up"] as const)(
    "hides courier contact while a %s shipment has a pending handover",
    (status) => {
      const view = publicTrackingView(
        shipmentFixture("delivery", status),
        contextFixture({ handover: { id: "handover-1", status: "pending" } }),
      );

      expect(view).not.toHaveProperty("courier");
    },
  );

  it.each(["registered", "assigned", "exception", "delivered", "returned", "voided"] as const)(
    "does not show courier contact in %s status",
    (status) => {
      const view = publicTrackingView(shipmentFixture("delivery", status), contextFixture());

      expect(view).not.toHaveProperty("courier");
    },
  );

  it.each(shipmentStatuses)("shows COD only for %s when it remains payable", (status) => {
    const view = publicTrackingView(
      shipmentFixture("delivery", status, { codAmount: 85_000 }),
      contextFixture(),
    );

    if (status === "delivered" || status === "returned" || status === "voided") {
      expect(view).not.toHaveProperty("amountToPay");
    } else {
      expect(view["amountToPay"]).toBe(85_000);
    }
  });

  it("omits zero COD and does not leak the shipment fee", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "registered", { codAmount: 0 }),
      contextFixture(),
    );

    expect(view).not.toHaveProperty("amountToPay");
    expect(view).not.toHaveProperty("fee");
    expect(view).not.toHaveProperty("feeOverrideReason");
  });

  it("shows the reverse-pickup queue only before its pickup", () => {
    const beforePickup = publicTrackingView(
      shipmentFixture("reverse_pickup", "dispatched"),
      contextFixture({ deliveriesBefore: 2 }),
    );
    const afterPickup = publicTrackingView(
      shipmentFixture("reverse_pickup", "picked_up"),
      contextFixture({ deliveriesBefore: 2 }),
    );

    expect(beforePickup["deliveriesBefore"]).toBe(2);
    expect(afterPickup).not.toHaveProperty("deliveriesBefore");
  });

  it("shows the normal delivery queue only on an active route after pickup", () => {
    const active = publicTrackingView(
      shipmentFixture("delivery", "picked_up"),
      contextFixture({ deliveriesBefore: 0 }),
    );
    const inactive = publicTrackingView(
      shipmentFixture("delivery", "picked_up"),
      contextFixture({
        route: { id: "route-1", status: "finished", courier: { id: "c1", name: "Ana" } },
      }),
    );

    expect(active["deliveriesBefore"]).toBe(0);
    expect(inactive).not.toHaveProperty("deliveriesBefore");
  });

  it.each([
    ["dispatched", { route: { id: "route-1", status: "in_progress" } }],
    ["picked_up", { route: null }],
    ["exception", { returnDecided: true }],
  ] as const)("hides the normal delivery queue for %s", (status, overrides) => {
    const view = publicTrackingView(
      shipmentFixture("delivery", status),
      contextFixture({ deliveriesBefore: 2, ...overrides }),
    );

    expect(view).not.toHaveProperty("deliveriesBefore");
  });

  it("never shows a queue for an errand", () => {
    const view = publicTrackingView(
      shipmentFixture("errand", "picked_up"),
      contextFixture({ deliveriesBefore: 2 }),
    );

    expect(view).not.toHaveProperty("deliveriesBefore");
  });

  it("expires only after seven days from the effective final event's occurred time", () => {
    const finalOccurredAt = new Date("2026-10-01T20:45:00.000Z");
    const deadline = new Date(finalOccurredAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const finalShipment = shipmentFixture("delivery", "delivered", {
      updatedAt: "2026-10-07T20:45:00.000Z",
    });
    const finalContext = contextFixture({
      effectiveFinalEvent: {
        occurredAt: finalOccurredAt.toISOString(),
        recordedAt: "2026-10-01T20:46:00.000Z",
      },
    });
    const atDeadline = publicTrackingView(finalShipment, finalContext, deadline);
    const afterDeadline = publicTrackingView(
      finalShipment,
      finalContext,
      new Date(deadline.getTime() + 1),
    );

    expect(atDeadline["expired"]).toBe(false);
    expect(Object.keys(afterDeadline).sort()).toEqual(["expired", "support"]);
    expect(afterDeadline["expired"]).toBe(true);
  });

  it("uses a qualifying effective delivery record as the final instant when no event exists", () => {
    const context = contextFixture({
      effectiveFinalEvent: null,
      effectiveDeliveryRecord: {
        id: "record-current",
        kind: "delivery",
        outcome: "applied",
        receivedByName: "María López",
        occurredAt: deliveredAt,
        reverted: null,
      },
    });
    const finalShipment = shipmentFixture("delivery", "delivered");
    const deadline = new Date(new Date(deliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const atDeadline = publicTrackingView(finalShipment, context, deadline);
    const afterDeadline = publicTrackingView(
      finalShipment,
      context,
      new Date(deadline.getTime() + 1),
    );
    const reverted = publicTrackingView(
      finalShipment,
      contextFixture({
        effectiveFinalEvent: null,
        effectiveDeliveryRecord: {
          id: "record-reverted",
          kind: "delivery",
          outcome: "applied",
          receivedByName: oldReceiver,
          occurredAt: deliveredAt,
          reverted: { at: "2026-10-02T10:00:00.000Z" },
        },
      }),
      new Date(deadline.getTime() + 1),
    );

    expect(atDeadline["expired"]).toBe(false);
    expect(afterDeadline).toEqual({
      expired: true,
      support: { phone: "3005550101", companyName: "Cohex" },
    });
    expect(reverted["expired"]).toBe(false);
    expect(reverted).not.toHaveProperty("deliveredAt");
    expect(reverted).not.toHaveProperty("deliveredTo");
  });

  it.each(["delivered", "returned", "voided"] as const)(
    "expires a %s shipment from its current effective final event",
    (status) => {
      const finalOccurredAt = "2026-10-01T20:45:00.000Z";
      const view = publicTrackingView(
        shipmentFixture("delivery", status),
        contextFixture({
          effectiveFinalEvent: {
            occurredAt: finalOccurredAt,
            recordedAt: "2026-10-08T20:00:00.000Z",
          },
        }),
        new Date("2026-10-08T20:45:00.001Z"),
      );

      expect(Object.keys(view).sort()).toEqual(["expired", "support"]);
    },
  );

  it("does not expire or expose a stale received-by value after a final record is reverted", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "picked_up"),
      contextFixture({
        effectiveFinalEvent: null,
        effectiveDeliveryRecord: null,
        events: [
          {
            id: "event-final-old",
            type: "status_changed",
            toStatus: "delivered",
            occurredAt: "2026-10-01T20:45:00.000Z",
            courierRecordId: "record-old",
          },
          {
            id: "event-revert",
            type: "record_reverted",
            toStatus: "picked_up",
            occurredAt: "2026-10-02T10:00:00.000Z",
            courierRecordId: "record-old",
          },
        ],
        courierRecords: [
          {
            id: "record-old",
            kind: "delivery",
            outcome: "applied",
            receivedByName: oldReceiver,
            occurredAt: "2026-10-01T20:45:00.000Z",
            reverted: { at: "2026-10-02T10:00:00.000Z" },
          },
        ],
      }),
      new Date("2026-10-10T00:00:00.000Z"),
    );

    expect(view["expired"]).toBe(false);
    expect(view).not.toHaveProperty("deliveredTo");
    expect(view).not.toHaveProperty("deliveredAt");
    expect(JSON.stringify(view)).not.toContain(oldReceiver);
  });

  it("uses the current delivery record after a reverted delivery is recorded again", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "delivered"),
      contextFixture({
        effectiveFinalEvent: {
          occurredAt: "2026-10-10T20:45:00.000Z",
          recordedAt: "2026-10-10T20:46:00.000Z",
        },
        effectiveDeliveryRecord: {
          id: "record-new",
          kind: "delivery",
          outcome: "applied",
          receivedByName: "Carlos Pérez",
          occurredAt: "2026-10-10T20:45:00.000Z",
          reverted: null,
        },
        events: [
          {
            id: "event-old-revert",
            type: "record_reverted",
            toStatus: "picked_up",
            occurredAt: "2026-10-02T10:00:00.000Z",
            courierRecordId: "record-old",
          },
          {
            id: "event-new-delivery",
            type: "status_changed",
            toStatus: "delivered",
            occurredAt: "2026-10-10T20:45:00.000Z",
            courierRecordId: "record-new",
          },
        ],
      }),
      new Date("2026-10-11T00:00:00.000Z"),
    );

    expect(view["expired"]).toBe(false);
    expect(view["deliveredTo"]).toBe("Carlos Pérez");
    expect(view["deliveredTo"]).not.toBe(oldReceiver);
  });

  it("omits delivered provenance when effective time is missing, invalid, or reverted", () => {
    const cases = [
      contextFixture({ effectiveFinalEvent: null, effectiveDeliveryRecord: null }),
      contextFixture({
        effectiveFinalEvent: { occurredAt: "not-an-instant", recordedAt: deliveredAt },
        effectiveDeliveryRecord: {
          id: "record-reverted",
          kind: "delivery",
          outcome: "applied",
          receivedByName: oldReceiver,
          occurredAt: deliveredAt,
          reverted: { at: "2026-10-02T10:00:00.000Z" },
        },
      }),
    ];

    for (const context of cases) {
      const view = publicTrackingView(shipmentFixture("delivery", "delivered"), context);

      expect(view["statusText"]).toBe("Entregado");
      expect(view).not.toHaveProperty("deliveredAt");
      expect(view).not.toHaveProperty("deliveredTo");
      expect(JSON.stringify(view)).not.toContain(oldReceiver);
    }
  });

  it("accepts its public shape and rejects additional private fields", () => {
    const view = publicTrackingView(shipmentFixture("delivery", "registered"), contextFixture());
    const dispatched = publicTrackingView(
      shipmentFixture("delivery", "dispatched"),
      contextFixture(),
    );
    const expired = publicTrackingView(
      shipmentFixture("delivery", "delivered"),
      contextFixture(),
      new Date("2026-10-09T20:45:00.001Z"),
    );

    expect(parsePublicTracking(view)).toEqual(view);
    expect(() => parsePublicTracking({ ...view, recipientName: intendedRecipient })).toThrow();
    expect(() =>
      parsePublicTracking({
        ...view,
        support: { phone: "3005550101", companyName: "Cohex", officeAddress: pickupAddress },
      }),
    ).toThrow();
    expect(() =>
      parsePublicTracking({
        ...view,
        window: {
          start: "2026-10-01T20:00:00.000Z",
          end: "2026-10-01T21:00:00.000Z",
          pickupAddress,
        },
      }),
    ).toThrow();
    expect(() =>
      parsePublicTracking({
        ...dispatched,
        courier: { firstName: "Luz", phone: "3002223344", id: "private-courier-id" },
      }),
    ).toThrow();
    expect(() => parsePublicTracking({ ...expired, trackingNumber: "private" })).toThrow();
  });

  it("formats delivery time in Bogotá rather than UTC", () => {
    const view = publicTrackingView(
      shipmentFixture("delivery", "delivered"),
      contextFixture({
        effectiveFinalEvent: { occurredAt: deliveredAt, recordedAt: deliveredAt },
        effectiveDeliveryRecord: {
          id: "record-current",
          kind: "delivery",
          outcome: "applied",
          receivedByName: "María López",
          occurredAt: deliveredAt,
          reverted: null,
        },
      }),
    );

    expect(bogotaLocalTime(new Date(deliveredAt))).toBe("15:45");
    expect(view["statusText"]).toContain("3:45 p. m.");
    expect(view["statusText"]).not.toContain("8:45 p. m.");
    expect(view["deliveredAt"]).toBe(deliveredAt);
  });
});

describe("merchantDayView and merchantShipmentView (T023, FR-019–FR-020)", () => {
  it("projects the matching service-date cohort with strict list rows and safe aggregates", () => {
    const rows = [
      merchantShipmentRow({
        id: merchantShipmentId(2),
        trackingNumber: "82001001",
        trackingCode: merchantTrackingCode(1),
        status: "delivered",
        fee: 100_000,
        codAmount: 50_000,
        effectiveDelivery: merchantCollectionSource({
          cashAmount: 30_000,
          companyTransferAmount: 10_000,
          merchantTransferAmount: 10_000,
        }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(3),
        trackingNumber: "82001002",
        trackingCode: merchantTrackingCode(2),
        status: "delivered",
        fee: 30_000,
        codAmount: 100_000,
        effectiveDelivery: merchantCollectionSource({
          reverted: { at: "2026-10-02T18:00:00.000Z", by: "PRIVATE_REVERTOR" },
          cashAmount: 70_000,
        }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(4),
        trackingNumber: "82001003",
        trackingCode: merchantTrackingCode(3),
        status: "dispatched",
        fee: 20_000,
        codAmount: 80_000,
        effectiveDelivery: merchantCollectionSource({
          outcome: "not_applied",
          cashAmount: 60_000,
        }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(5),
        trackingNumber: "82001004",
        trackingCode: merchantTrackingCode(4),
        status: "registered",
        fee: 1_234_567,
        feeNeedsReview: true,
        codAmount: 90_000,
      }),
      merchantShipmentRow({
        id: merchantShipmentId(6),
        trackingNumber: "82001005",
        trackingCode: merchantTrackingCode(5),
        status: "voided",
        fee: 90_000,
        feeNeedsReview: true,
        codAmount: 75_000,
        effectiveDelivery: merchantCollectionSource({ cashAmount: 80_000 }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(7),
        trackingNumber: "82001006",
        trackingCode: merchantTrackingCode(6),
        serviceDate: "2026-10-01",
        status: "delivered",
        fee: 50_000,
        codAmount: 40_000,
        effectiveDelivery: merchantCollectionSource({ cashAmount: 90_000 }),
      }),
    ];

    const view = merchantProjection("merchantDayView", merchantDayInput(rows));
    const shipments = z.array(outputObject).parse(view["shipments"]);
    const byId = new Map(shipments.map((shipment) => [shipment["id"], shipment]));
    const needsConfirmation = byId.get(merchantShipmentId(5));
    const voided = byId.get(merchantShipmentId(6));
    const totals = outputObject.parse(view["totals"]);
    const statusCounts = outputObject.parse(totals["byStatus"]);
    const collections = outputObject.parse(totals["collectedByMethod"]);

    expect(view["merchantName"]).toBe("Tienda Aurora");
    expect(view["date"]).toBe("2026-10-02");
    expect(view["support"]).toEqual({ phone: "3005550101", companyName: "Cohex" });
    expect(shipments.map((shipment) => shipment["id"]).sort()).toEqual([
      merchantShipmentId(2),
      merchantShipmentId(3),
      merchantShipmentId(4),
      merchantShipmentId(5),
      merchantShipmentId(6),
    ]);
    expect(shipments).toHaveLength(5);
    for (const shipment of shipments) expectExactKeys(shipment, merchantSummaryKeys);
    expect(needsConfirmation?.["fee"]).toBeNull();
    expect(needsConfirmation?.["feeToConfirm"]).toBe(true);
    expect(voided?.["status"]).toBe("voided");
    expect(voided?.["fee"]).toBeNull();
    expect(view["date"]).not.toBe("2026-10-01");

    expect(statusCounts).toEqual({
      registered: 1,
      assigned: 0,
      dispatched: 1,
      picked_up: 0,
      delivered: 2,
      exception: 0,
      returned: 0,
      voided: 0,
    });
    expect(totals["confirmedFees"]).toBe(150_000);
    expect(totals["feeToConfirmCount"]).toBe(1);
    expect(totals["codToCollect"]).toBe(170_000);
    expect(collections).toEqual({
      cash: 30_000,
      companyTransfer: 10_000,
      merchantTransfer: 10_000,
    });

    const delivered = byId.get(merchantShipmentId(2));
    expect(delivered?.["trackingLink"]).toBe(
      `https://tracking.example.test/seguimiento/${merchantTrackingCode(1)}`,
    );
    expect(delivered).not.toHaveProperty("trackingCode");
    expectNoPrivateValues(view, [
      "3001234567",
      "Calle 10 # 43-12, Torre Peñón",
      "Carrera 50 # 20-30",
      "PRIVATE_MERCHANT_SOURCE_ONLY",
      "PRIVATE_REVERTOR",
      "1234567",
    ]);
  });

  it("allows safe aggregate COP totals above PostgreSQL int4", () => {
    const rows = [
      merchantShipmentRow({
        id: merchantShipmentId(8),
        trackingCode: merchantTrackingCode(7),
        status: "delivered",
        fee: 2_000_000_000,
        effectiveDelivery: merchantCollectionSource({ cashAmount: 2_000_000_000 }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(9),
        trackingCode: merchantTrackingCode(8),
        status: "delivered",
        fee: 2_000_000_000,
        effectiveDelivery: merchantCollectionSource({ cashAmount: 2_000_000_000 }),
      }),
    ];
    const view = merchantProjection("merchantDayView", merchantDayInput(rows));
    const totals = outputObject.parse(view["totals"]);
    const collections = outputObject.parse(totals["collectedByMethod"]);

    expect(totals["confirmedFees"]).toBe(4_000_000_000);
    expect(collections["cash"]).toBe(4_000_000_000);
    expect(Number.isSafeInteger(totals["confirmedFees"])).toBe(true);
  });

  it("defensively rejects unsafe aggregates from invalid source COP values", () => {
    const rows = [
      merchantShipmentRow({
        id: merchantShipmentId(10),
        trackingCode: merchantTrackingCode(9),
        status: "delivered",
        effectiveDelivery: merchantCollectionSource({ cashAmount: Number.MAX_SAFE_INTEGER }),
      }),
      merchantShipmentRow({
        id: merchantShipmentId(11),
        trackingCode: merchantTrackingCode(10),
        status: "delivered",
        effectiveDelivery: merchantCollectionSource({ cashAmount: 1 }),
      }),
    ];

    expect(() => merchantProjection("merchantDayView", merchantDayInput(rows))).toThrow(RangeError);
  });

  it("validates strict MerchantDay, summary, totals, and nested allowlists", () => {
    const view = merchantProjection("merchantDayView", merchantDayInput([merchantShipmentRow()]));
    const rows = z.array(outputObject).parse(view["shipments"]);
    const summary = rows.at(0);
    if (!summary) throw new Error("Expected one merchant list row.");
    const support = outputObject.parse(view["support"]);
    const totals = outputObject.parse(view["totals"]);
    const statusCounts = outputObject.parse(totals["byStatus"]);
    const collections = outputObject.parse(totals["collectedByMethod"]);
    const window = outputObject.parse(summary["window"]);

    expectExactKeys(view, merchantDayKeys);
    expectExactKeys(summary, merchantSummaryKeys);
    expect(parseMerchantSchema("merchantDaySchema", view)).toEqual(view);
    expect(parseMerchantSchema("merchantShipmentSummarySchema", summary)).toEqual(summary);
    expect(parseMerchantSchema("merchantDayTotalsSchema", totals)).toEqual(totals);
    const acceptedInt4Overflows: string[] = [];
    const int4OverflowSummaries: [string, Record<string, unknown>][] = [
      ["fee", { ...summary, fee: 2_147_483_648 }],
      ["codAmount", { ...summary, codAmount: 2_147_483_648 }],
    ];
    for (const [field, invalidSummary] of int4OverflowSummaries) {
      try {
        parseMerchantSchema("merchantShipmentSummarySchema", invalidSummary);
        acceptedInt4Overflows.push(field);
      } catch {
        // The summary schema must reject values that cannot be stored in an int4 column.
      }
    }
    expect(acceptedInt4Overflows).toEqual([]);
    expect(() =>
      parseMerchantSchema("merchantDaySchema", { ...view, recipientPhone: "3001234567" }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantDaySchema", {
        ...view,
        support: { ...support, officeAddress: "PRIVATE_OFFICE_ADDRESS" },
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantShipmentSummarySchema", {
        ...summary,
        recipientAddress: "PRIVATE_RECIPIENT_ADDRESS",
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantShipmentSummarySchema", {
        ...summary,
        window: { ...window, pickupAddress: "PRIVATE_PICKUP_ADDRESS" },
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantDayTotalsSchema", {
        ...totals,
        collectedByMethod: { ...collections, balance: 1 },
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantDayTotalsSchema", {
        ...totals,
        byStatus: { ...statusCounts, unknown: 1 },
      }),
    ).toThrow();
  });

  it("projects the effective current delivery receiver, status time, and collection only", () => {
    const view = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        shipment: merchantShipmentRow({
          status: "delivered",
          recipientName: "INTENDED_RECIPIENT_NAME",
          updatedAt: "PRIVATE_UPDATED_AT",
        }),
        statusAt: "2026-10-02T17:15:00.000Z",
        effectiveRecord: merchantRecord({
          kind: "delivery",
          receivedByName: "ACTUAL_RECEIVER_NAME",
          cashAmount: 12_000,
          companyTransferAmount: 7_000,
          merchantTransferAmount: 2_000,
          note: "PRIVATE_DELIVERY_NOTE",
        }),
      }),
    );
    const collected = outputObject.parse(view["collected"]);

    expectExactKeys(view, merchantShipmentKeys);
    expect(view["statusAt"]).toBe("2026-10-02T17:15:00.000Z");
    expect(view["recipientName"]).toBe("INTENDED_RECIPIENT_NAME");
    expect(view["receivedByName"]).toBe("ACTUAL_RECEIVER_NAME");
    expect(view["receivedByName"]).not.toBe(view["recipientName"]);
    expect(collected).toEqual({
      cash: 12_000,
      companyTransfer: 7_000,
      merchantTransfer: 2_000,
      total: 21_000,
    });
    expect(view["photos"]).toEqual([]);
    expect(view).not.toHaveProperty("support");
    expect(view).not.toHaveProperty("exception");
    expect(view).not.toHaveProperty("trackingCode");
    expect(view["trackingLink"]).toBe(
      `https://tracking.example.test/seguimiento/${merchantTrackingCode(1)}`,
    );
    expectNoPrivateValues(view, [
      "3001234567",
      "Calle 10 # 43-12, Torre Peñón",
      "Carrera 50 # 20-30",
      "PRIVATE_UPDATED_AT",
      "PRIVATE_DELIVERY_NOTE",
      "PRIVATE_COURIER_IDENTITY",
      "PRIVATE_AUTHOR_IDENTITY",
      "PRIVATE_PAYEE",
      "private-record-id",
      "PRIVATE_PHOTO_KEY",
    ]);
  });

  it("returns null provenance and zero collection rather than falling back to a reverted record", () => {
    const view = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        shipment: merchantShipmentRow({
          status: "delivered",
          updatedAt: "PRIVATE_UPDATED_AT",
        }),
        statusAt: null,
        effectiveRecord: merchantRecord({
          reverted: { at: "2026-10-02T18:00:00.000Z", by: "PRIVATE_REVERTOR" },
          receivedByName: "STALE_RECEIVER_NAME",
          cashAmount: 99_000,
        }),
      }),
    );

    expect(view["statusAt"]).toBeNull();
    expect(view["receivedByName"]).toBeNull();
    expect(view["collected"]).toEqual({
      cash: 0,
      companyTransfer: 0,
      merchantTransfer: 0,
      total: 0,
    });
    expectNoPrivateValues(view, [
      "PRIVATE_UPDATED_AT",
      "PRIVATE_REVERTOR",
      "STALE_RECEIVER_NAME",
      "3001234567",
    ]);
  });

  it("uses a current return receiver but never treats return values as delivery collections", () => {
    const view = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        shipment: merchantShipmentRow({ status: "returned" }),
        statusAt: "2026-10-02T18:30:00.000Z",
        effectiveRecord: merchantRecord({
          kind: "return",
          occurredAt: "2026-10-02T18:30:00.000Z",
          receivedByName: "ACTUAL_RETURN_RECEIVER",
          cashAmount: 45_000,
          companyTransferAmount: 5_000,
          merchantTransferAmount: 1_000,
        }),
      }),
    );

    expect(view["statusAt"]).toBe("2026-10-02T18:30:00.000Z");
    expect(view["receivedByName"]).toBe("ACTUAL_RETURN_RECEIVER");
    expect(view["collected"]).toEqual({
      cash: 0,
      companyTransfer: 0,
      merchantTransfer: 0,
      total: 0,
    });
    expect(view).not.toHaveProperty("exception");
  });

  it("accepts safe detail totals above int4 and defensively rejects invalid-source unsafe sums", () => {
    const valid = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        effectiveRecord: merchantRecord({
          cashAmount: 2_000_000_000,
          companyTransferAmount: 2_000_000_000,
        }),
      }),
    );
    const invalidInput = merchantShipmentInput({
      effectiveRecord: merchantRecord({
        cashAmount: Number.MAX_SAFE_INTEGER,
        companyTransferAmount: 1,
      }),
    });

    expect(valid["collected"]).toEqual({
      cash: 2_000_000_000,
      companyTransfer: 2_000_000_000,
      merchantTransfer: 0,
      total: 4_000_000_000,
    });
    expect(() => merchantProjection("merchantShipmentView", invalidInput)).toThrow(RangeError);
  });

  it("projects only proof metadata at the 24-hour boundary without promising object availability", () => {
    const recordedAt = "2026-10-02T17:16:00.000Z";
    const photos = [
      { id: merchantPhotoId(7), kind: "proof", uploaded: false, storageKey: "PRIVATE_PENDING_KEY" },
      { id: merchantPhotoId(8), kind: "proof", uploaded: true, storageKey: "PRIVATE_UPLOADED_KEY" },
      {
        id: merchantPhotoId(9),
        kind: "transfer_receipt",
        uploaded: true,
        storageKey: "PRIVATE_PAY_KEY",
      },
    ];
    const currentRecord = merchantRecord({ recordedAt, photos });
    const pending = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        now: new Date("2026-10-03T17:15:59.999Z"),
        effectiveRecord: currentRecord,
      }),
    );
    const atBoundary = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        now: new Date("2026-10-03T17:16:00.000Z"),
        effectiveRecord: currentRecord,
      }),
    );

    expect(pending["photos"]).toEqual([
      { id: merchantPhotoId(7), status: "pending" },
      { id: merchantPhotoId(8), status: "uploaded" },
    ]);
    expect(atBoundary["photos"]).toEqual([
      { id: merchantPhotoId(7), status: "unavailable" },
      { id: merchantPhotoId(8), status: "uploaded" },
    ]);
    expectNoPrivateValues(pending, [
      "PRIVATE_PENDING_KEY",
      "PRIVATE_UPLOADED_KEY",
      "PRIVATE_PAY_KEY",
      "storageKey",
    ]);
  });

  it("includes only corrected applied attempts and replaces every nonblank note with a support notice", () => {
    const currentException = merchantRecord({
      id: merchantRecordId(7),
      kind: "exception",
      outcome: "applied",
      exceptionReason: "wrong_address",
      receivedByName: null,
      note: "Llamar +57 (300) 123-45-67 y revisar Carrera 50 #20-30.",
    });
    const includedDelivery = merchantRecord({
      id: merchantRecordId(8),
      kind: "delivery",
      occurredAt: "2026-10-02T16:00:00.000Z",
      exceptionReason: null,
      note: "El otro mensajero es 3003334455; volver a intentar.",
    });
    const includedException = merchantRecord({
      ...currentException,
      id: merchantRecordId(7),
      occurredAt: "2026-10-02T17:15:00.000Z",
      note: "Llamar +57 (300) 123-45-67 y revisar Carrera 50 #20-30.",
    });
    const candidates = [
      includedDelivery,
      includedException,
      merchantRecord({
        id: merchantRecordId(9),
        kind: "exception",
        outcome: "not_applied",
        note: "PRIVATE_UNAPPLIED_NOTE",
      }),
      merchantRecord({
        id: merchantRecordId(10),
        kind: "delivery",
        reverted: { at: "2026-10-02T18:00:00.000Z" },
        note: "PRIVATE_REVERTED_NOTE",
      }),
      merchantRecord({ kind: "pickup", note: "PRIVATE_NON_ATTEMPT_NOTE" }),
    ];
    const input = merchantShipmentInput({
      shipment: merchantShipmentRow({ status: "exception" }),
      statusAt: "2026-10-02T17:15:00.000Z",
      effectiveRecord: currentException,
      attempts: candidates,
    });
    const before = structuredClone(input);
    const view = merchantProjection("merchantShipmentView", input);
    const exception = outputObject.parse(view["exception"]);
    const attempts = z.array(outputObject).parse(exception["attempts"]);

    expectExactKeys(view, [...merchantShipmentKeys, "exception"]);
    expect(exception["reason"]).toBe("La dirección no es correcta");
    expect(exception["note"]).toBe(merchantSupportNotice);
    expect(attempts).toEqual([
      {
        kind: "delivery",
        occurredAt: "2026-10-02T16:00:00.000Z",
        reason: null,
        note: merchantSupportNotice,
      },
      {
        kind: "exception",
        occurredAt: "2026-10-02T17:15:00.000Z",
        reason: "La dirección no es correcta",
        note: merchantSupportNotice,
      },
    ]);
    expect(view["receivedByName"]).toBeNull();
    expect(view["collected"]).toEqual({
      cash: 0,
      companyTransfer: 0,
      merchantTransfer: 0,
      total: 0,
    });
    expectExactKeys(exception, ["reason", "note", "attempts"]);
    for (const attempt of attempts)
      expectExactKeys(attempt, ["kind", "occurredAt", "reason", "note"]);
    expectNoPrivateValues(view, [
      "3001234567",
      "+57 (300) 123-45-67",
      "3002223344",
      "3003334455",
      "Carrera 50 # 20-30",
      "Calle 10 # 43-12, Torre Peñón",
      merchantRecordId(9),
      "PRIVATE_UNAPPLIED_NOTE",
      merchantRecordId(10),
      "PRIVATE_REVERTED_NOTE",
      "PRIVATE_NON_ATTEMPT_NOTE",
      "PRIVATE_COURIER_IDENTITY",
      "PRIVATE_AUTHOR_IDENTITY",
      merchantRecordId(7),
      "PRIVATE_PAYEE",
      "PRIVATE_PHOTO_KEY",
    ]);
    expect(input).toEqual(before);
  });

  it("replaces phone and contact URL notes without requiring private lookup inputs", () => {
    const rawNote = "Llamar +57 (300) 123-45-67; tel:+573001234567; https://wa.me/573001234567.";
    const record = merchantRecord({ kind: "exception", note: rawNote });
    const input = merchantShipmentInput({
      shipment: merchantShipmentRow({ status: "exception" }),
      effectiveRecord: record,
      attempts: [record],
    });
    const before = structuredClone(input);
    const view = merchantProjection("merchantShipmentView", input);
    const exception = outputObject.parse(view["exception"]);
    const attempts = z.array(outputObject).parse(exception["attempts"]);
    expect(exception["note"]).toBe(merchantSupportNotice);
    expect(attempts[0]?.["note"]).toBe(merchantSupportNotice);
    expectNoPrivateValues(view, [rawNote, "3001234567", "+57", "wa.me", "tel:"]);
    expect(input).toEqual(before);
  });

  it("replaces address and benign notes equally and rejects raw note wire values", () => {
    for (const rawNote of [
      "Entregar en CALLE10 #43–12, TORRE Pen\u0303o\u0301n; referencia 315.987.6543.",
      "Dejar el paquete con portería; llamar al llegar.",
    ]) {
      const record = merchantRecord({ kind: "exception", note: rawNote });
      const view = merchantProjection(
        "merchantShipmentView",
        merchantShipmentInput({
          shipment: merchantShipmentRow({ status: "exception" }),
          effectiveRecord: record,
          attempts: [record],
        }),
      );
      const exception = outputObject.parse(view["exception"]);
      const attempts = z.array(outputObject).parse(exception["attempts"]);
      expect(exception["note"]).toBe(merchantSupportNotice);
      expect(attempts[0]?.["note"]).toBe(merchantSupportNotice);
      expectNoPrivateValues(view, [rawNote]);
      expect(() =>
        parseMerchantSchema("merchantShipmentSchema", {
          ...view,
          exception: { ...exception, note: rawNote },
        }),
      ).toThrow();
      expect(() =>
        parseMerchantSchema("merchantShipmentSchema", {
          ...view,
          exception: { ...exception, attempts: [{ ...attempts[0], note: rawNote }] },
        }),
      ).toThrow();
    }
  });

  it("keeps empty and whitespace-only current and attempt notes null", () => {
    for (const note of ["", " ", "\t\n"]) {
      const record = merchantRecord({ kind: "exception", note });
      const view = merchantProjection(
        "merchantShipmentView",
        merchantShipmentInput({
          shipment: merchantShipmentRow({ status: "exception" }),
          effectiveRecord: record,
          attempts: [record],
        }),
      );
      const exception = outputObject.parse(view["exception"]);
      const attempts = z.array(outputObject).parse(exception["attempts"]);
      expect(exception["note"]).toBeNull();
      expect(attempts[0]?.["note"]).toBeNull();
    }
  });

  it("keeps absent notes null and rejects private nested detail fields", () => {
    const view = merchantProjection(
      "merchantShipmentView",
      merchantShipmentInput({
        shipment: merchantShipmentRow({ status: "exception" }),
        effectiveRecord: merchantRecord({
          kind: "exception",
          exceptionReason: null,
          receivedByName: null,
          note: null,
        }),
        attempts: [
          merchantRecord({
            kind: "exception",
            exceptionReason: null,
            receivedByName: null,
            note: null,
          }),
        ],
      }),
    );
    const exception = outputObject.parse(view["exception"]);
    const attempts = z.array(outputObject).parse(exception["attempts"]);
    const collected = outputObject.parse(view["collected"]);
    const photos = z.array(outputObject).parse(view["photos"]);
    const firstAttempt = attempts.at(0);
    if (!firstAttempt) throw new Error("Expected one exception attempt.");

    expect(parseMerchantSchema("merchantShipmentSchema", view)).toEqual(view);
    expect(view["exception"]).toEqual({ reason: null, note: null, attempts: [firstAttempt] });
    expect(() =>
      parseMerchantSchema("merchantShipmentSchema", { ...view, recipientPhone: "3001234567" }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantShipmentSchema", {
        ...view,
        collected: { ...collected, balance: 1 },
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantShipmentSchema", {
        ...view,
        photos: [
          ...photos,
          { id: merchantPhotoId(10), status: "uploaded", storageKey: "PRIVATE_KEY" },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseMerchantSchema("merchantShipmentSchema", {
        ...view,
        exception: { ...exception, attempts: [{ ...firstAttempt, courierId: "PRIVATE_ID" }] },
      }),
    ).toThrow();
  });
});

describe("publicTrackingStage (feature 006, US4)", () => {
  it("reads where a tracking view stands from its own fields", () => {
    expect(publicTrackingStage({ statusText: "En camino" })).toBe("progress");
    expect(publicTrackingStage({ statusText: "Recibimos tu envío" })).toBe("progress");
    expect(
      publicTrackingStage({
        statusText: "Entregado a María a las 11:00 a. m.",
        deliveredAt: "2026-10-01T16:00:00.000Z",
      }),
    ).toBe("delivered");
    expect(
      publicTrackingStage({
        statusText: "No pudimos entregar tu envío",
        reasonText: "No encontramos a nadie",
      }),
    ).toBe("problem");
    expect(publicTrackingStage({ statusText: "Tu envío será devuelto al remitente" })).toBe(
      "problem",
    );
    expect(publicTrackingStage({ statusText: "Devuelto al remitente" })).toBe("closed");
    expect(publicTrackingStage({ statusText: "Este envío fue anulado" })).toBe("closed");
  });
});
