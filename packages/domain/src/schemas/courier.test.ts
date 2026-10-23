import { describe, expect, it } from "vitest";
import {
  collectionProblem,
  companySettingsInput,
  courierRecordInput,
  courierRecordsBatch,
  exceptionDecisionInput,
  noticeAcknowledgeInput,
  receivedByNameProblem,
  recordCorrectionInput,
  recordCorrectionProblem,
  recordOnBehalfInput,
  pushSubscriptionInput,
} from "./courier.ts";

const id = (n: number) => `0194d9f0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const base = { id: id(1), shipmentId: id(2), occurredAt: "2026-10-01T15:00:00.000Z" };

describe("kind-specific corrections (T072, FR-035)", () => {
  it.each([
    [{ amount: 0 }, "El pago debe ser mayor que cero."],
    [{ amount: 1.5 }, "Usa pesos enteros, sin decimales."],
    [{ payee: "" }, "Escribe a quién se pagó."],
    [{ exceptionReason: "unknown" }, "Elige el motivo de la novedad."],
  ])("keeps correction errors in Spanish (T125): %j", (values, message) => {
    const parsed = recordCorrectionInput.safeParse({
      actionId: id(8),
      reason: "Corregido con el mensajero",
      ...values,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Invalid correction accepted");
    expect(parsed.error.issues[0]?.message).toBe(message);
  });
  const current = {
    kind: "delivery" as const,
    cashAmount: 50000,
    companyTransferAmount: 0,
    merchantTransferAmount: 0,
    note: null,
  };
  it("allows only a record kind's own fields", () => {
    expect(recordCorrectionProblem(current, { receivedByName: "Laura Gómez" }, 50000)).toBeNull();
    expect(
      recordCorrectionProblem(current, { exceptionReason: "wrong_address" }, 50000),
    ).not.toBeNull();
    expect(
      recordCorrectionProblem({ ...current, kind: "exception" }, { cashAmount: 0 }, 50000),
    ).not.toBeNull();
    expect(
      recordCorrectionProblem(
        { ...current, kind: "return" },
        { receivedByName: "Comercio" },
        50000,
      ),
    ).toBeNull();
    for (const kind of ["pickup", "problem", "handover_confirmation"] as const)
      expect(
        recordCorrectionProblem({ ...current, kind }, { note: "Nota corregida" }, 50000),
      ).not.toBeNull();
  });
  it("checks the resulting split, preserving an existing discrepancy explanation", () => {
    expect(recordCorrectionProblem(current, { cashAmount: 1 }, 50000)).not.toBeNull();
    expect(
      recordCorrectionProblem(current, { cashAmount: 40000, companyTransferAmount: 10000 }, 50000),
    ).toBeNull();
    expect(
      recordCorrectionProblem(
        { ...current, note: "Se acordó un cobro menor" },
        { cashAmount: 40000 },
        50000,
      ),
    ).toBeNull();
  });
});

describe("push endpoint boundary (T113, Constitution IX)", () => {
  it.each([
    "https://127.0.0.1/private",
    "http://fcm.googleapis.com/push",
    "https://fcm.googleapis.com.evil.test/push",
    "https://user:secret@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:444/push",
    "https://arbitrary.example.test/push",
  ])("refuses untrusted destination %s", (endpoint) => {
    expect(
      pushSubscriptionInput.safeParse({
        actionId: id(9),
        endpoint,
        keys: { p256dh: "key", auth: "auth" },
      }).success,
    ).toBe(false);
  });
  it.each([
    "https://fcm.googleapis.com/fcm/send/device",
    "https://web.push.apple.com/device",
    "https://updates.push.services.mozilla.com/wpush/v2/device",
  ])("accepts browser push service %s", (endpoint) => {
    expect(
      pushSubscriptionInput.safeParse({
        actionId: id(9),
        endpoint,
        keys: { p256dh: "key", auth: "auth" },
      }).success,
    ).toBe(true);
  });
});
const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

/** The courier's records as the phone saves them and the server receives them (FR-019). */
describe("courierRecordInput", () => {
  it("accepts each kind with its own fields", () => {
    for (const input of [
      { ...base, kind: "pickup" },
      {
        ...base,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 50_000,
        companyTransferAmount: 35_000,
        photos: [
          { id: id(3), kind: "proof" },
          { id: id(4), kind: "transfer_receipt" },
        ],
        location: { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 },
      },
      { ...base, kind: "exception", reason: "recipient_absent" },
      { ...base, kind: "problem", note: "El cliente no tenía el paquete listo" },
      { ...base, kind: "return", receivedByName: "Bodega Estadio" },
      { ...base, kind: "disbursement", amount: 12_000, payee: "Coonorte" },
      { ...base, kind: "handover_confirmation" },
    ]) {
      expect(courierRecordInput.safeParse(input).success, input.kind).toBe(true);
    }
  });

  it("fills the amounts not collected with zero", () => {
    const parsed = courierRecordInput.parse({ ...base, kind: "delivery", receivedByName: "Laura" });
    expect(parsed).toMatchObject({
      cashAmount: 0,
      companyTransferAmount: 0,
      merchantTransferAmount: 0,
      photos: [],
    });
  });

  it("explains in Spanish what a record is missing", () => {
    expect(
      messages(courierRecordInput.safeParse({ ...base, kind: "problem", note: "no" })),
    ).toEqual(["Escribe una nota de al menos 5 caracteres."]);
    expect(
      messages(courierRecordInput.safeParse({ ...base, kind: "delivery", receivedByName: "L" })),
    ).toEqual(["Escribe el nombre de quien recibe, de al menos 2 letras."]);
    expect(
      messages(
        courierRecordInput.safeParse({
          ...base,
          kind: "disbursement",
          amount: 0,
          payee: "Coonorte",
        }),
      ),
    ).toEqual(["El pago debe ser mayor que cero."]);
    expect(
      messages(courierRecordInput.safeParse({ ...base, kind: "delivery", cashAmount: 1.5 })),
    ).toContain("Usa pesos enteros, sin decimales.");
  });

  it("takes at most three proof photos (FR-009)", () => {
    const photos = [3, 4, 5, 6].map((n) => ({ id: id(n), kind: "proof" }));
    expect(
      messages(
        courierRecordInput.safeParse({
          ...base,
          kind: "delivery",
          receivedByName: "Laura",
          photos,
        }),
      ),
    ).toEqual(["Toma máximo 3 fotos de la prueba de entrega."]);
  });

  it("takes only the photo kinds of its record kind", () => {
    const result = courierRecordInput.safeParse({
      ...base,
      kind: "exception",
      reason: "rejected",
      photos: [{ id: id(3), kind: "proof" }],
    });
    expect(result.success).toBe(false);
  });

  it("refuses a kind it does not know and a location off the globe", () => {
    expect(courierRecordInput.safeParse({ ...base, kind: "teleport" }).success).toBe(false);
    expect(
      courierRecordInput.safeParse({
        ...base,
        kind: "pickup",
        location: { latitude: 120, longitude: 0, accuracyM: 5 },
      }).success,
    ).toBe(false);
  });
});

describe("courierRecordsBatch", () => {
  it("carries the phone's time and 1 to 50 records in the order they happened", () => {
    const records = Array.from({ length: 51 }, (_, n) => ({
      ...base,
      id: id(n + 10),
      kind: "pickup",
    }));
    const deviceNow = "2026-10-01T15:01:00.000Z";
    expect(
      courierRecordsBatch.safeParse({ deviceNow, records: records.slice(0, 50) }).success,
    ).toBe(true);
    expect(courierRecordsBatch.safeParse({ deviceNow, records }).success).toBe(false);
    expect(courierRecordsBatch.safeParse({ deviceNow, records: [] }).success).toBe(false);
  });
});

describe("collectionProblem (FR-010, FR-011)", () => {
  const delivery = { cashAmount: 80_000, companyTransferAmount: 0, merchantTransferAmount: 0 };

  it("asks for a note when the collected total differs from the COD amount", () => {
    expect(collectionProblem(85_000, delivery)).toBe(
      "Lo cobrado es distinto del valor a recaudar: escribe una nota de al menos 5 caracteres.",
    );
    expect(
      collectionProblem(85_000, { ...delivery, note: "Pagó 80.000, el resto mañana" }),
    ).toBeNull();
    expect(collectionProblem(80_000, delivery)).toBeNull();
  });
});

describe("receivedByNameProblem (FR-008)", () => {
  it("asks who received a delivery, except for an errand", () => {
    expect(receivedByNameProblem("delivery", undefined)).toBe(
      "Escribe el nombre de quien recibe, de al menos 2 letras.",
    );
    expect(receivedByNameProblem("carrier_handoff", undefined)).not.toBeNull();
    expect(receivedByNameProblem("delivery", "Laura Gómez")).toBeNull();
    expect(receivedByNameProblem("errand", undefined)).toBeNull();
  });
});

describe("recordOnBehalfInput (FR-034)", () => {
  it("takes a record without its shipment, with the time it happened optional", () => {
    const { shipmentId: _, occurredAt: __, ...rest } = base;
    expect(
      recordOnBehalfInput.safeParse({ ...rest, kind: "delivery", receivedByName: "Laura" }).success,
    ).toBe(true);
    expect(recordOnBehalfInput.safeParse({ ...rest, kind: "handover_confirmation" }).success).toBe(
      false,
    );
  });
});

describe("exceptionDecisionInput (FR-029)", () => {
  it("is a new attempt, optionally dated and on a route, or a return", () => {
    const actionId = id(9);
    expect(exceptionDecisionInput.safeParse({ actionId, decision: "new_attempt" }).success).toBe(
      true,
    );
    expect(
      exceptionDecisionInput.safeParse({
        actionId,
        decision: "new_attempt",
        serviceDate: "2026-10-02",
        routeId: id(8),
      }).success,
    ).toBe(true);
    expect(
      exceptionDecisionInput.safeParse({ actionId, decision: "return", routeId: id(8) }).success,
    ).toBe(true);
    expect(exceptionDecisionInput.safeParse({ actionId, decision: "discard" }).success).toBe(false);
  });
});

describe("recordCorrectionInput (FR-035)", () => {
  it("needs a reason and at least one value to correct", () => {
    expect(
      messages(
        recordCorrectionInput.safeParse({ actionId: id(9), reason: "Se digitó mal el monto" }),
      ),
    ).toEqual(["Indica qué valor corriges."]);
    expect(
      recordCorrectionInput.safeParse({
        actionId: id(9),
        reason: "Se digitó mal el monto",
        cashAmount: 85_000,
      }).success,
    ).toBe(true);
  });
});

describe("noticeAcknowledgeInput (FR-027)", () => {
  it("acknowledges the notices shown, with the time it happened", () => {
    expect(
      noticeAcknowledgeInput.safeParse({
        actionId: id(9),
        noticeIds: [id(1)],
        occurredAt: base.occurredAt,
      }).success,
    ).toBe(true);
    expect(
      noticeAcknowledgeInput.safeParse({
        actionId: id(9),
        noticeIds: [],
        occurredAt: base.occurredAt,
      }).success,
    ).toBe(false);
  });
});

describe("companySettingsInput (FR-009, T008, R16)", () => {
  const actionId = id(10);

  it("accepts independent contact-only patches and explicitly clears a support phone", () => {
    expect(companySettingsInput.safeParse({ actionId }).success).toBe(true);
    expect(companySettingsInput.safeParse({ actionId, supportPhone: "3001234567" }).success).toBe(
      true,
    );
    expect(companySettingsInput.safeParse({ actionId, supportPhone: null }).success).toBe(true);
    expect(
      companySettingsInput.parse({ actionId, companyName: "  Cohex Medellín  " }).companyName,
    ).toBe("Cohex Medellín");
  });

  it.each(["300123456", "30012345678", "+573001234567", "300 123 4567", "abcdefghij"])(
    "rejects a support phone that is not ten Colombian digits: %s",
    (supportPhone) => {
      const parsed = companySettingsInput.safeParse({ actionId, supportPhone });
      expect(parsed.success).toBe(false);
      expect(messages(parsed)).toContain("Escribe un teléfono de 10 dígitos.");
    },
  );

  it("keeps the office address and neighborhood as an all-or-none patch pair", () => {
    expect(
      companySettingsInput.safeParse({
        actionId,
        officeAddress: "Carrera 90 # 65C-10",
        officeNeighborhoodId: id(11),
      }).success,
    ).toBe(true);
    expect(
      companySettingsInput.safeParse({ actionId, officeAddress: "Carrera 90 # 65C-10" }).success,
    ).toBe(false);
    expect(companySettingsInput.safeParse({ actionId, officeNeighborhoodId: id(11) }).success).toBe(
      false,
    );
  });

  it("rejects a blank company name with a Spanish correction", () => {
    const parsed = companySettingsInput.safeParse({ actionId, companyName: "   " });
    expect(parsed.success).toBe(false);
    expect(messages(parsed)).toContain("Escribe el nombre de la empresa.");
  });
});
