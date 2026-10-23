import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as domain from "./index.ts";

const baseUrl = "https://domy.example";
type TestMerchant = {
  name: string;
  linkCode: string;
};

const merchant: TestMerchant = {
  name: "Tienda Aurora",
  linkCode: "BBBBBBBBBBBBBBBBBBBB01",
};

const composerFunction = z.function({
  input: [z.unknown(), z.array(z.unknown()), z.string(), z.boolean().optional()],
  output: z.string(),
});
const eligibilityFunction = z.function({
  input: [z.array(z.unknown()), z.boolean().optional()],
  output: z.array(z.unknown()),
});

function shipment(index: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    trackingNumber: `8100${String(index).padStart(4, "0")}`,
    trackingCode: `${"A".repeat(20)}${index.toString(16).padStart(2, "0")}`,
    recipientName: `Destinatario ${String(index)}`,
    neighborhood: `Barrio ${String(index)}`,
    status: "registered",
    notifiedAt: null,
    ...overrides,
  };
}

function compose(
  shipments: Record<string, unknown>[],
  includeNotified = false,
  messageMerchant: TestMerchant = merchant,
  publicBaseUrl = baseUrl,
): string {
  const exports: unknown = domain;
  if (typeof exports !== "object" || exports === null || !("composeMerchantMessage" in exports)) {
    throw new Error("T020 must export composeMerchantMessage before the T017 assertions can run.");
  }
  return composerFunction.parse(exports["composeMerchantMessage"])(
    messageMerchant,
    shipments,
    publicBaseUrl,
    includeNotified,
  );
}

function eligible(
  shipments: readonly Record<string, unknown>[],
  includeNotified = false,
): Record<string, unknown>[] {
  const exports: unknown = domain;
  if (
    typeof exports !== "object" ||
    exports === null ||
    !("eligibleNotificationShipments" in exports)
  ) {
    throw new Error("T022 must export the shared notification eligibility rule.");
  }
  const result = eligibilityFunction.parse(Reflect.get(exports, "eligibleNotificationShipments"))(
    [...shipments],
    includeNotified,
  );
  return result.map((row) => {
    const parsed = z.record(z.string(), z.unknown()).safeParse(row);
    if (!parsed.success)
      throw new Error("The notification eligibility rule returned an invalid row.");
    return parsed.data;
  });
}

function merchantUrl(messageMerchant: TestMerchant = merchant, publicBaseUrl = baseUrl): string {
  return `${publicBaseUrl}/cliente/${messageMerchant.linkCode}`;
}

describe("composeMerchantMessage", () => {
  it("exports one eligibility rule that preserves rows and order for counts and IDs", () => {
    const fresh = shipment(1);
    const notified = shipment(2, { notifiedAt: "2026-10-22T12:00:00.000Z" });
    const voided = shipment(3, { status: "voided" });

    const defaultEligible = eligible([fresh, notified, voided]);
    const allDateEligible = eligible([fresh, notified, voided], true);
    expect(defaultEligible).toEqual([fresh]);
    expect(allDateEligible).toEqual([fresh, notified]);
    expect(defaultEligible.map((row) => row["id"])).toEqual([fresh["id"]]);
    expect(allDateEligible.map((row) => row["id"])).toEqual([fresh["id"], notified["id"]]);
    expect(eligible([fresh, notified, voided])[0]).toEqual(fresh);
  });

  it("greets the merchant, lists each shipment with its tracking link, and ends with the merchant link", () => {
    const first = shipment(1);
    const second = shipment(2, {
      trackingNumber: "12345678",
      trackingCode: `${"C".repeat(20)}02`,
      recipientName: "María Pérez",
      neighborhood: "Laureles",
    });

    const message = compose([first, second]);
    const firstTrackingUrl = `${baseUrl}/seguimiento/${String(first.trackingCode)}`;
    const secondTrackingUrl = `${baseUrl}/seguimiento/${String(second.trackingCode)}`;

    expect(message).toMatch(/^(?:¡)?Hola\b.*Tienda Aurora/m);
    expect(message).toContain("Destinatario 1");
    expect(message).toContain("Barrio 1");
    expect(message).toContain("8100-0001");
    expect(message).toContain(firstTrackingUrl);
    expect(message).toContain("María Pérez");
    expect(message).toContain("Laureles");
    expect(message).toContain("1234-5678");
    expect(message).toContain(secondTrackingUrl);
    expect(message.trimEnd().endsWith(merchantUrl())).toBe(true);

    const orderedParts = [
      "Hola",
      "Tienda Aurora",
      "Destinatario 1",
      "Barrio 1",
      "8100-0001",
      firstTrackingUrl,
      "María Pérez",
      "Laureles",
      "1234-5678",
      secondTrackingUrl,
      merchantUrl(),
    ];
    const positions = orderedParts.map((part) => message.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("excludes notified and voided shipments by default, and still excludes voided when including notified", () => {
    const fresh = shipment(3);
    const notified = shipment(4, {
      notifiedAt: "2026-10-22T12:00:00.000Z",
    });
    const voided = shipment(5, { status: "voided" });

    const defaultMessage = compose([fresh, notified, voided]);
    expect(defaultMessage).toContain("Destinatario 3");
    expect(defaultMessage).not.toContain("Destinatario 4");
    expect(defaultMessage).not.toContain("Destinatario 5");

    const allDateMessage = compose([fresh, notified, voided], true);
    expect(allDateMessage).toContain("Destinatario 3");
    expect(allDateMessage).toContain("Destinatario 4");
    expect(allDateMessage).not.toContain("Destinatario 5");
  });

  it("keeps 20 detailed entries when filtering leaves 20, then compacts 21 included entries to a count and merchant link", () => {
    const shipments = Array.from({ length: 20 }, (_, index) => shipment(index + 10));
    shipments.push(
      shipment(30, { status: "voided" }),
      shipment(31, { notifiedAt: "2026-10-22T12:00:00.000Z" }),
    );

    const defaultMessage = compose(shipments);
    expect(defaultMessage).toContain("Destinatario 10");
    expect(defaultMessage).toContain("Destinatario 29");
    expect(defaultMessage).not.toContain("Destinatario 30");
    expect(defaultMessage).not.toContain("Destinatario 31");
    expect(defaultMessage.match(/https:\/\/domy\.example\/seguimiento\//g)).toHaveLength(20);
    expect(defaultMessage.trimEnd().endsWith(merchantUrl())).toBe(true);

    const allDateMessage = compose(shipments, true);
    expect(allDateMessage).toMatch(/\b21\b/);
    expect(allDateMessage).not.toContain("Destinatario 10");
    expect(allDateMessage).not.toContain("Destinatario 29");
    expect(allDateMessage).not.toContain("Destinatario 31");
    expect(allDateMessage).not.toContain("https://domy.example/seguimiento/");
    expect(allDateMessage).not.toMatch(/\bhoy\b/iu);
    expect(allDateMessage.trimEnd().endsWith(merchantUrl())).toBe(true);
  });

  it("uses plain Spanish fallbacks when recipient or neighborhood is absent and leaves an empty eligible set without rows", () => {
    const missingDetails = shipment(40, { recipientName: null, neighborhood: null });
    const detailMessage = compose([missingDetails]);
    expect(detailMessage).toContain("Destinatario no especificado");
    expect(detailMessage).toContain("Barrio no especificado");
    expect(detailMessage).not.toMatch(/\b(?:null|undefined)\b/u);

    const emptyMessage = compose([
      shipment(41, { status: "voided" }),
      shipment(42, { notifiedAt: "2026-10-22T12:00:00.000Z" }),
    ]);
    expect(emptyMessage).not.toContain("Destinatario 41");
    expect(emptyMessage).not.toContain("Destinatario 42");
    expect(emptyMessage).not.toContain("/seguimiento/");
    expect(emptyMessage.trimEnd().endsWith(merchantUrl())).toBe(true);
  });

  it("keeps special characters as message text and rejects a non-origin public base URL", () => {
    const specialMerchant = { name: "Café & Panadería", linkCode: merchant.linkCode };
    const specialShipment = shipment(43, {
      recipientName: "José & Lucía",
      neighborhood: "Laureles / Estadio",
    });
    const message = compose([specialShipment], false, specialMerchant);
    expect(message).toContain("Café & Panadería");
    expect(message).toContain("José & Lucía");
    expect(message).toContain("Laureles / Estadio");
    expect(message.trimEnd().endsWith(merchantUrl(specialMerchant))).toBe(true);

    expect(() =>
      compose([specialShipment], false, merchant, "https://domy.example/path?next=x"),
    ).toThrow();
  });
});
