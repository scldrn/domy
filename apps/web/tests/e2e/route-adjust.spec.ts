import { formatTrackingNumber, type RouteDetail, type Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { expect, test } from "./fixtures";

const unique = () => String(Date.now()).slice(-6);
const guide = (shipment: Shipment) => formatTrackingNumber(shipment.trackingNumber);

async function createCourier(page: Page, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const response = await page.request.post("/api/couriers", {
    data: { id, name, phone: "3004445566", aliases: [] },
  });
  expect(response.status()).toBe(201);
  return id;
}

/** Another pickup point of the shipment's merchant, so a route gets a second pickup place. */
async function anotherPickupPoint(page: Page, shipment: Shipment, label: string): Promise<string> {
  const id = crypto.randomUUID();
  const response = await page.request.post(`/api/merchants/${shipment.merchant.id}/pickup-points`, {
    data: { id, label, address: `Calle ${label}`, neighborhoodId: shipment.pickupNeighborhood.id },
  });
  expect(response.status()).toBe(201);
  return id;
}

/** A route for today through the API (feature 002, US1), dispatched when a courier is given. */
async function routeOf(page: Page, shipments: Shipment[], courierId?: string) {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: shipments.map((shipment) => shipment.id),
      ...(courierId && { courierId }),
    },
  });
  expect(created.status()).toBe(201);
  const route = (await created.json()) as RouteDetail;
  if (courierId) {
    const dispatched = await page.request.post(`/api/routes/${route.id}/dispatch`, {
      data: { actionId: crypto.randomUUID(), version: route.version },
    });
    expect(dispatched.status()).toBe(200);
  }
  return route;
}

const stopList = (page: Page) => page.getByRole("list", { name: "Paradas de la ruta" });
const stops = (page: Page) => stopList(page).locator(":scope > li");

test("adds a registered shipment to a route in progress and removes another not picked up (scenario 9)", async ({
  dispatcherPage: page,
}) => {
  const run = unique();
  const kept = await register(page);
  const removed = await register(page, {
    pickupPointId: await anotherPickupPoint(page, kept, `Local ${run}`),
  });
  const route = await routeOf(page, [kept, removed], await createCourier(page, `Elena ${run}`));
  const added = await register(page, { pickupPointId: kept.pickupPointId });

  await page.goto(`/rutas/${route.id}`);
  await expect(stops(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Agregar envíos" }).click();
  const dialog = page.getByRole("dialog", {
    name: `Agregar envíos a la Ruta ${String(route.number)}`,
  });
  await dialog.getByRole("checkbox", { name: `Elegir ${guide(added)}` }).check();
  await dialog.getByRole("button", { name: "Agregar 1 envío" }).click();
  await expect(dialog).toBeHidden();

  // It joins the pickup stop of its place and is on the way at once.
  await expect(stops(page)).toHaveCount(5);
  await expect(
    stops(page)
      .first()
      .getByRole("listitem")
      .filter({ hasText: guide(added) }),
  ).toContainText("En ruta");

  // The removed shipment's pickup stop is left empty and disappears.
  await page.getByRole("button", { name: `Quitar ${guide(removed)} de la ruta` }).click();
  await expect(stops(page)).toHaveCount(3);
  await expect(stopList(page)).not.toContainText(guide(removed));
  const history = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText(`Envío agregado · ${guide(added)}`);
  await expect(history).toContainText(`Envío quitado · ${guide(removed)}`);

  await page.goto(`/envios/${removed.trackingNumber}`);
  await expect(page.getByText("Registrado", { exact: true }).first()).toBeVisible();
});

test("takes a voided shipment off its route (scenario 10)", async ({ dispatcherPage: page }) => {
  const kept = await register(page);
  const voided = await register(page, { pickupPointId: kept.pickupPointId });
  const route = await routeOf(page, [kept, voided]);

  await page.goto(`/envios/${voided.trackingNumber}`);
  await page.getByRole("button", { name: "Anular envío" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Motivo de la anulación").fill("El cliente canceló el pedido");
  await dialog.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByText("Anulado", { exact: true }).first()).toBeVisible();

  await page.goto(`/rutas/${route.id}`);
  await expect(stops(page)).toHaveCount(2);
  await expect(stopList(page)).not.toContainText(guide(voided));
  const history = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText(`Envío quitado · ${guide(voided)}`);
  await expect(history).toContainText("El cliente canceló el pedido");
});
