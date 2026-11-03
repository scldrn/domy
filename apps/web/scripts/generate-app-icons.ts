import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

/**
 * The brand assets (design-system.md §11) from one master drawing, the "route d": a route from
 * the hollow point (pickup) to the solid one (delivery). The wordmark carries the same stroke
 * through "omy" and ends in another solid point. The app draws both from `src/assets/brand/`.
 *
 *   pnpm icons
 */

const seed = "#34495E";
const out = new URL("../public/icons/", import.meta.url).pathname;
const brand = new URL("../src/assets/brand/", import.meta.url).pathname;

/** The letter d, in the coordinates shared by the symbol and the wordmark. */
function letterD(color: string): string {
  return `<path d="M42 16V38A14 14 0 1 1 28 24" stroke-width="5"/>
    <circle cx="42" cy="10" r="4.5" stroke-width="3"/>
    <circle cx="28" cy="24" r="4.5" fill="${color}" stroke="none"/>`;
}

/** The letters o, m, and y, continuing the d at the same weight. */
function lettersOmy(color: string): string {
  return `<circle cx="68" cy="38" r="14" stroke-width="5"/>
    <path d="M95 52V35A11 11 0 0 1 117 35V52M117 35A11 11 0 0 1 139 35V52" stroke-width="5"/>
    <path d="M152 24V38A14 14 0 0 0 180 38M180 24V58A12 12 0 0 1 168 70H162" stroke-width="5"/>
    <circle cx="158" cy="70" r="4.5" fill="${color}" stroke="none"/>`;
}

function stroked(color: string, letters: string): string {
  return `<g fill="none" stroke="${color}" stroke-linecap="round">
    ${letters}
  </g>`;
}

/** The symbol on a 64-unit square, centered on its own bounds. */
function symbol(color: string): string {
  return `<g transform="translate(2 3)">${stroked(color, letterD(color))}</g>`;
}

/** The symbol scaled to a share of the square, on an optional background. */
function drawing(color: string, share: number, background?: string, corner = 0): string {
  const offset = 32 * (1 - share);
  const fill = background
    ? `<rect width="64" height="64" rx="${String(corner)}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${fill}<g transform="translate(${String(offset)} ${String(offset)}) scale(${String(share)})">${symbol(color)}</g></svg>\n`;
}

/** The symbol alone, cropped to its bounds for use beside other content. */
function croppedSymbol(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="11.5 4 36.5 50.5">${stroked(color, letterD(color))}</svg>\n`;
}

/** The whole name, cropped to its bounds. */
function wordmark(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="11.5 4 171 70.5">${stroked(color, letterD(color) + lettersOmy(color))}</svg>\n`;
}

await mkdir(out, { recursive: true });
await mkdir(brand, { recursive: true });
await writeFile(`${out}logo.svg`, drawing(seed, 1));
await writeFile(`${out}wordmark.svg`, wordmark(seed));
await writeFile(`${out}favicon.svg`, drawing("#FFFFFF", 1, seed, 14));
await writeFile(`${out}icon-monochrome.svg`, drawing("#FFFFFF", 0.8));
await writeFile(`${brand}symbol.svg`, croppedSymbol("currentColor"));
await writeFile(`${brand}wordmark.svg`, wordmark("currentColor"));

/** Each image: its file, its size in pixels, and how much of the square the symbol takes. */
const icons = [
  { file: "icon-512.png", size: 512, share: 1 },
  { file: "icon-192.png", size: 192, share: 1 },
  // The whole symbol stays inside the central circle of 409 px that adaptive shapes keep.
  { file: "icon-maskable-512.png", size: 512, share: 0.8 },
  { file: "apple-touch-icon.png", size: 180, share: 1 },
  { file: "favicon-32.png", size: 32, share: 1.15 },
  { file: "favicon-16.png", size: 16, share: 1.15 },
];

const browser = await chromium.launch();
for (const icon of icons) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
  await page.setContent(`<!doctype html>
    <style>html, body { margin: 0; height: 100%; background: ${seed}; } svg { display: block; }</style>
    ${drawing("#FFFFFF", icon.share, seed)}`);
  await page.screenshot({ path: `${out}${icon.file}` });
  await page.close();
}

// The link preview shows only the product name (feature 004, FR-012).
const preview = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await preview.setContent(`<!doctype html>
  <style>
    html, body { margin: 0; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; background: ${seed}; }
    svg { width: 760px; }
  </style>
  ${wordmark("#FFFFFF")}`);
await preview.screenshot({ path: `${out}link-preview.png` });
await browser.close();
console.log(`Icons written to ${out} and ${brand}`);
