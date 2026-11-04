import { formatTrackingNumber, type RouteDetail, type Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { expect, test } from "./fixtures";

// Scenario 12 needs a package picked up, which only the courier app does (feature 003); the
// integration tests of handovers cover it (quickstart ⚙).

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

/** A route for today with a courier, dispatched through the API (feature 002, US1). */
async function dispatchedRoute(page: Page, shipments: Shipment[], courierId: string) {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: shipments.map((shipment) => shipment.id),
      courierId,
    },
  });
  expect(created.status()).toBe(201);
  const route = (await created.json()) as RouteDetail;
  const dispatched = await page.request.post(`/api/routes/${route.id}/dispatch`, {
    data: { actionId: crypto.randomUUID(), version: route.version },
  });
  expect(dispatched.status()).toBe(200);
  return route;
}

test("reassigns a shipment on the way to another courier's route, only with a reason (scenario 11)", async ({
  dispatcherPage: page,
}) => {
  const run = unique();
  const kept = await register(page);
  const moved = await register(page, { pickupPointId: kept.pickupPointId });
  const from = await dispatchedRoute(page, [kept, moved], await createCourier(page, `Ana ${run}`));
  const to = await dispatchedRoute(
    page,
    [await register(page)],
    await createCourier(page, `Beto ${run}`),
  );

  await page.goto(`/rutas/${from.id}`);
  await page.getByRole("button", { name: `Reasignar ${guide(moved)}` }).click();
  const dialog = page.getByRole("dialog", { name: `Reasignar ${guide(moved)}` });
  await dialog.getByRole("combobox", { name: "Ruta de destino" }).click();
  await page
    .getByRole("option", { name: new RegExp(`^Ruta ${String(to.number)} · Beto ${run}`) })
    .click();
  await dialog.getByRole("button", { name: "Reasignar", exact: true }).click();
  await expect(dialog.getByText("Escribe un motivo de al menos 5 caracteres.")).toBeVisible();
  await dialog.getByLabel("Motivo").fill("La moto de Ana se varó");
  await dialog.getByRole("button", { name: "Reasignar", exact: true }).click();
  await expect(dialog).toBeHidden();

  // It leaves Ana's route with both stops; both histories name the couriers and the reason.
  await expect(page.getByRole("list", { name: "Paradas de la ruta" })).not.toContainText(
    guide(moved),
  );
  const routeHistory = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(routeHistory).toContainText(`Reasignación · ${guide(moved)}`);
  await expect(routeHistory).toContainText(`Ana ${run} → Beto ${run}`);
  await page.goto(`/envios/${moved.trackingNumber}`);
  const history = page.getByRole("region", { name: "Historial", exact: true });
  await expect(history).toContainText("Reasignado");
  await expect(history).toContainText(`Mensajero: Ana ${run} → Beto ${run}`);
  await expect(history).toContainText("La moto de Ana se varó");
});

test("reassigns a whole route to a courier without a route in progress (scenario 13)", async ({
  dispatcherPage: page,
}) => {
  const run = unique();
  const route = await dispatchedRoute(
    page,
    [await register(page)],
    await createCourier(page, `Carla ${run}`),
  );
  const dario = `Darío ${run}`;
  await createCourier(page, dario);

  await page.goto(`/rutas/${route.id}`);
  await page.getByRole("button", { name: "Reasignar ruta" }).click();
  const dialog = page.getByRole("dialog", { name: `Reasignar la Ruta ${String(route.number)}` });
  const courier = dialog.getByRole("combobox", { name: "Nuevo mensajero" });
  await courier.click();
  await courier.fill(dario);
  await page.getByRole("option", { name: dario }).click();
  await dialog.getByLabel("Motivo").fill("Carla terminó su turno");
  await dialog.getByRole("button", { name: "Reasignar ruta" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("region", { name: "Mensajero", exact: true })).toContainText(dario);
  const history = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText(`Carla ${run} → ${dario}`);
  await expect(history).toContainText("Carla terminó su turno");

  // Deactivating Darío warns that the route stays with him until reassigned (FR-010).
  await page.goto("/mensajeros");
  await page.getByRole("searchbox", { name: "Buscar mensajeros" }).fill(dario);
  await page
    .getByRole("row", { name: new RegExp(dario) })
    .getByRole("button", { name: "Desactivar" })
    .click();
  // One notice, so the warning is never hidden under a plain "desactivado".
  await expect(
    page.getByText(
      `${dario} desactivado. Tiene 1 ruta abierta, que sigue a su nombre hasta que la reasignes.`,
    ),
  ).toBeVisible();
  await expect(page.getByText(`${dario} desactivado`, { exact: true })).toBeHidden();
});
