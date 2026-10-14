import type { CourierTask } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { needsAmountConfirmation, proposedReceivedBy } from "./delivery-rules";

const task = (extra: Partial<CourierTask>) =>
  ({
    shipmentKind: "delivery",
    recipientName: "Laura Gómez",
    merchant: { id: "m", name: "Bullish Hype" },
    carrier: null,
    ...extra,
  }) as CourierTask;

/** Recording a delivery (feature 003, FR-008, FR-011). */
describe("proposedReceivedBy", () => {
  it("proposes the recipient, the carrier, or the merchant by shipment kind", () => {
    expect(proposedReceivedBy(task({}))).toBe("Laura Gómez");
    expect(
      proposedReceivedBy(
        task({
          shipmentKind: "carrier_handoff",
          recipientName: null,
          carrier: { id: "c", name: "Coonorte" },
        }),
      ),
    ).toBe("Coonorte");
    expect(proposedReceivedBy(task({ shipmentKind: "reverse_pickup" }))).toBe("Bullish Hype");
    expect(proposedReceivedBy(task({ shipmentKind: "errand", recipientName: null }))).toBe("");
  });
});

describe("needsAmountConfirmation", () => {
  it("asks to confirm an amount above COP 2.000.000", () => {
    expect(needsAmountConfirmation(2_000_000)).toBe(false);
    expect(needsAmountConfirmation(2_000_001)).toBe(true);
  });
});
