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

test("refuses the second of two changes to the same route and shows the latest version (scenario 16)", async ({
  dispatcherPage: first,
  ownerPage: second,
}) => {
  const run = unique();
  const courier = `Ana ${run}`;
  await createCourier(first, courier);
  const id = crypto.randomUUID();
  const created = await first.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: [(await register(first)).id],
    },
  });
  const route = (await created.json()) as RouteDetail;

  await Promise.all([first.goto(`/rutas/${route.id}`), second.goto(`/rutas/${route.id}`)]);
  await expect(second.getByRole("button", { name: "Despachar" })).toBeVisible();
  const field = first.getByRole("combobox", { name: "Mensajero" });
  await field.click();
  await field.fill(courier);
  await first.getByRole("option", { name: courier }).click();
  await expect(first.getByText("Mensajero asignado")).toBeVisible();

  // The second browser still shows the route without a courier; its dispatch is refused.
  await second.getByRole("button", { name: "Despachar" }).click();
  await expect(second.getByRole("alert")).toHaveText(
    "Esta ruta cambió; revisa la versión más reciente.",
  );
  await expect(second.getByText(`Jueves 1 de octubre · ${courier}`)).toBeVisible();
  await expect(second.getByText("En preparación", { exact: true })).toBeVisible();

  // With the latest version on screen, the same action goes through.
  await second.getByRole("button", { name: "Despachar" }).click();
  await expect(second.getByText("En curso", { exact: true })).toBeVisible();
});

test("keeps the rest of the selection when another dispatcher takes a shipment first (FR-021)", async ({
  dispatcherPage: first,
  ownerPage: second,
}) => {
  const taken = await register(first);
  const kept = await register(first, { pickupPointId: taken.pickupPointId });
  await Promise.all([first.goto("/rutas"), second.goto("/rutas")]);
  for (const shipment of [taken, kept]) {
    await first.getByRole("checkbox", { name: `Elegir ${guide(shipment)}` }).check();
  }
  await second.getByRole("checkbox", { name: `Elegir ${guide(taken)}` }).check();
  await second.getByRole("button", { name: "Crear ruta con 1 envío" }).click();
  await expect(second.getByRole("heading", { level: 1, name: /^Ruta \d+$/ })).toBeVisible();

  await first.getByRole("button", { name: "Crear ruta con 2 envíos" }).click();
  await expect(first.getByRole("alert")).toContainText("Actualiza la lista");
  // The shipment taken by the other route leaves the list and the selection; the other stays.
  await expect(first.getByRole("checkbox", { name: `Elegir ${guide(taken)}` })).toBeHidden();
  await expect(first.getByRole("checkbox", { name: `Elegir ${guide(kept)}` })).toBeChecked();
  await first.getByRole("button", { name: "Crear ruta con 1 envío" }).click();
  await expect(first.getByRole("heading", { level: 1, name: /^Ruta \d+$/ })).toBeVisible();
  await expect(first.getByRole("list", { name: "Paradas de la ruta" })).toContainText(guide(kept));
});
