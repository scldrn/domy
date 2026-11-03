import { formatTrackingNumber, type Shipment, type ShipmentDetail } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { boardRow, showEveryShipment } from "./board";
import { dispatch, ownSession, workerControls, openStop, deliver } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";

const card = (page: Page, shipment: Shipment) =>
  page
    .getByRole("list", { name: "Envíos de la parada" })
    .getByRole("listitem")
    .filter({
      has: page.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
    });

/** Check the center and edges, not just a visible bounding box (T101). */
function targetIsUncovered(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return [0.1, 0.5, 0.9].every((x) =>
    [0.1, 0.5, 0.9].every((y) =>
      element.contains(document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)),
    ),
  );
}

async function reportProblem(page: Page, shipment: Shipment, note: string) {
  await expect(
    card(page, shipment).getByRole("button", { name: "Reportar problema" }),
  ).toBeVisible();
  await card(page, shipment).getByRole("button", { name: "Reportar problema" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Qué pasó").fill(note);
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet).toContainText(note);
  await sheet.getByRole("button", { name: "Guardar problema" }).click();
  await expect(sheet).not.toBeVisible();
  await expectSynchronized(page);
}

/** The panel must observe an acknowledged change, not race the phone's local replay. */
async function expectSynchronized(page: Page) {
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Pendientes", exact: true }),
  ).toBeVisible();
}

async function reportException(page: Page, photo = false) {
  await expect(
    page.getByRole("button", { name: "Destinatario ausente", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Destinatario ausente");
  if (photo) {
    const image = await page.screenshot({ type: "jpeg", quality: 40 });
    const chooser = page.waitForEvent("filechooser");
    await sheet.getByRole("button", { name: "Tomar foto" }).click();
    await (await chooser).setFiles({ name: "novedad.jpg", mimeType: "image/jpeg", buffer: image });
    await expect(sheet.getByRole("img", { name: "Foto 1" })).toBeVisible();
  }
  await expect(sheet).toContainText("Destinatario ausente");
  await sheet.getByRole("button", { name: "Guardar novedad" }).click();
  await expect(sheet).not.toBeVisible();
}

/** T101: axe checks semantics/contrast, not whether another layer intercepts a target. */
test("keeps exception controls above visible synchronization notifications", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(page, owner);
  const shipment = await register(office, { recipientAddress: "Calle 25 # 40-05" });
  await dispatch(office, shipment, account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(page);
  await page.context().setOffline(true);
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Confirmar recogida" }).click();
  const notifications = page.locator("[data-sonner-toast]");
  await expect(
    notifications.filter({ hasText: "Sin conexión. Tus pendientes siguen guardados." }),
  ).toBeVisible();
  await expect(notifications.filter({ hasText: "recogida" })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.keyboard.press("Alt+t");
  await expect(notifications).toHaveCount(2);
  await expect(page.locator("[data-sonner-toast][data-expanded=true]")).toHaveCount(2);
  await page.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  const stop = page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: "Calle 25 # 40-05" });
  const address = stop.getByText("Calle 25 # 40-05", { exact: true });
  // T130: the full stack must have arrived; racing its entrance animation hid interception.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== "running"),
  );
  // The card center is under the stack, but its address is a real unobscured tap target.
  await address.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await address.click();
  await page.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
  const sheet = page.getByRole("dialog");
  expect(await accessibilityViolations(page)).toEqual([]);
  const photo = sheet.getByRole("button", { name: "Tomar foto" });
  await photo.scrollIntoViewIfNeeded();
  await expect(page.locator("[data-sonner-toast][data-expanded=true]")).toHaveCount(2);
  await expect(notifications.nth(0)).toBeVisible();
  await expect(notifications.nth(1)).toBeVisible();
  expect(
    await photo.evaluate(targetIsUncovered),
    "the complete photo target stays above notifications",
  ).toBe(true);
  const save = sheet.getByRole("button", { name: "Guardar novedad" });
  await expect(page.locator("[data-sonner-toast][data-expanded=true]")).toHaveCount(2);
  await expect(notifications.nth(0)).toBeVisible();
  await expect(notifications.nth(1)).toBeVisible();
  expect(
    await save.evaluate(targetIsUncovered),
    "the complete confirmation target stays above notifications",
  ).toBe(true);
  await save.click();
  await expect(sheet).not.toBeVisible();
});

test("stabilizes notifications below a courier sheet and restores expiry without losing its draft (T154)", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  await page.clock.install();
  const account = await ownSession(page, owner);
  const shipment = await register(office, { recipientAddress: "Calle 26 # 40-06" });
  await dispatch(office, shipment, account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(page);
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Confirmar recogida" }).click();
  const notifications = page.locator("[data-sonner-toast]").filter({ hasText: "recogida" });
  await expect(notifications).toHaveCount(1);
  await page.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await openStop(page, "Calle 26 # 40-06");
  await page.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Corregir" }).click();
  const input = sheet.getByLabel("Nota (opcional)");
  await input.fill("Nota conservada durante la revisión");
  await expect(input).toBeFocused();
  expect(
    await notifications.first().evaluate(targetIsUncovered),
    "the notification is below the real sheet, not a force-hovered target",
  ).toBe(false);
  expect(
    await accessibilityViolations(page, async () => {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      try {
        await page.clock.runFor(5_000);
        await expect(notifications).toHaveCount(1);
        await expect(notifications.first()).toHaveAttribute("data-expanded", "true");
        await expect(sheet).toBeVisible();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue("Nota conservada durante la revisión");
      } finally {
        await page.clock.resume();
      }
    }),
  ).toEqual([]);
  await expect(sheet).toBeVisible();
  await expect(input).toBeFocused();
  await expect(page.locator("[data-sonner-toast][data-expanded=true]")).toHaveCount(0);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  try {
    await page.clock.runFor(5_000);
    await expect(notifications).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Nota conservada durante la revisión");
  } finally {
    await page.clock.resume();
  }
});

/** US3 T049: actual phone forms, board sections/flags and private photos (quickstart 11). */
test("reports and replaces a pickup problem, clears it upon pickup and reviews a delivery exception", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(page, owner);
  const failed = await register(office, { recipientAddress: "Calle 21 # 40-01" });
  const problem = await register(office, { recipientAddress: "Calle 22 # 40-02" });
  await dispatch(office, [failed, problem], account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("list", { name: "Paradas" })).toBeVisible();
  await openStop(page, "Calle 21 # 40-01");
  await expect(page.getByRole("button", { name: "Destinatario ausente", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await expect(
    card(page, problem).getByRole("button", { name: "Reportar problema" }),
  ).toBeVisible();
  await card(page, problem).getByRole("button", { name: "Reportar problema" }).click();
  let sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet.getByText(/al menos 5/)).toBeVisible();
  await sheet.getByLabel("Qué pasó").fill("El pedido no está listo");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await sheet.getByRole("button", { name: "Guardar problema" }).click();
  await expect(sheet).not.toBeVisible();
  await expect(card(page, problem)).toContainText("Problema de recogida: El pedido no está listo");
  await expectSynchronized(page);
  await office.goto("/");
  await showEveryShipment(office);
  await expect(boardRow(office, problem)).toContainText("Problema de recogida");
  await reportProblem(page, problem, "El cliente está cerrando");
  await expect(card(page, problem)).toContainText("El cliente está cerrando");
  await expect(card(page, problem)).not.toContainText("El pedido no está listo");
  await card(page, problem).getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(card(page, problem)).not.toContainText("Problema de recogida");
  await expectSynchronized(page);
  await office.reload();
  await showEveryShipment(office);
  await expect(boardRow(office, problem)).not.toContainText("Problema de recogida");
  await card(page, failed).getByRole("button", { name: "Confirmar recogida" }).click();
  await expectSynchronized(page);
  await openStop(page, "Calle 21 # 40-01");
  const exceptionActions = card(page, failed);
  await expect(
    exceptionActions.getByRole("button", { name: "Destinatario ausente", exact: true }),
  ).toBeVisible();
  await expect(
    exceptionActions.getByRole("button", { name: "Dirección errada", exact: true }),
  ).toBeVisible();
  await expect(
    exceptionActions.getByRole("button", { name: "Rechazado", exact: true }),
  ).toBeVisible();
  await exceptionActions.getByRole("button", { name: "Destinatario ausente" }).click();
  sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Destinatario ausente");
  await sheet.getByRole("button", { name: "Corregir" }).click();
  await expect(sheet.getByRole("radio")).toHaveCount(3);
  await expect(sheet.getByRole("radio", { name: "Dirección errada" })).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Rechazado" })).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Destinatario ausente" })).toBeChecked();
  await sheet.getByRole("radio", { name: "Destinatario ausente" }).check();
  await sheet.getByLabel("Nota (opcional)").fill("xyz");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet.getByText(/al menos 5/)).toBeVisible();
  await sheet.getByLabel("Nota (opcional)").fill("Nadie responde al timbre");
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await expect(sheet).toContainText("Destinatario ausente");
  await expect(sheet).toContainText("Nadie responde al timbre");
  expect(await accessibilityViolations(page)).toEqual([]);
  await sheet.getByRole("button", { name: "Corregir" }).click();
  await expect(sheet.getByRole("radio", { name: "Destinatario ausente" })).toBeChecked();
  await sheet.getByRole("button", { name: "Revisar" }).click();
  await sheet.getByRole("button", { name: "Guardar novedad" }).click();
  await expect(sheet).not.toBeVisible();
  await expectSynchronized(page);
  await office.reload();
  await showEveryShipment(office);
  const section = office.getByRole("region", { name: /^Por resolver/ });
  await expect(
    section.getByRole("listitem").filter({ hasText: formatTrackingNumber(failed.trackingNumber) }),
  ).toContainText("Novedad por decidir");
  await expect(boardRow(office, failed)).toHaveCount(1);
  await expect(boardRow(office, failed)).toContainText("Novedad");
  await office.goto(`/envios/${failed.trackingNumber}`);
  await expect(office.getByRole("region", { name: "Registros del mensajero" })).toContainText(
    "Destinatario ausente",
  );
});

test("keeps a reported errand pending and clears its problem after completion", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(page, owner);
  const errand = await register(office, {
    kind: "errand",
    errandDescription: "Pagar un recibo",
    recipientName: undefined,
    recipientPhone: undefined,
    recipientAddress: undefined,
    recipientNeighborhoodId: undefined,
    paymentMode: "merchant_account",
    codAmount: undefined,
    feeOverrideReason: "Diligencia en el centro",
  });
  await dispatch(office, errand, account.courierId);
  await page.goto("/mensajero");
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await reportProblem(page, errand, "La oficina está cerrada");
  await expect(card(page, errand)).toContainText("Problema de recogida: La oficina está cerrada");
  await office.goto("/");
  await showEveryShipment(office);
  await expect(boardRow(office, errand)).toContainText("Problema de recogida");
  await page.getByRole("button", { name: "Completar diligencia" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Diligencia completada");
  await expect(sheet).toContainText(formatTrackingNumber(errand.trackingNumber));
  await sheet.getByRole("button", { name: "Guardar diligencia" }).click();
  await expect(sheet).not.toBeVisible();
  await expectSynchronized(page);
  await office.reload();
  await showEveryShipment(office);
  await expect(boardRow(office, errand)).toContainText("Entregado");
  await expect(boardRow(office, errand)).not.toContainText("Problema de recogida");
});

/** Complete quickstart 8: pickup, delivery and exception offline, reopen and exactly-once retry. */
test("reopens offline with pickups, delivery and exception, then synchronizes once after a lost response", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(page, owner);
  const delivered = await register(office, {
    recipientAddress: "Calle 23 # 40-03",
  });
  const failed = await register(office, { recipientAddress: "Calle 24 # 40-04" });
  const route = await dispatch(office, [delivered, failed], account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  await workerControls(page);
  await page.context().setOffline(true);
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  for (const shipment of [delivered, failed]) {
    await card(page, shipment).getByRole("button", { name: "Confirmar recogida" }).click();
    await expect(card(page, shipment)).toContainText("Recogido");
  }
  await openStop(page, "Calle 23 # 40-03");
  await deliver(page, true);
  await openStop(page, "Calle 24 # 40-04");
  await reportException(page, true);
  await expect(page.getByText("Novedad", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Pendientes/ }).click();
  await expect(
    page.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("list", { name: "Fotos pendientes" }).getByRole("listitem"),
  ).toHaveCount(2);
  const reopened = await page.context().newPage();
  await page.close();
  await reopened.goto("/mensajero");
  await expect(
    reopened.getByRole("heading", { name: `Ruta ${String(route.number)}` }),
  ).toBeVisible();
  await openStop(reopened, "Calle 24 # 40-04");
  await expect(reopened.getByText("Novedad", { exact: true })).toBeVisible();
  await reopened.getByRole("link", { name: /Pendientes/ }).click();
  let lost = false;
  await reopened.route("**/api/courier/records", async (request) => {
    if (!lost) {
      expect((await request.fetch()).ok()).toBe(true);
      lost = true;
      await request.abort("failed");
    } else await request.continue();
  });
  await reopened.context().setOffline(false);
  await expect.poll(() => lost).toBe(true);
  await expect(
    reopened.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(4);
  await reopened.context().setOffline(true);
  await reopened.context().setOffline(false);
  await expect(reopened.getByText("No tienes registros pendientes")).toBeVisible();
  await expect(reopened.getByRole("list", { name: "Fotos pendientes" })).not.toBeVisible();
  const detail = (await (
    await office.request.get(`/api/shipments/${failed.id}`)
  ).json()) as ShipmentDetail;
  expect(detail.status).toBe("exception");
  expect(detail.custodyCourier?.id).toBe(account.courierId);
  expect(detail.records.filter((record) => record.kind === "exception")).toHaveLength(1);
  expect(detail.records.filter((record) => record.kind === "pickup")).toHaveLength(1);
  const delivery = (await (
    await office.request.get(`/api/shipments/${delivered.id}`)
  ).json()) as ShipmentDetail;
  expect(delivery.records.filter((record) => record.kind === "delivery")).toEqual([
    expect.objectContaining({ cashAmount: 85_000 }),
  ]);
  await office.goto("/");
  await showEveryShipment(office);
  await expect(
    office
      .getByRole("region", { name: /^Por resolver/ })
      .getByRole("listitem")
      .filter({ hasText: formatTrackingNumber(failed.trackingNumber) }),
  ).toContainText("Novedad por decidir");
  await expect(boardRow(office, delivered)).toContainText("Entregado");
  await office.goto(`/envios/${failed.trackingNumber}`);
  await expect(office.getByRole("img", { name: "Foto de la novedad" })).toBeVisible();
  expect(await accessibilityViolations(reopened)).toEqual([]);
  await reopened.close();
});
