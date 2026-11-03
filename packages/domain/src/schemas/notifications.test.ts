import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as domain from "../index.ts";

type SafeParseSchema = { safeParse: (value: unknown) => unknown };

const merchantId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const shipmentId = "4a1966eb-dc9e-47eb-8cab-8c6cc999b293";
const actionId = "f3b6a343-117e-4df5-8818-9ba610b1386f";
const code = "AAAAAAAAAAAAAAAAAAAAAA";
const validationIssuesSchema = z.array(z.object({ message: z.string() }));

function isSafeParseSchema(value: unknown): value is SafeParseSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "safeParse" in value &&
    typeof value.safeParse === "function"
  );
}

function schema(name: string): SafeParseSchema {
  const exports: unknown = domain;
  if (typeof exports !== "object" || exports === null || !(name in exports)) {
    throw new Error(`T020 must export ${name} before the notification schema assertions can run.`);
  }
  const candidate = Reflect.get(exports, name);
  if (!isSafeParseSchema(candidate)) {
    throw new Error(`T020 must export ${name} as a Zod schema.`);
  }
  return candidate;
}

function succeeds(name: string, value: unknown): boolean {
  const result = schema(name).safeParse(value);
  return typeof result === "object" && result !== null && "success" in result
    ? result["success"] === true
    : false;
}

function issueMessages(name: string, value: unknown): string[] {
  const result = schema(name).safeParse(value);
  if (typeof result !== "object" || result === null || !("error" in result)) return [];
  const error = result["error"];
  if (typeof error !== "object" || error === null || !("issues" in error)) return [];
  const parsed = validationIssuesSchema.safeParse(error["issues"]);
  return parsed.success ? parsed.data.map((issue) => issue.message) : [];
}

const shipment = {
  id: shipmentId,
  trackingNumber: "12345678",
  trackingCode: code,
  recipientName: "Ana Rivera",
  neighborhood: "Laureles",
  status: "registered",
  notifiedAt: null,
};

const merchant = {
  merchantId,
  name: "Tienda Aurora",
  whatsappPhone: null,
  linkCode: code,
  isActive: true,
  shipments: [shipment],
};

describe("notification boundary schemas", () => {
  it("accepts an omitted or valid service date and rejects invalid dates and query keys", () => {
    expect(succeeds("notificationListQuery", {})).toBe(true);
    expect(succeeds("notificationListQuery", { date: "2026-10-22" })).toBe(true);
    expect(succeeds("notificationListQuery", { date: "2026-02-30" })).toBe(false);
    expect(succeeds("notificationListQuery", { date: "hoy" })).toBe(false);
    expect(succeeds("notificationListQuery", { date: null })).toBe(false);
    expect(succeeds("notificationListQuery", { date: "2026-10-22", limit: 5 })).toBe(false);
  });

  it("accepts the strict GET list shape with domain shipment status and nullable display fields", () => {
    expect(succeeds("notificationListSchema", { merchants: [merchant] })).toBe(true);
    expect(
      succeeds("notificationListSchema", {
        merchants: [{ ...merchant, shipments: [{ ...shipment, status: "voided" }] }],
      }),
    ).toBe(true);
    expect(
      succeeds("notificationListSchema", {
        merchants: [{ ...merchant, shipments: [{ ...shipment, status: null }] }],
      }),
    ).toBe(false);
    expect(
      succeeds("notificationListSchema", {
        merchants: [{ ...merchant, privateValue: "must not pass" }],
      }),
    ).toBe(false);
    expect(
      succeeds("notificationListSchema", {
        merchants: [{ ...merchant, shipments: [{ ...shipment, extra: true }] }],
      }),
    ).toBe(false);
  });

  it("requires an explicit merchant activity state in the strict GET list shape", () => {
    const { isActive: _isActive, ...merchantWithoutActiveFlag } = merchant;
    expect(succeeds("notificationListSchema", { merchants: [merchantWithoutActiveFlag] })).toBe(
      false,
    );
    expect(
      succeeds("notificationListSchema", {
        merchants: [{ ...merchant, isActive: false }],
      }),
    ).toBe(true);
  });

  it("accepts a UUID action and a nonempty batch of valid shipment UUIDs", () => {
    expect(succeeds("notificationMarkInput", { actionId, shipmentIds: [shipmentId] })).toBe(true);
    expect(
      succeeds("notificationMarkInput", {
        actionId,
        shipmentIds: [shipmentId, "d8f7bc20-eccd-4cce-9504-7c78bb7024d9"],
      }),
    ).toBe(true);
  });

  it("rejects empty, duplicate, malformed, null and unknown notification batch inputs", () => {
    expect(succeeds("notificationMarkInput", { actionId, shipmentIds: [] })).toBe(false);
    expect(
      succeeds("notificationMarkInput", { actionId, shipmentIds: [shipmentId, shipmentId] }),
    ).toBe(false);
    expect(
      succeeds("notificationMarkInput", {
        actionId,
        shipmentIds: [shipmentId, shipmentId.toUpperCase()],
      }),
    ).toBe(false);
    expect(succeeds("notificationMarkInput", { actionId, shipmentIds: ["not-a-uuid"] })).toBe(
      false,
    );
    expect(succeeds("notificationMarkInput", { actionId: null, shipmentIds: [shipmentId] })).toBe(
      false,
    );
    expect(succeeds("notificationMarkInput", { actionId, shipmentIds: null })).toBe(false);
    expect(succeeds("notificationMarkInput", null)).toBe(false);
    expect(
      succeeds("notificationMarkInput", { actionId, shipmentIds: [shipmentId], extra: true }),
    ).toBe(false);
  });

  it("reports actionable validation errors in Spanish", () => {
    expect(issueMessages("notificationListQuery", { date: "2026-02-30" })).toContain(
      "Escribe una fecha válida en formato AAAA-MM-DD.",
    );
    expect(issueMessages("notificationListQuery", { date: null })).toContain(
      "Escribe una fecha válida en formato AAAA-MM-DD.",
    );
    const emptyBatchMessages = issueMessages("notificationMarkInput", {
      actionId: "not-a-uuid",
      shipmentIds: [],
    });
    expect(emptyBatchMessages).toContain("Falta el identificador de la acción.");
    expect(emptyBatchMessages).toContain("Elige al menos un envío.");
    expect(
      issueMessages("notificationMarkInput", {
        actionId,
        shipmentIds: [shipmentId, shipmentId],
      }),
    ).toContain("No repitas el mismo envío.");
  });
});

describe("isFutureServiceDate (FR-015)", () => {
  it("allows today and earlier days and refuses later ones", () => {
    expect(domain.isFutureServiceDate("2026-10-01", "2026-10-01")).toBe(false);
    expect(domain.isFutureServiceDate("2026-09-30", "2026-10-01")).toBe(false);
    expect(domain.isFutureServiceDate("2026-10-02", "2026-10-01")).toBe(true);
    expect(domain.isFutureServiceDate("2027-01-01", "2026-12-31")).toBe(true);
  });
});
