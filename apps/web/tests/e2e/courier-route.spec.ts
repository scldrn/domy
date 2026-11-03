import { formatTrackingNumber, type RouteDetail, type Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { showEveryShipment } from "./board";
import { expect, test } from "./fixtures";

/**
 * The courier app on a phone (feature 003, US1, quickstart scenarios 1–7). The e2e courier
 * account is linked to "Mensajero Uno" by the global setup.
 */

const guide = (shipment: Shipment) => formatTrackingNumber(shipment.trackingNumber);
const phone = { width: 390, height: 844 };

async function courierId(page: Page): Promise<string> {
  const response = await page.request.get("/api/couriers?q=Mensajero%20Uno");
  const [courier] = ((await response.json()) as { items: { id: string }[] }).items;
  if (!courier) throw new Error("The e2e courier is missing");
  return courier.id;
}

async function dispatch(page: Page, shipments: Shipment[]): Promise<RouteDetail> {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: shipments.map((shipment) => shipment.id),
      courierId: await courierId(page),
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

const taskCard = (page: Page, shipment: Shipment) =>
  page
    .getByRole("list", { name: "Envíos de la parada" })
    .locator(":scope > li")
    .filter({ hasText: guide(shipment) });

async function openStop(page: Page, address: string) {
  await page.getByRole("link", { name: "Mi ruta" }).first().click();
  await page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: address })
    .click();
}

async function takePhoto(page: Page, button: string) {
  const image = await page.screenshot({ type: "jpeg", quality: 40 });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: image });
  await expect(page.getByRole("img", { name: "Foto 1" })).toBeVisible();
}

test("says when no route has been dispatched (scenario 1, US1 scenario 11)", async ({
  courierPage: page,
}) => {
  await page.setViewportSize(phone);
  await page.goto("/mensajero");
  await expect(page.getByText("No tienes una ruta despachada")).toBeVisible();
});

test("carries out a route from the phone (scenarios 2–7)", async ({
  courierPage: page,
  dispatcherPage: office,
}) => {
  const plain = await register(office, {
    paymentMode: "merchant_account",
    codAmount: 0,
    recipientAddress: "Calle 11 # 40-01",
  });
  const split = await register(office, { recipientAddress: "Calle 12 # 40-02" });
  const short = await register(office, { recipientAddress: "Calle 13 # 40-03" });
  const route = await dispatch(office, [plain, split, short]);

  // Scenario 2: the route in the dispatcher's order, the first pending stop highlighted.
  await page.setViewportSize(phone);
  await page.goto("/mensajero");
  await expect(page.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  const stops = page.getByRole("list", { name: "Paradas" }).getByRole("link");
  await expect(stops).toHaveCount(4);
  await expect(stops.first()).toHaveAttribute("aria-current", "step");
  await expect(stops.first()).toContainText("Recogida");

  // Scenario 3: two of three pickups confirmed; the stop stays pending.
  await stops.first().click();
  for (const shipment of [plain, split]) {
    await taskCard(page, shipment).getByRole("button", { name: "Confirmar recogida" }).click();
    await expect(taskCard(page, shipment)).toContainText("Recogido");
  }
  await expect(
    taskCard(page, short).getByRole("button", { name: "Confirmar recogida" }),
  ).toBeVisible();

  // Scenario 7: a delivery before its pickup asks to confirm the pickup first; shortcuts.
  await openStop(page, "Calle 13 # 40-03");
  const shortCard = taskCard(page, short);
  await expect(shortCard).toContainText("Primero confirma la recogida de este envío.");
  const shortcuts = page.getByRole("navigation", { name: "Atajos de la parada" });
  await expect(shortcuts.getByRole("link", { name: "Llamar" })).toHaveAttribute(
    "href",
    "tel:+573001234567",
  );
  await expect(shortcuts.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/573001234567",
  );
  await expect(shortcuts.getByRole("link", { name: "Mapa" })).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/.*Calle%2013/,
  );
  await shortCard.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(shortCard.getByRole("button", { name: "Registrar entrega" })).toBeVisible();

  // Scenario 4: a delivery without COD, with a photo, proposing the recipient's name.
  await openStop(page, "Calle 11 # 40-01");
  await taskCard(page, plain).getByRole("button", { name: "Registrar entrega" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Laura Gómez");
  await sheet.getByRole("button", { name: "Corregir" }).click();
  await expect(sheet.getByLabel("Quién recibe")).toHaveValue("Laura Gómez");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await takePhoto(page, "Tomar foto");
  await expect(sheet).toContainText("Laura Gómez");
  await sheet.getByRole("button", { name: "Guardar entrega" }).click();
  await expect(taskCard(page, plain)).toContainText("Entregado");

  // Scenario 5: COP 85.000 split between cash and a transfer to the company, with receipt.
  await openStop(page, "Calle 12 # 40-02");
  await taskCard(page, split).getByRole("button", { name: "Registrar entrega" }).click();
  await sheet.getByRole("button", { name: "Corregir" }).click();
  await expect(sheet.getByLabel("Efectivo")).toHaveValue("$ 85.000");
  await sheet.getByLabel("Efectivo").fill("50000");
  await sheet.getByLabel("Transferencia a la empresa").fill("35000");
  await expect(sheet.getByText("Comprobante de la transferencia")).toBeVisible();
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet).toContainText("$ 35.000");
  await expect(
    sheet.getByText("Valor a recaudar").locator("..").getByRole("definition"),
  ).toHaveText("$ 85.000");
  await expect(sheet.getByText("Total cobrado").locator("..").getByRole("definition")).toHaveText(
    "$ 85.000",
  );
  await sheet.getByRole("button", { name: "Guardar entrega" }).click();
  await expect(taskCard(page, split)).toContainText("Entregado");

  // Scenario 6: a different amount requires a note; no photo.
  await openStop(page, "Calle 13 # 40-03");
  await shortCard.getByRole("button", { name: "Registrar entrega" }).click();
  await sheet.getByRole("button", { name: "Corregir" }).click();
  await sheet.getByLabel("Efectivo").fill("80000");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet).toContainText("escribe una nota de al menos 5 caracteres");
  await sheet.getByLabel("Nota sobre el recaudo").fill("Pagó 80.000; el resto mañana");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet).toContainText("Sin foto");
  await sheet.getByRole("button", { name: "Guardar entrega" }).click();
  await expect(shortCard).toContainText("Entregado");

  // Every stop done: once synchronized, the route is finished and leaves the phone.
  await page.getByRole("link", { name: "Mi ruta" }).first().click();
  await expect(page.getByText("No tienes una ruta despachada")).toBeVisible({ timeout: 15_000 });

  // The dispatch board sees each record once, with its flags (FR-033).
  await office.goto("/");
  await showEveryShipment(office);
  const row = (shipment: Shipment) => office.getByRole("row").filter({ hasText: guide(shipment) });
  await expect(row(short)).toContainText("Entregado");
  await expect(row(short)).toContainText("Sin foto");
  await expect(row(short)).toContainText("Recaudo diferente");
  await expect(row(plain)).not.toContainText("Sin foto");
  await office.goto(`/envios/${plain.trackingNumber}`);
  const records = office.getByRole("region", { name: "Registros del mensajero" });
  await expect(records).toContainText("Recibió");
  await expect(records.getByRole("img", { name: "Prueba de entrega" })).toBeVisible();
});
