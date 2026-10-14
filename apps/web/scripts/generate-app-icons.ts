import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

/**
 * The provisional app icons (feature 003, research R2; design-system.md §11): the wordmark
 * as the panel draws it, Archivo bold at 125 % width, white on the seed color. The small
 * sizes carry only the "d", as the collapsed rail does. Replaced when the logo artwork exists.
 *
 *   pnpm icons
 */

const seed = "#34495E";
const out = new URL("../public/icons/", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const font = await readFile(
  require.resolve("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"),
);

/** Each icon: its file, its size in pixels, the text, and how much of the width it fills. */
const icons = [
  { file: "icon-512.png", size: 512, text: "domy", width: 0.74 },
  { file: "icon-192.png", size: 192, text: "domy", width: 0.74 },
  // Maskable icons keep their content inside the central 80 % circle.
  { file: "icon-maskable-512.png", size: 512, text: "domy", width: 0.58 },
  { file: "apple-touch-icon.png", size: 180, text: "domy", width: 0.7 },
  { file: "favicon-32.png", size: 32, text: "d", width: 0.5 },
  { file: "favicon-16.png", size: 16, text: "d", width: 0.56 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const icon of icons) {
  const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
  await page.setContent(`<!doctype html>
    <style>
      @font-face {
        font-family: Archivo;
        src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");
        font-weight: 100 900;
        font-stretch: 62% 125%;
      }
      html, body { margin: 0; height: 100%; }
      body { display: grid; place-items: center; background: ${seed}; }
      span {
        font: 700 100px/1 Archivo;
        font-stretch: 125%;
        letter-spacing: -0.02em;
        color: #fff;
      }
    </style>
    <span>${icon.text}</span>`);
  await page.evaluate(() => document.fonts.ready);
  // Fit the word to its share of the width, then center it on its letters' own height.
  await page.evaluate(
    ({ size, width }) => {
      const span = document.querySelector("span");
      if (!span) return;
      span.style.fontSize = `${String((100 * size * width) / span.getBoundingClientRect().width)}px`;
    },
    { size: icon.size, width: icon.width },
  );
  await page.screenshot({ path: `${out}${icon.file}`, omitBackground: false });
  await page.close();
}
await browser.close();
console.log(`Icons written to ${out}`);
