import {
  companySettingsInput,
  formatTrackingNumber,
  type RouteDetail,
  type Shipment,
  type ShipmentDetail,
} from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { dispatch, ownSession, openStop, workerControls } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";

async function synchronized(page: Page) {
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Pendientes", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Sincronizando —" })).toHaveCount(0);
}
async function reportException(page: Page, address: string) {
  await openStop(page, address);
  await page.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Destinatario ausente");
  await sheet.getByRole("button", { name: "Guardar novedad" }).click();
  await expect(sheet).not.toBeVisible();
  await synchronized(page);
}
async function decide(
  page: Page,
  shipment: Shipment,
  decision: "Nuevo intento" | "Devolver al remitente",
  date?: string,
) {
  await page.goto("/envios/" + shipment.trackingNumber);
  await page.getByRole("button", { name: "Decidir novedad" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: decision, exact: true }).check();
  if (decision === "Nuevo intento") {
    await dialog.getByLabel("Fecha del nuevo intento").fill("");
    await dialog.getByRole("button", { name: "Guardar decisión" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Revisa la fecha y la ruta antes de guardar la decisión.",
    );
    await dialog.getByLabel("Fecha del nuevo intento").fill(date ?? "2026-10-01");
  }
  if (date) await dialog.getByLabel("Fecha del nuevo intento").fill(date);
  // T109: long courier names must not push a control outside the decision sheet.
  const outside = await dialog.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll("input, button, [role=combobox]")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
      })
      .map((element) => element.getAttribute("aria-label") ?? element.textContent);
  });
  expect(outside).toEqual([]);
  expect(await accessibilityViolations(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await expect(dialog).not.toBeVisible();
}
async function confirmResult(page: Page, label: string, save: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const sheet = page.getByRole("dialog");
  const recipient = sheet.getByLabel("Quién recibe");
  if (!(await recipient.isVisible())) await sheet.getByRole("button", { name: "Corregir" }).click();
  await recipient.fill("Persona de prueba");
  await sheet.getByRole("button", { name: "Revisar", exact: true }).click();
  await sheet.getByRole("button", { name: save, exact: true }).click();
  await expect(sheet).not.toBeVisible();
}

function pendingDelivery(page: Page, address: string) {
  return page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: address })
    .filter({ has: page.getByText("Entrega", { exact: true }) })
    .filter({ hasText: /\bPendiente\b/ });
}

async function configureOffice(owner: Page) {
  await owner.goto("/configuracion");
  await expect(owner.getByLabel("Dirección de la oficina")).toBeVisible();
  // The seed supplies the neighborhood; save through the actual owner form.
  await owner.getByLabel("Dirección de la oficina").fill("Carrera 90 # 65C-10");
  await owner.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(owner.getByText("Configuración guardada", { exact: true })).toBeVisible();
}

/** T106: two deliberate saves are different actions, even after an accepted no-op. */
test("saves a new office address after an acknowledged unchanged save", async ({
  ownerPage: owner,
}) => {
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.goto("/configuracion");
  const address = owner.getByLabel("Dirección de la oficina");
  await expect(address).toHaveValue(/Carrera 90 # 65C-10/);
  // The server commits the unchanged action, but its answer never reaches the form.
  await owner.route(
    "**/api/settings",
    async (route) => {
      const committed = await route.fetch();
      expect(committed.status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  const firstRequest = owner.waitForRequest(
    (request) => request.url().endsWith("/api/settings") && request.method() === "PATCH",
  );
  await owner.getByRole("button", { name: "Guardar configuración" }).click();
  const lost = companySettingsInput.parse((await firstRequest).postDataJSON());
  await expect(
    owner.getByRole("alert").filter({
      hasText: "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    }),
  ).toBeVisible();
  const firstResponse = owner.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings") && response.request().method() === "PATCH",
  );
  await owner.getByRole("button", { name: "Guardar configuración" }).click();
  const first = await firstResponse;
  expect(first.status()).toBe(200);
  const acknowledged = companySettingsInput.parse(first.request().postDataJSON());
  expect(acknowledged.actionId).toBe(lost.actionId);
  await expect(owner.getByRole("button", { name: "Guardar configuración" })).toBeEnabled();
  await address.fill("Calle 50 # 40-30");
  const secondResponse = owner.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings") && response.request().method() === "PATCH",
  );
  await owner.getByRole("button", { name: "Guardar configuración" }).click();
  const second = await secondResponse;
  expect(second.status()).toBe(200);
  expect(await second.json()).toMatchObject({ officeAddress: "Calle 50 # 40-30" });
  expect(companySettingsInput.parse(second.request().postDataJSON()).actionId).not.toBe(
    acknowledged.actionId,
  );
  await owner.reload();
  await expect(owner.getByLabel("Dirección de la oficina")).toHaveValue("Calle 50 # 40-30");
  // Keep the shared company setting stable for the remaining independent journeys.
  await configureOffice(owner);
});

/** US4 T055: quickstart 12, two attempts and a completed return, using actual phone forms. */
test("decides another attempt and a return, preserving attempts and never collecting on a return", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  await office.setViewportSize({ width: 390, height: 844 });
  const account = await ownSession(phone, owner);
  const first = await register(office, {
    recipientAddress: "Calle 31 # 40-01",
    paymentMode: "merchant_account",
    codAmount: undefined,
  });
  const returned = await register(office, { recipientAddress: "Calle 32 # 40-02" });
  const filler = await register(office, { recipientAddress: "Calle 33 # 40-03" });
  await dispatch(office, [first, returned, filler], account.courierId);
  await phone.goto("/mensajero");
  await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  for (const shipment of [first, returned]) {
    const card = phone.getByRole("listitem").filter({
      has: phone.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
    });
    await synchronized(phone);
    await card.getByRole("button", { name: "Confirmar recogida" }).click();
    // T108: old zero can still be visible while the IndexedDB save is in progress.
    await expect(card.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
    await synchronized(phone);
  }
  await reportException(phone, "Calle 31 # 40-01");
  // T111: exercise the cached visit before allowing the actual server refresh through.
  const refresh = Promise.withResolvers<undefined>();
  await phone.route("**/api/courier/route", async (route) => {
    await refresh.promise;
    await route.continue();
  });
  try {
    await decide(office, first, "Nuevo intento");
    await phone.reload();
    await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
    const cachedVisit = phone
      .getByRole("list", { name: "Paradas" })
      .getByRole("link")
      .filter({ hasText: "Calle 31 # 40-01" });
    await expect(cachedVisit).toHaveCount(1);
    await expect(cachedVisit).toContainText("Completada");
    await expect(pendingDelivery(phone, "Calle 31 # 40-01")).toHaveCount(0);
  } finally {
    refresh.resolve(undefined);
  }
  const newVisit = pendingDelivery(phone, "Calle 31 # 40-01");
  await expect(newVisit).toHaveCount(1);
  await newVisit.click();
  await phone.unroute("**/api/courier/route");
  await confirmResult(phone, "Registrar entrega", "Guardar entrega");
  await synchronized(phone);
  await office.reload();
  const attempts = office.getByRole("region", { name: "Intentos de entrega" });
  await expect(attempts.getByRole("listitem")).toHaveCount(2);
  await expect(attempts).toContainText("Destinatario ausente");
  await expect(attempts).toContainText("Entregado");
  await reportException(phone, "Calle 32 # 40-02");
  await decide(office, returned, "Devolver al remitente");
  await expect(office.getByText("Devolución en curso", { exact: true })).toBeVisible();
  await phone.goto("/mensajero");
  await phone.reload();
  await phone
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Devolución" })
    .click();
  await expect(
    phone.getByRole("button", { name: "Destinatario ausente", exact: true }),
  ).toHaveCount(0);
  await phone.getByRole("button", { name: "Reportar problema" }).click();
  const problem = phone.getByRole("dialog");
  await problem.getByLabel("Qué pasó").fill("El comercio está cerrado");
  await problem.getByRole("button", { name: "Revisar", exact: true }).click();
  await problem.getByRole("button", { name: "Guardar problema" }).click();
  await expect(problem).not.toBeVisible();
  await synchronized(phone);
  await expect(phone.getByText("El comercio está cerrado", { exact: true })).toBeVisible();
  await phone.getByRole("button", { name: "Confirmar devolución" }).click();
  const sheet = phone.getByRole("dialog");
  await expect(sheet.getByLabel("Efectivo", { exact: true })).toHaveCount(0);
  await expect(sheet.getByLabel("Transferencia a la empresa", { exact: true })).toHaveCount(0);
  await expect(sheet.getByLabel("Transferencia al cliente", { exact: true })).toHaveCount(0);
  await sheet.getByLabel("Quién recibe").fill("Persona del comercio");
  await sheet.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(sheet).toContainText("Devuelto");
  expect(await accessibilityViolations(phone)).toEqual([]);
  await sheet.getByRole("button", { name: "Guardar devolución" }).click();
  await expect(sheet).not.toBeVisible();
  await synchronized(phone);
  const detail = (await (
    await office.request.get("/api/shipments/" + returned.id)
  ).json()) as ShipmentDetail;
  expect(detail.status).toBe("returned");
  expect(detail.custodyCourier).toBeNull();
  expect(detail.records.find((record) => record.kind === "return")).toMatchObject({
    cashAmount: 0,
    companyTransferAmount: 0,
    merchantTransferAmount: 0,
  });
});

/** T110: original COD is not money collected when returning the package. */
test("never claims a collection when returning a high-COD shipment", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const shipment = await register(office, {
    recipientAddress: "Calle 38 # 40-08",
    codAmount: 2_000_001,
    confirmed: true,
  });
  const filler = await register(office, { recipientAddress: "Calle 39 # 40-09" });
  await dispatch(office, [shipment, filler], account.courierId);
  await phone.goto("/mensajero");
  await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  const card = phone.getByRole("listitem").filter({
    has: phone.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
  });
  await synchronized(phone);
  await card.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(card.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
  await synchronized(phone);
  await reportException(phone, "Calle 38 # 40-08");
  await decide(office, shipment, "Devolver al remitente");
  await phone.goto("/mensajero");
  await phone.reload();
  await phone
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Devolución" })
    .click();
  await phone.getByRole("button", { name: "Confirmar devolución" }).click();
  const sheet = phone.getByRole("dialog");
  await sheet.getByLabel("Quién recibe").fill("Persona del comercio");
  await sheet.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(sheet).toContainText("Devuelto");
  await expect(sheet.getByRole("alert").filter({ hasText: "Cobraste" })).toHaveCount(0);
  await expect(sheet.getByText("Total cobrado", { exact: true })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Guardar devolución" }).click();
  await expect(sheet).not.toBeVisible();
  await synchronized(phone);
  const detail = (await (
    await office.request.get("/api/shipments/" + shipment.id)
  ).json()) as ShipmentDetail;
  expect(detail).toMatchObject({ status: "returned", codAmount: 2_000_001 });
  expect(detail.records.find((record) => record.kind === "return")).toMatchObject({
    cashAmount: 0,
    companyTransferAmount: 0,
    merchantTransferAmount: 0,
  });
});

/** US4 T055: quickstart 13, with office settings and an offline office-return pickup. */
test("reschedules into office custody and completes an office pickup and return offline", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const shipment = await register(office, { recipientAddress: "Calle 34 # 40-04" });
  const filler = await register(office, { recipientAddress: "Calle 35 # 40-05" });
  await dispatch(office, [shipment, filler], account.courierId);
  await configureOffice(owner);
  await phone.goto("/mensajero");
  await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  const card = phone.getByRole("listitem").filter({
    has: phone.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
  });
  await synchronized(phone);
  await card.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(card.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
  await synchronized(phone);
  await reportException(phone, "Calle 34 # 40-04");
  await decide(office, shipment, "Nuevo intento", "2026-10-02");
  await office.goto("/rutas?date=2026-10-02");
  const heldRow = office.getByRole("row").filter({
    has: office.getByRole("link", {
      name: formatTrackingNumber(shipment.trackingNumber),
      exact: true,
    }),
  });
  await expect(heldRow).toContainText("En custodia de");
  await office.goto("/envios/" + shipment.trackingNumber);
  await phone.goto("/mensajero");
  await phone.reload();
  await expect(phone.getByRole("region", { name: "En mi custodia" })).toContainText(
    formatTrackingNumber(shipment.trackingNumber),
  );
  await office.getByRole("button", { name: "Recibido en oficina", exact: true }).click();
  await office
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar recepción" })
    .click();
  await expect(office.getByText("En oficina", { exact: true })).toBeVisible();
  await expect(office.getByRole("region", { name: "Custodia del paquete" })).toContainText(
    "La recibe la oficina",
  );
  await office.goto("/rutas?date=2026-10-02");
  await expect(
    office.getByRole("row").filter({
      has: office.getByRole("link", {
        name: formatTrackingNumber(shipment.trackingNumber),
        exact: true,
      }),
    }),
  ).toContainText("En oficina");
  // A separate shipment exercises the return decided before receipt, with a live route.
  await phone.goto("/mensajero");
  await phone.reload();
  await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  const secondCard = phone
    .getByRole("listitem")
    .filter({ has: phone.getByText(formatTrackingNumber(filler.trackingNumber), { exact: true }) });
  await synchronized(phone);
  await secondCard.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(secondCard.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
  await synchronized(phone);
  await reportException(phone, "Calle 35 # 40-05");
  // Both original deliveries are now done: dispatch another route before deciding the return.
  const extra = await register(office, { recipientAddress: "Calle 36 # 40-06" });
  const route = await dispatch(office, extra, account.courierId);
  await office.goto("/envios/" + filler.trackingNumber);
  await office.getByRole("button", { name: "Decidir novedad" }).click();
  const dialog = office.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Devolver al remitente", exact: true }).check();
  await dialog.getByRole("combobox", { name: "Ruta" }).click();
  await office.getByRole("option", { name: new RegExp(`Ruta ${String(route.number)}`) }).click();
  await dialog.getByRole("button", { name: "Guardar decisión" }).click();
  await expect(dialog).not.toBeVisible();
  await office.getByRole("button", { name: "Recibido en oficina", exact: true }).click();
  const receptionDialog = office.getByRole("alertdialog");
  await receptionDialog.getByRole("button", { name: "Confirmar recepción" }).click();
  await expect(receptionDialog).not.toBeVisible();
  await expect(office.getByText("En oficina", { exact: true })).toBeVisible();
  await phone.goto("/mensajero");
  await phone.reload();
  await expect(
    phone
      .getByRole("list", { name: "Paradas" })
      .getByRole("link")
      .filter({ hasText: "Carrera 90 # 65C-10" }),
  ).toBeVisible();
  await workerControls(phone);
  await synchronized(phone);
  await phone.context().setOffline(true);
  await phone
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Carrera 90 # 65C-10" })
    .click();
  await phone.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(phone.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
  await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await phone
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Devolución" })
    .click();
  await confirmResult(phone, "Confirmar devolución", "Guardar devolución");
  await expect(
    phone.getByRole("link", { name: "Pendientes 2 acciones y 0 fotos pendientes", exact: true }),
  ).toBeVisible();
  await phone.reload();
  await expect(
    phone.getByRole("link", { name: "Pendientes 2 acciones y 0 fotos pendientes", exact: true }),
  ).toBeVisible();
  await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await phone
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Devolución" })
    .click();
  await expect(phone.getByText("Devuelto", { exact: true })).toBeVisible();
  await phone.context().setOffline(false);
  await synchronized(phone);
  const recorded = (await (
    await office.request.get("/api/shipments/" + filler.id)
  ).json()) as ShipmentDetail;
  expect(recorded.status).toBe("returned");
  expect(recorded.custodyCourier).toBeNull();
  expect(recorded.records.filter((record) => record.kind === "return")).toHaveLength(1);
  expect(recorded.records.filter((record) => record.kind === "pickup")).toHaveLength(2);
  await office.reload();
  await expect(office.getByRole("region", { name: "Custodia del paquete" })).toContainText(
    "en la oficina",
  );
});

/** T055, quickstart 13: tomorrow's new attempt really starts at the office. */
test("reschedules for tomorrow, receives at the office and picks up there before delivery", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
  setServerNow,
}) => {
  const account = await ownSession(phone, owner);
  await configureOffice(owner);
  const shipment = await register(office, {
    recipientAddress: "Calle 37 # 40-07",
    paymentMode: "merchant_account",
    codAmount: undefined,
  });
  await dispatch(office, shipment, account.courierId);
  await phone.goto("/mensajero");
  await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await synchronized(phone);
  await phone.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(phone.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
  await synchronized(phone);
  await reportException(phone, "Calle 37 # 40-07");
  await decide(office, shipment, "Nuevo intento", "2026-10-02");
  await office.getByRole("button", { name: "Recibido en oficina", exact: true }).click();
  await office
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar recepción" })
    .click();
  await expect(office.getByText("En oficina", { exact: true })).toBeVisible();
  // Route creation/dispatch are existing panel flows; the new phone pickup is exercised visually.
  await setServerNow("2026-10-02T15:00:00Z");
  try {
    const created = await office.request.post("/api/routes", {
      data: {
        id: crypto.randomUUID(),
        actionId: crypto.randomUUID(),
        serviceDate: "2026-10-02",
        shipmentIds: [shipment.id],
        courierId: account.courierId,
      },
    });
    expect(created.status()).toBe(201);
    const route = (await created.json()) as RouteDetail;
    expect(route.stops[0]).toMatchObject({ kind: "pickup", address: "Carrera 90 # 65C-10" });
    expect(
      (
        await office.request.post(`/api/routes/${route.id}/dispatch`, {
          data: {
            actionId: crypto.randomUUID(),
            version: route.version,
          },
        })
      ).status(),
    ).toBe(200);
    await phone.goto("/mensajero");
    await phone.reload();
    await openStop(phone, "Carrera 90 # 65C-10");
    await synchronized(phone);
    await phone.getByRole("button", { name: "Confirmar recogida" }).click();
    await expect(phone.getByRole("button", { name: "Confirmar recogida" })).toHaveCount(0);
    await synchronized(phone);
    await openStop(phone, "Calle 37 # 40-07");
    await confirmResult(phone, "Registrar entrega", "Guardar entrega");
    await synchronized(phone);
    const completed = (await (
      await office.request.get("/api/shipments/" + shipment.id)
    ).json()) as ShipmentDetail;
    expect(completed.status).toBe("delivered");
    expect(completed.custodyCourier).toBeNull();
  } finally {
    await setServerNow("2026-10-01T15:00:00Z");
  }
});
