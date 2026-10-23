import { courierTask, type CourierTask } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { collectionNoteLabel, needsAmountConfirmation, proposedReceivedBy } from "./delivery-rules";

const task = (extra: Partial<CourierTask> = {}): CourierTask =>
  courierTask.parse({
    id: "00000000-0000-4000-8000-000000000001",
    shipmentId: "00000000-0000-4000-8000-000000000002",
    kind: "delivery",
    status: "pending",
    trackingNumber: "7SMQ5M5T",
    shipmentKind: "delivery",
    recipientName: "Laura Gómez",
    recipientPhone: "3001234567",
    merchant: { id: "00000000-0000-4000-8000-000000000003", name: "Bullish Hype" },
    carrier: null,
    shipmentStatus: "picked_up",
    destinationTown: null,
    errandDescription: null,
    instructions: null,
    packageCount: null,
    packageSize: null,
    windowStart: null,
    windowEnd: null,
    codAmount: 0,
    blockedByHandover: null,
    problemNote: null,
    ...extra,
  });

/** Recording a delivery (feature 003, FR-008, FR-011). */
describe("proposedReceivedBy", () => {
  it("proposes the recipient, the carrier, or the merchant by shipment kind", () => {
    expect(proposedReceivedBy(task({}))).toBe("Laura Gómez");
    expect(
      proposedReceivedBy(
        task({
          shipmentKind: "carrier_handoff",
          recipientName: null,
          carrier: { id: "00000000-0000-4000-8000-000000000004", name: "Coonorte" },
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

describe("collectionNoteLabel (FR-010, FR-011)", () => {
  it("uses the shared collection rule to label a mismatch as requiring a note", () => {
    expect(
      collectionNoteLabel(85_000, {
        cashAmount: 80_000,
        companyTransferAmount: 0,
        merchantTransferAmount: 0,
      }),
    ).toBe("Nota sobre el recaudo");
    expect(
      collectionNoteLabel(85_000, {
        cashAmount: 80_000,
        companyTransferAmount: 5_000,
        merchantTransferAmount: 0,
      }),
    ).toBe("Nota (opcional)");
  });
});
