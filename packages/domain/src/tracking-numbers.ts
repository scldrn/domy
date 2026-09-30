/**
 * Tracking numbers (FR-011, research R6): 8 random characters of Crockford's Base32, shown as
 * two groups of four. They are a human reference, never a secret.
 */
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const length = 8;

export function generateTrackingNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function formatTrackingNumber(trackingNumber: string): string {
  return `${trackingNumber.slice(0, 4)}-${trackingNumber.slice(4)}`;
}

/** Reads what a person typed: case-insensitive, hyphen optional, O→0, I/L→1. */
export function normalizeTrackingNumber(input: string): string | null {
  const normalized = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replaceAll("O", "0")
    .replace(/[IL]/g, "1");
  return new RegExp(`^[${alphabet}]{${String(length)}}$`).test(normalized) ? normalized : null;
}
