import type { RouteDetail, Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { expect, test } from "./fixtures";

// Scenario 15's refusal needs a completed stop, which only the courier app records (feature
// 003); the integration tests of undoing a dispatch cover it (quickstart ⚙).

const unique = () => String(Date.now()).slice(-6);

async function createCourier(page: Page, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const response = await page.request.post("/api/couriers", {
    data: { id, name, phone: "3004445566", aliases: [] },
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
  let route = (await created.json()) as RouteDetail;
  if (courierId) {
    const dispatched = await page.request.post(`/api/routes/${route.id}/dispatch`, {
      data: { actionId: crypto.randomUUID(), version: route.version },
    });
    expect(dispatched.status()).toBe(200);
    route = (await dispatched.json()) as RouteDetail;
  }
  return route;
}

const stopList = (page: Page) => page.getByRole("list", { name: "Paradas de la ruta" });

test("cancels a route in preparation with a reason; a route in progress is refused (scenario 14)", async ({
  dispatcherPage: page,
}) => {
  const first = await register(page);
  const second = await register(page, { pickupPointId: first.pickupPointId });
  const route = await routeOf(page, [first, second]);

  await page.goto(`/rutas/${route.id}`);
  await page.getByRole("button", { name: "Cancelar ruta" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: `¿Cancelar la Ruta ${String(route.number)}?`,
  });
  await dialog.getByRole("button", { name: "Cancelar ruta" }).click();
  await expect(dialog.getByText("Escribe un motivo de al menos 5 caracteres.")).toBeVisible();
  await dialog.getByLabel("Motivo").fill("La ruta se armó por error");
  await dialog.getByRole("button", { name: "Cancelar ruta" }).click();
  await expect(dialog).toBeHidden();

  // The route keeps its number as "Cancelada", without stops, and its history says why.
  await expect(
    page.getByRole("heading", { level: 1, name: `Ruta ${String(route.number)}` }),
  ).toBeVisible();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(stopList(page)).toBeHidden();
  await expect(
    page.getByText("Motivo: La ruta se armó por error. Sus envíos volvieron a «Sin asignar»."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Despachar" })).toBeHidden();
  const history = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText("Ruta cancelada");
  await expect(history).toContainText("La ruta se armó por error");
  await page.goto(`/envios/${second.trackingNumber}`);
  await expect(page.getByText("Registrado", { exact: true }).first()).toBeVisible();

  // A route in progress offers undoing the dispatch instead, and the server refuses to
  // cancel it with the way out.
  const running = await routeOf(
    page,
    [await register(page)],
    await createCourier(page, `Fabio ${unique()}`),
  );
  await page.goto(`/rutas/${running.id}`);
  await expect(page.getByRole("button", { name: "Deshacer despacho" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar ruta" })).toBeHidden();
  const refused = await page.request.post(`/api/routes/${running.id}/cancel`, {
    data: { actionId: crypto.randomUUID(), version: running.version, reason: "Por error" },
  });
  expect(refused.status()).toBe(409);
  expect(await refused.json()).toMatchObject({
    error: { code: "route_in_progress", message: expect.stringContaining("deshaz el despacho") },
  });
});

test("undoes the dispatch of a route with nothing picked up (scenario 15)", async ({
  dispatcherPage: page,
}) => {
  const run = unique();
  const shipment = await register(page);
  const route = await routeOf(page, [shipment], await createCourier(page, `Gloria ${run}`));

  await page.goto(`/rutas/${route.id}`);
  await page.getByRole("button", { name: "Deshacer despacho" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: `¿Deshacer el despacho de la Ruta ${String(route.number)}?`,
  });
  await dialog.getByLabel("Motivo").fill("Se despachó al mensajero equivocado");
  await dialog.getByRole("button", { name: "Deshacer despacho" }).click();
  await expect(dialog).toBeHidden();

  // In preparation again, with the same courier, its shipment "Asignado", ready to dispatch.
  await expect(page.getByText("En preparación", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Mensajero" })).toHaveValue(`Gloria ${run}`);
  await expect(stopList(page).getByText("Asignado", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Despachar" })).toBeVisible();
  const history = page.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText("Despacho deshecho");
  await expect(history).toContainText("Se despachó al mensajero equivocado");

  // Opened again, the route shows its courier, ready to change before dispatching.
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Mensajero" })).toHaveValue(`Gloria ${run}`);
});
