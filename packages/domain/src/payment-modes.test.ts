import { describe, expect, it } from "vitest";
import { codAmountError, resolveCodAmount } from "./payment-modes.ts";

describe("resolveCodAmount", () => {
  it("keeps the amount entered for cash on delivery", () => {
    expect(resolveCodAmount("cash_on_delivery", 13000, 85000)).toBe(85000);
  });

  it("sets the COD amount to the fee when the recipient pays the fee, and follows a new fee", () => {
    expect(resolveCodAmount("recipient_pays_fee", 15000, 0)).toBe(15000);
    expect(resolveCodAmount("recipient_pays_fee", 17500, 15000)).toBe(17500);
  });

  it("sets the COD amount to zero on merchant account", () => {
    expect(resolveCodAmount("merchant_account", 13000, 50000)).toBe(0);
  });

  it("keeps the COD amount of the other two modes when the fee changes", () => {
    expect(resolveCodAmount("cash_on_delivery", 17500, 85000)).toBe(85000);
    expect(resolveCodAmount("merchant_account", 17500, 0)).toBe(0);
  });
});

describe("codAmountError", () => {
  it("requires an amount greater than zero for cash on delivery", () => {
    expect(codAmountError("cash_on_delivery", 0)).toBe(
      "En contraentrega el valor a recaudar debe ser mayor que cero.",
    );
    expect(codAmountError("cash_on_delivery", null)).not.toBeNull();
    expect(codAmountError("cash_on_delivery", 85000)).toBeNull();
  });

  it("accepts any amount for the modes that set it", () => {
    expect(codAmountError("recipient_pays_fee", null)).toBeNull();
    expect(codAmountError("merchant_account", 0)).toBeNull();
  });
});
