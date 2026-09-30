import type { PaymentMode } from "./schemas/enums.ts";

/**
 * The COD amount a payment mode implies (FR-009): "Flete al destinatario" follows the fee,
 * "Crédito del cliente" is zero, and "Contraentrega" keeps the amount entered.
 */
export function resolveCodAmount(mode: PaymentMode, fee: number, entered: number): number {
  switch (mode) {
    case "recipient_pays_fee":
      return fee;
    case "merchant_account":
      return 0;
    case "cash_on_delivery":
      return entered;
  }
}

/** Why a COD amount is not valid for the payment mode, or null. */
export function codAmountError(mode: PaymentMode, amount: number | null): string | null {
  if (mode === "cash_on_delivery" && (amount === null || amount <= 0)) {
    return "En contraentrega el valor a recaudar debe ser mayor que cero.";
  }
  return null;
}
