import { describe, expect, it } from "vitest";
import { bulkDraftSchema } from "./bulk-form-draft";

const merchantA = "a75b7a0a-1e5f-4b20-a76a-453d50d402b4";
const merchantB = "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a";

function draft(
  visibleMerchantId: string,
  inputMerchantId: string,
  rowMerchantId = inputMerchantId,
) {
  return {
    form: {
      merchant: { id: visibleMerchantId, name: "Cliente visible", aliases: [] },
      pickupPointId: null,
      text: "Borrador visible",
    },
    pending: {
      input: {
        batchId: "d839615c-4e9a-4238-9b81-7d2fdb2324cb",
        merchantId: inputMerchantId,
        rows: [
          {
            id: "19edb80f-7c7b-4ec7-900e-6797f54a93bb",
            merchantId: rowMerchantId,
            pickupPointId: "f17d7974-0427-4c96-8b36-b0a948232c3c",
            kind: "errand",
            errandDescription: "Recoger un documento",
            serviceDate: "2026-10-20",
            serviceLevel: "standard",
            fee: 85000,
            paymentMode: "merchant_account",
            confirmed: true,
          },
        ],
      },
      remainingText: "",
    },
    needsIntentAcknowledgement: false,
  };
}

describe("bulk form draft snapshot", () => {
  it("accepts a pending confirmation for the visible merchant and its rows", () => {
    const value = draft(merchantA, merchantA);

    expect(bulkDraftSchema.safeParse(value).success).toBe(true);
  });

  it("rejects a pending confirmation for a different merchant than the visible form", () => {
    const value = draft(merchantA, merchantB);

    expect(bulkDraftSchema.safeParse(value).success).toBe(false);
  });

  it("rejects a row whose merchant differs from the pending batch merchant", () => {
    const value = draft(merchantA, merchantA, merchantB);

    expect(bulkDraftSchema.safeParse(value).success).toBe(false);
  });
});
