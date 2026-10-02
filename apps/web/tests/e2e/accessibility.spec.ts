import type { Page } from "@playwright/test";
import { register } from "./api";
import { accessibilityViolations, expect, test } from "./fixtures";

/** Every panel screen, as the owner sees it (FR-034, design-system.md §2). */
const panelScreens = [
  "/",
  "/envios/nuevo",
  "/envios/masivo",
  "/historial",
  "/clientes",
  "/mensajeros",
  "/transportadoras",
  "/barrios",
  "/tarifario",
  "/usuarios",
  "/auditoria",
  "/cuenta",
];

async function settle(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Phone, the narrowest panel width, tablet, laptop, and desktop; light and dark schemes. */
const sizes: [width: number, scheme: "light" | "dark"][] = [
  [390, "light"],
  [600, "light"],
  [1024, "light"],
  [1280, "light"],
  [1440, "dark"],
  [390, "dark"],
];

for (const [width, scheme] of sizes) {
  test(`panel screens meet WCAG 2.2 AA at ${String(width)} px, ${scheme}`, async ({
    ownerPage: page,
  }) => {
    test.setTimeout(90_000); // twelve screens, each checked by axe
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    const problems: string[] = [];
    for (const path of panelScreens) {
      await settle(page, path);
      problems.push(
        ...(await accessibilityViolations(page)).map((violation) => `${path} ${violation}`),
      );
      // Usable at this width: the page itself never scrolls sideways (wide tables scroll inside).
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const extra = document.documentElement.scrollWidth - width;
        const wide = [...document.querySelectorAll("body *")].find(
          (element) =>
            element.getBoundingClientRect().right > width + 1 &&
            !element.closest("[data-slot=table-container]"),
        );
        return extra > 0 ? `${String(extra)} px (${wide?.outerHTML.slice(0, 120) ?? "?"})` : null;
      });
      if (overflow) problems.push(`${path} scrolls sideways by ${overflow}`);
    }
    expect(problems).toEqual([]);
  });
}

test("a shipment's detail and edit screens meet WCAG 2.2 AA", async ({ ownerPage: page }) => {
  const shipment = await register(page);
  for (const path of [
    `/envios/${shipment.trackingNumber}`,
    `/envios/${shipment.trackingNumber}/editar`,
  ]) {
    await settle(page, path);
    expect(await accessibilityViolations(page), path).toEqual([]);
  }
});

test("the screens outside the panel meet WCAG 2.2 AA, light and dark, phone and desktop", async ({
  browser,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ colorScheme, viewport: { width, height: 900 } });
      const page = await context.newPage();
      for (const path of ["/ingresar", "/recuperar", "/restablecer?token=x"]) {
        await settle(page, path);
        expect(
          await accessibilityViolations(page),
          `${path} ${colorScheme} ${String(width)}`,
        ).toEqual([]);
      }
      await context.close();
    }
  }
});

test("the courier's screen meets WCAG 2.2 AA", async ({ courierPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, "/mensajero");
  expect(await accessibilityViolations(page)).toEqual([]);
});
