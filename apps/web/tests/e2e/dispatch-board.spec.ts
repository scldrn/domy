import { formatTrackingNumber, type Shipment } from "@domy/domain";
import { register } from "./api";
import { boardRow, showEveryShipment } from "./board";
import type { Locator, Page } from "@playwright/test";
import { accessibilityViolations, expect, test } from "./fixtures";

const startOfSuite = "2026-10-01T15:00:00Z"; // 10:00 in Bogotá, as global-setup sets it

const row = (scope: Page | Locator, shipment: Shipment) =>
  scope.getByRole("row").filter({ hasText: formatTrackingNumber(shipment.trackingNumber) });

test.afterEach(async ({ setServerNow }) => {
  await setServerNow(startOfSuite);
});

test("flags a shipment at risk, then late, without reloading (scenario 5)", async ({
  dispatcherPage: page,
  setServerNow,
}) => {
  const shipment = await register(page, { window: { preset: "afternoon" } });
  await setServerNow("2026-10-02T00:16:00Z"); // 19:16 in Bogotá
  await page.clock.install();
  await page.goto("/");
  await showEveryShipment(page);
  await expect(row(page, shipment)).toContainText("En riesgo · quedan 44 min");
  await expect(row(page, shipment)).toContainText("Laura Gómez");
  await expect(row(page, shipment)).toContainText("Laureles");
  await expect(row(page, shipment)).toContainText("$ 85.000");

  await setServerNow("2026-10-02T01:01:00Z"); // 20:01
  await page.clock.runFor(31_000);
  await expect(row(page, shipment)).toContainText("Atrasado · 1 min");
});

test("lists yesterday's undelivered shipment as pending from its day (scenario 6)", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page, { serviceDate: "2026-09-30" });
  await page.goto("/");
  await showEveryShipment(page);
  const list = page.getByRole("region", { name: /^Envíos \d+$/ });
  await expect(row(list, shipment)).toContainText("30 sep 2026, pendiente");
});

test("shows a shipment registered elsewhere within 30 seconds (scenario 7)", async ({
  dispatcherPage,
  ownerPage,
}) => {
  await ownerPage.clock.install();
  await ownerPage.goto("/");
  await expect(ownerPage.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
  await showEveryShipment(ownerPage);
  const shipment = await register(dispatcherPage);
  await ownerPage.clock.runFor(21_000);
  await showEveryShipment(ownerPage);
  await expect(row(ownerPage, shipment)).toBeVisible();
});

test("filters by stage with the stage counts and the tabs, and keeps it in the address", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page);
  await page.goto("/");
  const stages = page.getByRole("group", { name: "Filtrar los envíos por etapa" });
  await stages.getByRole("button", { name: /^Por salir/ }).click();
  await expect(page).toHaveURL(/stage=open/);
  await expect(stages.getByRole("button", { name: /^Por salir/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#envios")).toBeInViewport();
  await showEveryShipment(page);
  await expect(row(page, shipment)).toBeVisible();

  const tabs = page.getByRole("group", { name: "Envíos por etapa", exact: true });
  await tabs.getByRole("button", { name: /^Entregados/ }).click();
  await expect(page).toHaveURL(/stage=delivered/);
  await expect(row(page, shipment)).toHaveCount(0);
  await tabs.getByRole("button", { name: /^Todos/ }).click();
  await expect(page).not.toHaveURL(/stage=/);
});

test("opens a shipment in the side panel and returns the focus to its row", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page);
  await page.goto("/");
  await showEveryShipment(page);
  const opener = boardRow(page, shipment).getByRole("button", {
    name: formatTrackingNumber(shipment.trackingNumber),
    exact: true,
  });
  await opener.click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: formatTrackingNumber(shipment.trackingNumber) }),
  ).toBeVisible();
  await expect(panel).toContainText("Bullish Hype");
  await expect(panel).toContainText("Laura Gómez");
  await expect(panel.getByRole("link", { name: "Abrir la página del envío" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("shows the day, the stages, what to resolve, and the couriers without scrolling (SC-002)", async ({
  dispatcherPage: page,
}) => {
  // A day of its own with 40 shipments, so the other specs' shipments do not change the bound.
  const day = "2026-12-07";
  for (let index = 0; index < 40; index++) await register(page, { serviceDate: day });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?date=${day}`);
  await expect(page.getByText(/^Este día tiene 40 envíos/)).toBeInViewport();
  await expect(page.getByRole("group", { name: "Filtrar los envíos por etapa" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: /^Por resolver/ })).toBeInViewport();
  await expect(page.getByRole("heading", { name: /^Mensajeros/ })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Ver los 40 envíos" })).toBeVisible();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThanOrEqual(2 * 900);
});
