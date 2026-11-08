import {
  exceptionReasonLabels,
  exceptionReasons,
  formatTrackingNumber,
  type Shipment,
} from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { dispatch, ownSession, workerControls } from "./courier";
import { assertCourierScreen, expect, test } from "./fixtures";

const viewport = { width: 360, height: 800 };
const pickupAddress = "Calle 41 # 43-01";
const deliveryAddress = "Calle 42 # 43-02";
const exceptionAddress = "Calle 43 # 43-03";

const taskCard = (page: Page, shipment: Shipment) =>
  page
    .getByRole("list", { name: "Envíos de la parada" })
    .getByRole("listitem")
    .filter({
      has: page.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
    });

async function seedPickup(page: Page, shipment: Shipment) {
  const response = await page.request.post(`/api/shipments/${shipment.id}/records`, {
    data: { id: crypto.randomUUID(), kind: "pickup" },
  });
  expect(response.ok()).toBe(true);
}

async function openStop(page: Page, address: string) {
  const stop = page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: address });
  await expect(stop).toHaveCount(1);
  await stop.click();
}

for (const scheme of [
  { label: "standard", value: "light" as const, highContrast: false, dark: false },
  // The app follows the phone's dark preference (feature 006, FR-015a).
  { label: "dark", value: "dark" as const, highContrast: false, dark: true },
  { label: "high contrast", value: "high-contrast" as const, highContrast: true, dark: false },
]) {
  test(`checks 360 px courier action paths, targets, and axe in ${scheme.label}`, async ({
    courierPage: phone,
    dispatcherPage: office,
    ownerPage: owner,
  }) => {
    // Six full scans of every control: about 24 s here and over 30 s on the CI runner (T139).
    test.slow();
    const account = await ownSession(phone, owner);
    const packageForPickup = await register(office, {
      paymentMode: "merchant_account",
      codAmount: 0,
      recipientAddress: pickupAddress,
    });
    const packageForDelivery = await register(office, {
      paymentMode: "merchant_account",
      codAmount: 0,
      recipientAddress: deliveryAddress,
    });
    const packageForException = await register(office, {
      paymentMode: "merchant_account",
      codAmount: 0,
      recipientAddress: exceptionAddress,
    });
    const route = await dispatch(
      office,
      [packageForPickup, packageForDelivery, packageForException],
      account.courierId,
    );
    await seedPickup(office, packageForDelivery);
    await seedPickup(office, packageForException);

    await phone.setViewportSize(viewport);
    await phone.emulateMedia({ colorScheme: scheme.dark ? "dark" : "light" });
    await phone.goto("/mensajero");
    await expect(
      phone.getByRole("heading", { name: `Ruta ${String(route.number)}` }),
    ).toBeVisible();
    await workerControls(phone);
    if (scheme.highContrast) {
      const contrast = phone.getByRole("button", { name: "Alto contraste" });
      await contrast.click();
      await expect(contrast).toHaveAttribute("aria-pressed", "true");
    } else {
      await expect(phone.getByRole("button", { name: "Alto contraste" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    await phone.screenshot({ path: test.info().outputPath(`courier-${scheme.label}-mi-ruta.png`) });
    await assertCourierScreen(phone, scheme.value);

    let pickupTaps = 0;
    await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
    pickupTaps += 1;
    await assertCourierScreen(phone, scheme.value);
    const pickup = taskCard(phone, packageForPickup);
    await expect(pickup.getByRole("button", { name: "Confirmar recogida" })).toBeVisible();
    await pickup.getByRole("button", { name: "Confirmar recogida" }).click();
    pickupTaps += 1;
    await expect(pickup).toContainText("Recogido");
    await assertCourierScreen(phone, scheme.value);

    await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
    let deliveryTaps = 0;
    await openStop(phone, deliveryAddress);
    deliveryTaps += 1;
    await assertCourierScreen(phone, scheme.value);
    const delivery = taskCard(phone, packageForDelivery);
    await delivery.getByRole("button", { name: "Registrar entrega" }).click();
    deliveryTaps += 1;
    const deliverySheet = phone.getByRole("dialog");
    await expect(deliverySheet).toContainText("Laura Gómez");
    await expect(deliverySheet).toContainText("Entregado");
    await expect(deliverySheet.getByRole("button", { name: "Tomar foto" })).toBeVisible();
    await assertCourierScreen(phone, scheme.value);
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-entrega-revision.png`),
    });
    await assertCourierScreen(phone, scheme.value);
    await deliverySheet.getByRole("button", { name: "Guardar entrega" }).click();
    deliveryTaps += 1;
    await expect(delivery).toContainText("Entregado");
    await assertCourierScreen(phone, scheme.value);

    await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
    let exceptionTaps = 0;
    await openStop(phone, exceptionAddress);
    exceptionTaps += 1;
    await assertCourierScreen(phone, scheme.value);
    const exception = taskCard(phone, packageForException);
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-motivos-novedad.png`),
    });
    await exception.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
    exceptionTaps += 1;
    const exceptionSheet = phone.getByRole("dialog");
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-novedad-revision.png`),
    });
    await assertCourierScreen(phone, scheme.value);
    await expect(exceptionSheet).toContainText("Destinatario ausente");
    await expect(exceptionSheet).toContainText("Laura Gómez");
    await assertCourierScreen(phone, scheme.value);
    await exceptionSheet.getByRole("button", { name: "Guardar novedad" }).click();
    exceptionTaps += 1;
    await expect(exception).toContainText("Novedad");
    await assertCourierScreen(phone, scheme.value);

    await phone.getByRole("link", { name: "Mi día", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "Mi día", exact: true })).toBeVisible();
    await expect(phone.getByText("Efectivo por entregar", { exact: true })).toBeVisible();
    await assertCourierScreen(phone, scheme.value);
    await phone.screenshot({ path: test.info().outputPath(`courier-${scheme.label}-mi-dia.png`) });
    await phone.getByRole("link", { name: /^Pendientes/ }).click();
    await expect(phone.getByRole("heading", { name: "Pendientes", exact: true })).toBeVisible();
    await expect(phone.getByRole("button", { name: "Reintentar sincronización" })).toBeVisible();
    await assertCourierScreen(phone, scheme.value);
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-pendientes.png`),
    });

    expect({ pickupTaps, deliveryTaps, exceptionTaps }).toEqual({
      pickupTaps: 2,
      deliveryTaps: 3,
      exceptionTaps: 3,
    });
  });
}

for (const scheme of [
  { label: "standard", value: "light" as const, highContrast: false },
  { label: "high contrast", value: "high-contrast" as const, highContrast: true },
]) {
  test(`checks offline Pending and My Day surfaces at 360 px in ${scheme.label}`, async ({
    courierPage: phone,
    dispatcherPage: office,
    ownerPage: owner,
  }) => {
    const account = await ownSession(phone, owner);
    const shipment = await register(office, {
      codAmount: 85_000,
      recipientAddress: "Calle 44 # 43-04",
    });
    const route = await dispatch(office, shipment, account.courierId);

    await phone.setViewportSize(viewport);
    await phone.goto("/mensajero");
    await expect(
      phone.getByRole("heading", { name: `Ruta ${String(route.number)}` }),
    ).toBeVisible();
    await workerControls(phone);
    if (scheme.highContrast) {
      const contrast = phone.getByRole("button", { name: "Alto contraste" });
      await contrast.click();
      await expect(contrast).toHaveAttribute("aria-pressed", "true");
    } else {
      await expect(phone.getByRole("button", { name: "Alto contraste" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    await phone.context().setOffline(true);
    await openStop(phone, shipment.recipientAddress ?? "");
    const task = taskCard(phone, shipment);
    await task.getByRole("button", { name: "Confirmar recogida" }).click();
    await expect(task).toContainText("Recogido");

    await phone.getByRole("link", { name: /^Pendientes/ }).click();
    await expect(phone.getByRole("heading", { name: "Pendientes", exact: true })).toBeVisible();
    const pending = phone.getByRole("list", { name: "Registros pendientes" });
    await expect(pending.getByRole("listitem")).toHaveCount(1);
    await expect(pending).toContainText("Recogida");
    await expect(pending).toContainText(formatTrackingNumber(shipment.trackingNumber));
    await expect(phone.getByRole("status")).toContainText("1 pendiente por sincronizar");
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-pendientes-offline.png`),
      fullPage: true,
    });
    await assertCourierScreen(phone, scheme.value);

    await phone.getByRole("link", { name: "Mi día", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "Mi día", exact: true })).toBeVisible();
    await expect(phone.getByText(/pueden cambiar al sincronizar/)).toBeVisible();
    await expect(
      phone
        .getByRole("term")
        .filter({ hasText: /^Paradas pendientes$/ })
        .locator(".."),
    ).toContainText("1");
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-mi-dia-offline-pending.png`),
      fullPage: true,
    });
    await assertCourierScreen(phone, scheme.value);
  });
}

for (const scheme of [
  { label: "standard", value: "light" as const, highContrast: false },
  { label: "high contrast", value: "high-contrast" as const, highContrast: true },
]) {
  test(`checks correction controls for delivery and exception at 360 px in ${scheme.label}`, async ({
    courierPage: phone,
    dispatcherPage: office,
    ownerPage: owner,
  }) => {
    const account = await ownSession(phone, owner);
    const shipment = await register(office, {
      codAmount: 85_000,
      recipientAddress: "Calle 45 # 43-05",
    });
    const route = await dispatch(office, shipment, account.courierId);
    await seedPickup(office, shipment);

    await phone.setViewportSize(viewport);
    await phone.goto("/mensajero");
    await expect(
      phone.getByRole("heading", { name: `Ruta ${String(route.number)}` }),
    ).toBeVisible();
    await workerControls(phone);
    if (scheme.highContrast) {
      const contrast = phone.getByRole("button", { name: "Alto contraste" });
      await contrast.click();
      await expect(contrast).toHaveAttribute("aria-pressed", "true");
    } else {
      await expect(phone.getByRole("button", { name: "Alto contraste" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    await openStop(phone, shipment.recipientAddress ?? "");
    const delivery = taskCard(phone, shipment);
    await delivery.getByRole("button", { name: "Registrar entrega" }).click();
    const deliverySheet = phone.getByRole("dialog");
    await expect(deliverySheet).toContainText("Laura Gómez");
    await deliverySheet.getByRole("button", { name: "Corregir" }).click();
    const receivedBy = deliverySheet.getByLabel("Quién recibe", { exact: true });
    await expect(receivedBy).toHaveValue("Laura Gómez");
    await receivedBy.fill("Carlos Ríos");
    await expect(deliverySheet.getByLabel("Efectivo", { exact: true })).toBeVisible();
    await expect(
      deliverySheet.getByLabel("Transferencia a la empresa", { exact: true }),
    ).toBeVisible();
    await expect(
      deliverySheet.getByLabel("Transferencia al cliente", { exact: true }),
    ).toBeVisible();
    await expect(deliverySheet.getByRole("button", { name: "Tomar foto" })).toBeVisible();
    await expect(deliverySheet.getByRole("button", { name: "Revisar" })).toBeVisible();
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-entrega-correccion.png`),
    });
    await assertCourierScreen(phone, scheme.value);
    await deliverySheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(deliverySheet).not.toBeVisible();

    const exception = taskCard(phone, shipment);
    await exception.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
    const exceptionSheet = phone.getByRole("dialog");
    await expect(exceptionSheet).toContainText("Destinatario ausente");
    await exceptionSheet.getByRole("button", { name: "Corregir" }).click();
    const radios = exceptionSheet.getByRole("radio");
    await expect(radios).toHaveCount(exceptionReasons.length);
    for (const reason of exceptionReasons)
      await expect(
        exceptionSheet.getByRole("radio", { name: exceptionReasonLabels[reason], exact: true }),
      ).toBeVisible();
    await expect(
      exceptionSheet.getByRole("radio", { name: "Destinatario ausente", exact: true }),
    ).toBeChecked();
    await exceptionSheet.getByRole("radio", { name: "Rechazado", exact: true }).check();
    const note = exceptionSheet.getByLabel("Nota (opcional)", { exact: true });
    await note.fill("Nota sintética para revisar accesibilidad");
    await expect(exceptionSheet.getByRole("button", { name: "Tomar foto" })).toBeVisible();
    await expect(exceptionSheet.getByRole("button", { name: "Revisar" })).toBeVisible();
    await phone.screenshot({
      path: test.info().outputPath(`courier-${scheme.label}-novedad-correccion.png`),
    });
    await assertCourierScreen(phone, scheme.value);
    await exceptionSheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(exceptionSheet).not.toBeVisible();
  });
}
