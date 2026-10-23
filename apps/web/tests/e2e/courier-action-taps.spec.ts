import {
  courierRecordKinds,
  formatTrackingNumber,
  shipmentStatus,
  type Shipment,
} from "@domy/domain";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { register } from "./api";
import { dispatch, ownSession, workerControls } from "./courier";
import { expect, test } from "./fixtures";

const viewport = { width: 360, height: 800 };
const pickupAddress = "Calle 41 # 43-01";
const deliveryAddress = "Calle 42 # 43-02";
const exceptionAddress = "Calle 43 # 43-03";
const shipmentEffects = z.object({
  status: shipmentStatus,
  records: z.array(z.object({ kind: z.enum(courierRecordKinds) })),
});

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

async function readEffects(page: Page, shipmentId: string) {
  const response = await page.request.get(`/api/shipments/${shipmentId}`);
  expect(response.status()).toBe(200);
  return shipmentEffects.parse(await response.json());
}

for (const scheme of [
  { label: "standard", value: "light" as const, highContrast: false },
  { label: "high contrast", value: "high-contrast" as const, highContrast: true },
]) {
  test(`counts pickup, delivery, and exception taps in ${scheme.label}`, async ({
    courierPage: phone,
    dispatcherPage: office,
    ownerPage: owner,
  }) => {
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

    let pickupTaps = 0;
    await phone.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
    pickupTaps += 1;
    const pickup = taskCard(phone, packageForPickup);
    await expect(pickup.getByRole("button", { name: "Confirmar recogida" })).toBeVisible();
    await pickup.getByRole("button", { name: "Confirmar recogida" }).click();
    pickupTaps += 1;
    await expect(pickup).toContainText("Recogido");

    await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
    let deliveryTaps = 0;
    await openStop(phone, deliveryAddress);
    deliveryTaps += 1;
    const delivery = taskCard(phone, packageForDelivery);
    await delivery.getByRole("button", { name: "Registrar entrega" }).click();
    deliveryTaps += 1;
    const deliverySheet = phone.getByRole("dialog");
    await expect(deliverySheet).toContainText("Laura Gómez");
    await expect(deliverySheet).toContainText("Entregado");
    await expect(
      deliverySheet.getByText("Valor a recaudar").locator("..").getByRole("definition"),
    ).toHaveText("$ 0");
    await expect(
      deliverySheet.getByText("Total cobrado").locator("..").getByRole("definition"),
    ).toHaveText("$ 0");
    await expect(deliverySheet.getByRole("button", { name: "Tomar foto" })).toBeVisible();
    const beforeDeliveryConfirmation = await readEffects(office, packageForDelivery.id);
    expect(beforeDeliveryConfirmation.status).toBe("picked_up");
    expect(
      beforeDeliveryConfirmation.records.filter(({ kind }) => kind === "delivery"),
    ).toHaveLength(0);
    await deliverySheet.getByRole("button", { name: "Guardar entrega" }).click();
    deliveryTaps += 1;
    await expect(delivery).toContainText("Entregado");
    await expect
      .poll(async () => (await readEffects(office, packageForDelivery.id)).status)
      .toBe("delivered");
    const afterDeliveryConfirmation = await readEffects(office, packageForDelivery.id);
    expect(afterDeliveryConfirmation.status).toBe("delivered");
    expect(
      afterDeliveryConfirmation.records.filter(({ kind }) => kind === "delivery"),
    ).toHaveLength(1);

    await phone.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
    let exceptionTaps = 0;
    await openStop(phone, exceptionAddress);
    exceptionTaps += 1;
    const exception = taskCard(phone, packageForException);
    await exception.getByRole("button", { name: "Destinatario ausente", exact: true }).click();
    exceptionTaps += 1;
    const exceptionSheet = phone.getByRole("dialog");
    await expect(exceptionSheet).toContainText("Destinatario ausente");
    await expect(exceptionSheet).toContainText("Laura Gómez");
    const beforeExceptionConfirmation = await readEffects(office, packageForException.id);
    expect(beforeExceptionConfirmation.status).toBe("picked_up");
    expect(
      beforeExceptionConfirmation.records.filter(({ kind }) => kind === "exception"),
    ).toHaveLength(0);
    await exceptionSheet.getByRole("button", { name: "Guardar novedad" }).click();
    exceptionTaps += 1;
    await expect(exception).toContainText("Novedad");
    await expect
      .poll(async () => (await readEffects(office, packageForException.id)).status)
      .toBe("exception");
    const afterExceptionConfirmation = await readEffects(office, packageForException.id);
    expect(afterExceptionConfirmation.status).toBe("exception");
    expect(
      afterExceptionConfirmation.records.filter(({ kind }) => kind === "exception"),
    ).toHaveLength(1);

    expect({ pickupTaps, deliveryTaps, exceptionTaps }).toEqual({
      pickupTaps: 2,
      deliveryTaps: 3,
      exceptionTaps: 3,
    });
  });
}
