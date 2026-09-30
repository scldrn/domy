import { formatTrackingNumber, type Shipment } from "@domy/domain";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const startOfSuite = "2026-10-01T15:00:00Z"; // 10:00 in Bogotá, as global-setup sets it

/** Registers a Bullish Hype delivery to Laureles through the API, as the page's user. */
async function register(page: Page, overrides: Record<string, unknown> = {}): Promise<Shipment> {
  const get = async <T>(path: string) => (await (await page.request.get(path)).json()) as T;
  const [merchant] = (await get<{ items: { id: string }[] }>("/api/merchants?q=Bullish")).items;
  const [place] = (await get<{ items: { id: string }[] }>("/api/neighborhoods?q=Laureles")).items;
  if (!merchant || !place) throw new Error("The e2e catalog lacks Bullish Hype or Laureles");
  const [point] = (
    await get<{ items: { id: string }[] }>(`/api/merchants/${merchant.id}/pickup-points`)
  ).items;
  const response = await page.request.post("/api/shipments", {
    data: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: merchant.id,
      pickupPointId: point?.id,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: place.id,
      paymentMode: "cash_on_delivery",
      codAmount: 85000,
      fee: 13000,
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Shipment;
}

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
  await expect(row(page, shipment)).toContainText("En riesgo · quedan 44 min");
  await expect(row(page, shipment)).toContainText("Laura Gómez");
  await expect(row(page, shipment)).toContainText("Laureles");
  await expect(row(page, shipment)).toContainText("$ 85.000");

  await setServerNow("2026-10-02T01:01:00Z"); // 20:01
  await page.clock.runFor(31_000);
  await expect(row(page, shipment)).toContainText("Atrasado · 1 min");
});

test("lists yesterday's undelivered shipment under the pending section (scenario 6)", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page, { serviceDate: "2026-09-30" });
  await page.goto("/");
  const pending = page.getByRole("region", { name: "Pendientes de días anteriores" });
  await expect(row(pending, shipment)).toContainText("30 sep 2026");
});

test("shows a shipment registered elsewhere within 30 seconds (scenario 7)", async ({
  dispatcherPage,
  ownerPage,
}) => {
  await ownerPage.clock.install();
  await ownerPage.goto("/");
  await expect(ownerPage.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
  const shipment = await register(dispatcherPage);
  await ownerPage.clock.runFor(21_000);
  await expect(row(ownerPage, shipment)).toBeVisible();
});

test("filters by status with the count chips and keeps the filter in the address", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Registrado/ }).click();
  await expect(page).toHaveURL(/status=registered/);
  await expect(row(page, shipment)).toBeVisible();
  await page.getByRole("button", { name: /^Entregado/ }).click();
  await expect(page).toHaveURL(/status=delivered/);
  await expect(row(page, shipment)).toHaveCount(0);
});
