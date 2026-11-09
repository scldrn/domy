/**
 * Money is always an integer number of Colombian pesos (COP).
 *
 * Single monetary amounts are stored in PostgreSQL integer columns (signed 32-bit int4),
 * bounded between 0 and 2,147,483,647 COP (~2.14 billion COP).
 *
 * Aggregates (route summaries, day summaries, balances) are computed using PostgreSQL bigint
 * (signed 64-bit int8) and represented in JavaScript as safe integers up to Number.MAX_SAFE_INTEGER
 * (9,007,199,254,740,991 COP, ~9 quadrillion COP).
 */

/** Minimum representable non-negative COP amount. */
export const minCop = 0;

/**
 * Maximum representable COP amount for individual monetary columns in PostgreSQL (int4 signed 32-bit: 2^31 - 1).
 * Amounts up to $ 2.147.483.647 fit in standard integer storage without overflow.
 */
export const maxCop = 2_147_483_647;

/**
 * Maximum representable safe integer COP amount in JavaScript (Number.MAX_SAFE_INTEGER: 2^53 - 1 = 9,007,199,254,740,991).
 * Used for financial aggregates (routes board, courier day summary, etc.) calculated via PostgreSQL bigint.
 */
export const maxAggregateCop = Number.MAX_SAFE_INTEGER;

/** Checked addition of COP amounts ensuring no overflow beyond Number.MAX_SAFE_INTEGER. */
export function addCop(...amounts: number[]): number {
  let sum = 0;
  for (const amount of amounts) {
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError(`Not a safe integer amount of pesos: ${String(amount)}`);
    }
    sum += amount;
    if (!Number.isSafeInteger(sum) || sum > maxAggregateCop) {
      throw new RangeError(`COP sum overflowed safe integer bounds: ${String(sum)}`);
    }
  }
  return sum;
}

/**
 * Validates and converts an unknown value (such as a database bigint string or number)
 * into a safe JavaScript integer COP amount. Throws RangeError if the value is not representable
 * as a safe non-negative integer within bounds.
 */
export function safeIntegerCop(value: unknown, max: number = maxAggregateCop): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Not a safe integer amount of pesos: ${String(value)}`);
  }
  if (amount < minCop || amount > max) {
    throw new RangeError(
      `COP amount out of representable bounds [${String(minCop)}, ${String(max)}]: ${String(amount)}`,
    );
  }
  return amount;
}

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
 * anything that is not a whole, non-negative amount within representable bounds.
 */
export function parseCop(input: string, max: number = maxCop): number | null {
  const compact = input.replace(/[\s$]/g, "");
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(compact)) {
    return null;
  }
  const amount = Number(compact.replaceAll(".", ""));
  return Number.isSafeInteger(amount) && amount >= minCop && amount <= max ? amount : null;
}

/** Amounts that require an explicit confirmation before saving (feature 001, FR-037). */
export const feeConfirmationThreshold = 100_000;
/** Also the threshold of a collected total or a disbursement (feature 003, FR-011). */
export const codConfirmationThreshold = 2_000_000;

/**
 * Whether amounts need an explicit confirmation before saving: a fee above
 * `feeConfirmationThreshold` (feature 001, FR-037), or a COD amount, collected total, or
 * disbursement above `codConfirmationThreshold` (feature 003, FR-011). On an edit, given the
 * stored amounts as `previous`, only an amount that changed asks again (DESIGN-3).
 */
export function needsAmountConfirmation(
  amounts: { fee?: number | undefined; codAmount?: number | null | undefined },
  previous?: { fee: number; codAmount: number | null },
): boolean {
  const { fee, codAmount } = amounts;
  const largeFee =
    fee !== undefined && fee > feeConfirmationThreshold && (!previous || fee !== previous.fee);
  const largeCod =
    codAmount !== undefined &&
    codAmount !== null &&
    codAmount > codConfirmationThreshold &&
    (!previous || codAmount !== previous.codAmount);
  return largeFee || largeCod;
}
