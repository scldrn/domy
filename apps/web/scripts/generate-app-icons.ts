import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

/**
 * The brand assets (design-system.md §11) from one master drawing, the "route d": a route from
 * the hollow point (pickup) to the solid one (delivery).
 *
 *   pnpm icons
 */

const seed = "#34495E";
const out = new URL("../public/icons/", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const font = await readFile(
  require.resolve("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"),
);

/** The symbol on a 64-unit square, centered on its own bounds. */
function symbol(color: string): string {
  return `<g transform="translate(2 3)" fill="none" stroke="${color}">
    <path d="M42 16V38A14 14 0 1 1 28 24" stroke-width="5" stroke-linecap="round"/>
    <circle cx="42" cy="10" r="4.5" stroke-width="3"/>
    <circle cx="28" cy="24" r="4.5" fill="${color}" stroke="none"/>
  </g>`;
}

/** The symbol scaled to a share of the square, on an optional background. */
function drawing(color: string, share: number, background?: string, corner = 0): string {
  const offset = 32 * (1 - share);
  const fill = background
    ? `<rect width="64" height="64" rx="${String(corner)}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${fill}<g transform="translate(${String(offset)} ${String(offset)}) scale(${String(share)})">${symbol(color)}</g></svg>\n`;
}

await mkdir(out, { recursive: true });
await writeFile(`${out}logo.svg`, drawing(seed, 1));
await writeFile(`${out}favicon.svg`, drawing("#FFFFFF", 1, seed, 14));
await writeFile(`${out}icon-monochrome.svg`, drawing("#FFFFFF", 0.8));

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
    @font-face {
      font-family: Archivo;
      src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");
      font-weight: 100 900;
      font-stretch: 62% 125%;
    }
    html, body { margin: 0; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; gap: 36px; background: ${seed}; }
    svg { width: 240px; height: 240px; }
    span {
      font: 700 170px/1 Archivo;
      font-stretch: 125%;
      letter-spacing: -0.02em;
      color: #fff;
    }
  </style>
  ${drawing("#FFFFFF", 1)}<span>domy</span>`);
await preview.evaluate(() => document.fonts.ready);
await preview.screenshot({ path: `${out}link-preview.png` });
await browser.close();
console.log(`Icons written to ${out}`);
