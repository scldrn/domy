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

for (const width of [1280, 600]) {
  test(`panel screens meet WCAG 2.2 AA at ${String(width)} px`, async ({ ownerPage: page }) => {
    await page.setViewportSize({ width, height: 900 });
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

test("the screens outside the panel meet WCAG 2.2 AA", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ["/ingresar", "/recuperar", "/restablecer?token=x"]) {
    await settle(page, path);
    expect(await accessibilityViolations(page), path).toEqual([]);
  }
  await context.close();
});
