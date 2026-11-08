import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Colors come only from the generated tokens (feature 006, research R8, SC-005): no `#hex`,
 * `rgb(`, `hsl(`, or `oklch(` anywhere in `apps/web/src` outside `styles/tokens.css`.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const allowed = new Set(["styles/tokens.css", "styles/color-literals.test.ts"]);
const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/u;

/**
 * Files that still held literals when the guard was written, cleaned slice by slice (T002,
 * T046). Empty since the daily-operation screens were rebuilt; keep it empty.
 */
const offenders: string[] = [];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:tsx?|css)$/u.test(entry.name) ? [relative(root, path)] : [];
  });
}

describe("color literals", () => {
  it("appear only in the generated tokens", () => {
    const found = sourceFiles(root)
      .filter((file) => !allowed.has(file))
      .filter((file) => literal.test(readFileSync(join(root, file), "utf8")))
      .sort();
    expect(found).toEqual(offenders);
  });

  it("are caught in every form the guard names", () => {
    for (const sample of [
      "#C8F23C",
      "#fff",
      "rgb(0 0 0)",
      "rgba(0,0,0,.5)",
      "hsl(0 0% 0%)",
      "oklch(0.9 0.2 120)",
    ]) {
      expect(literal.test(sample)).toBe(true);
    }
    expect(literal.test("text-on-surface bg-sheet")).toBe(false);
  });
});
