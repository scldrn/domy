import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** WCAG 2.2 AA (Constitution VII): 4.5:1 for text, 3:1 for component boundaries and focus. */
const text = 4.5;
const ui = 3;

const css = readFileSync(new URL("tokens.css", import.meta.url), "utf8");

function scheme(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--md-sys-color-([a-z-]+): (#[0-9a-f]{6});/g)].map(([, name, hex]) => [
      name,
      hex,
    ]),
  ) as Record<string, string>;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** [foreground, background, minimum ratio, what it is]. */
const pairs: [string, string, number, string][] = [
  ["on-surface", "paper", text, "text on the page"],
  ["on-surface", "sheet", text, "text on a sheet"],
  ["on-surface-variant", "paper", text, "secondary text on the page"],
  ["on-surface-variant", "sheet", text, "secondary text on a sheet"],
  ["on-surface-variant", "sheet-alt", text, "table headers"],
  ["primary", "sheet", text, "links"],
  ["on-primary", "primary", text, "filled buttons"],
  ["on-secondary-container", "secondary-container", text, "selected chips and segments"],
  ["on-primary-container", "primary-container", text, "primary containers"],
  ["error", "sheet", text, "late flags and novelty marks"],
  ["warning", "sheet", text, "at-risk flags"],
  ["success", "sheet", text, "delivered marks"],
  ["info", "sheet", text, "on-the-way marks"],
  ["tertiary", "sheet", text, "assigned marks"],
  ["on-accent", "accent", text, "text on the one primary action (feature 006, FR-002a)"],
  ["on-error", "error", text, "late bars on the ribbon"],
  ["on-error-container", "error-container", text, "error notices"],
  ["on-warning-container", "warning-container", text, "at-risk bars"],
  ["on-info-container", "info-container", text, "on-the-way bars"],
  ["on-success-container", "success-container", text, "delivered bars"],
  ["on-rail", "rail", text, "the product name on the rail"],
  ["on-rail-variant", "rail", text, "destinations and sentences on pizarra"],
  ["on-rail", "rail-raised", text, "hover on pizarra"],
  ["rail-success", "rail", text, "delivered on pizarra"],
  ["rail-warning", "rail", text, "at risk on pizarra"],
  ["rail-error", "rail", text, "late and exceptions on pizarra"],
  ["rail-info", "rail", text, "on the way on pizarra"],
  ["rail-tertiary", "rail", text, "assigned and handovers on pizarra"],
  ["outline", "sheet", ui, "field borders on a sheet"],
  ["outline", "paper", ui, "field borders on the page"],
  ["accent-strong", "paper", ui, "the focus ring on the page"],
  ["accent-strong", "sheet", ui, "the focus ring on a sheet"],
  ["accent", "rail", ui, "the focus ring, current page, and next stop on pizarra"],
  ["accent", "rail-raised", ui, "lime marks on hovered pizarra"],
];

describe.each([
  ["light", ":root {"],
  ["dark", '[data-scheme="dark"] {'],
  ["high contrast", '[data-scheme="high-contrast"] {'],
])("the %s scheme", (_name, selector) => {
  const colors = scheme(selector);

  it.each(pairs)("%s on %s reaches %s:1 (%s)", (foreground, background, minimum) => {
    const front = colors[foreground];
    const back = colors[background];
    expect(front, `--md-sys-color-${foreground}`).toBeDefined();
    expect(back, `--md-sys-color-${background}`).toBeDefined();
    expect(contrast(front ?? "", back ?? "")).toBeGreaterThanOrEqual(minimum);
  });
});
