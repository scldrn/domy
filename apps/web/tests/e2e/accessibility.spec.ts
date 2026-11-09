import { formatTrackingNumber } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { accessibilityViolations, expect, sidewaysScroll, test } from "./fixtures";

/** Every panel screen, as the owner sees it (FR-034, design-system.md §2). */
const panelScreens = [
  "/",
  "/envios/nuevo",
  "/envios/masivo",
  "/historial",
  "/rutas",
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
    test.setTimeout(90_000); // thirteen screens, each checked by axe
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    const problems: string[] = [];
    for (const path of panelScreens) {
      await settle(page, path);
      problems.push(
        ...(await accessibilityViolations(page)).map((violation) => `${path} ${violation}`),
      );
      const overflow = await sidewaysScroll(page);
      if (overflow) problems.push(`${path} scrolls sideways by ${overflow}`);
    }
    expect(problems).toEqual([]);
  });
}

/** A route through the API (feature 002, US1), dispatched when a courier is given. */
async function routeOf(page: Page, shipmentIds: string[], courierId?: string) {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: { id, actionId: id, serviceDate: "2026-10-01", shipmentIds, courierId },
  });
  expect(created.status()).toBe(201);
  if (courierId) {
    const { version } = (await created.json()) as { version: number };
    const dispatched = await page.request.post(`/api/routes/${id}/dispatch`, {
      data: { actionId: crypto.randomUUID(), version },
    });
    expect(dispatched.status()).toBe(200);
  }
  return id;
}

test("the route screens and their dialogs meet WCAG 2.2 AA at every size, light and dark (FR-024)", async ({
  dispatcherPage: page,
}) => {
  test.setTimeout(180_000);
  const courier = async (name: string) => {
    const id = crypto.randomUUID();
    await page.request.post("/api/couriers", {
      data: { id, name, phone: "3004445566", aliases: [] },
    });
    return id;
  };
  const run = String(Date.now()).slice(-6);
  const shipments = [await register(page), await register(page), await register(page)];
  const draft = await routeOf(page, [shipments[0]?.id ?? "", shipments[1]?.id ?? ""]);
  const running = await routeOf(page, [shipments[2]?.id ?? ""], await courier(`Elsa ${run}`));
  await courier(`Fredy ${run}`);
  await register(page);

  const dialogs: [path: string, button: string][] = [
    [`/rutas/${draft}`, "Agregar envíos"],
    [`/rutas/${draft}`, "Cancelar ruta"],
    [`/rutas/${running}`, "Deshacer despacho"],
    [`/rutas/${running}`, "Reasignar ruta"],
    [`/rutas/${running}`, `Reasignar ${formatTrackingNumber(shipments[2]?.trackingNumber ?? "")}`],
  ];
  const problems: string[] = [];
  for (const [width, scheme] of sizes) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    const at = `${String(width)} px ${scheme}`;
    for (const path of [`/rutas/${draft}`, `/rutas/${running}`]) {
      await settle(page, path);
      problems.push(...(await accessibilityViolations(page)).map((v) => `${path} ${at} ${v}`));
      const overflow = await sidewaysScroll(page);
      if (overflow) problems.push(`${path} ${at} scrolls sideways by ${overflow}`);
    }
    // Each dialog once per scheme, on a phone and on a desktop.
    if (width !== 390 && width !== 1440) continue;
    for (const [path, button] of dialogs) {
      await settle(page, path);
      await page.getByRole("button", { name: button, exact: true }).click();
      const dialog = page.getByRole("dialog").or(page.getByRole("alertdialog"));
      await expect(dialog).toBeVisible();
      problems.push(
        ...(await accessibilityViolations(page)).map((v) => `${path} «${button}» ${at} ${v}`),
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  }
  expect(problems).toEqual([]);
});

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
