/**
 * Normalizes text for matching and uniqueness: lowercase, without accents or punctuation,
 * with single spaces. The database applies the same rule to normalized columns.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
