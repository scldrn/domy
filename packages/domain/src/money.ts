/** Money is always an integer number of Colombian pesos (COP). */

/** Formats pesos as shown in the interface: 13000 → "$ 13.000". */
export function formatCop(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Not an integer amount of pesos: ${String(amount)}`);
  }
  const sign = amount < 0 ? "-" : "";
  const digits = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$ ${digits}`;
}

/**
 * Parses what a user types as pesos: "$ 13.000", "13000", or "13 000". Returns null for
 * anything that is not a whole, non-negative amount.
 */
export function parseCop(input: string): number | null {
  const compact = input.replace(/[\s$]/g, "");
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(compact)) {
    return null;
  }
  const amount = Number(compact.replaceAll(".", ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Amounts that require an explicit confirmation before saving (feature 001, FR-037). */
export const feeConfirmationThreshold = 100_000;
/** Also the threshold of a collected total or a disbursement (feature 003, FR-011). */
export const codConfirmationThreshold = 2_000_000;
