import { courierSnapshot, type CourierRecord, type ShipmentDetail } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { dispatch, openStop, ownSession, workerControls } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";

const metric = (page: Page, label: string) =>
  page
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .getByRole("definition");

async function captureMoney(page: Page, name: string) {
  const last = metric(page, "Pagos por cuenta del cliente");
  // T129: viewport intersection alone does not account for the fixed navigation overlay.
  await last.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await expect(last).toBeInViewport();
  const amount = await last.boundingBox();
  const navigation = await page
    .getByRole("navigation", { name: "Navegación principal", exact: true })
    .boundingBox();
  if (!amount || !navigation) throw new Error("Missing summary or navigation bounds");
  expect(amount.y + amount.height).toBeLessThanOrEqual(navigation.y);
  await page.screenshot({ path: test.info().outputPath(name) });
}

/** T078 / US7 AC1–AC3, quickstart 20: real server baseline plus persisted offline records. */
test("shows my day offline, survives reopening, syncs once and reflects dispatch corrections", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const cash = await register(office, { codAmount: 100_000 });
  const company = await register(office, {
    codAmount: 50_000,
    recipientAddress: "Calle 20 # 40-01",
  });
  const merchant = await register(office, {
    codAmount: 30_000,
    recipientAddress: "Calle 21 # 40-01",
  });
  await dispatch(office, [cash, company, merchant], account.courierId);
  for (const shipment of [cash, company, merchant]) {
    expect(
      (
        await office.request.post(`/api/shipments/${shipment.id}/records`, {
          data: { id: crypto.randomUUID(), kind: "pickup" },
        })
      ).ok(),
    ).toBe(true);
  }
  expect(
    (
      await office.request.post(`/api/shipments/${cash.id}/records`, {
        data: {
          id: crypto.randomUUID(),
          kind: "delivery",
          receivedByName: "Laura Gómez",
          cashAmount: 100_000,
        },
      })
    ).ok(),
  ).toBe(true);
  await phone.goto("/mensajero");
  await expect(phone.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(phone);
  await phone.getByRole("link", { name: "Mi día", exact: true }).click();
  await expect(metric(phone, "Efectivo")).toHaveText("$ 100.000");
  await phone.context().setOffline(true);
  for (const [shipment, method, amount] of [
    [company, "Transferencia a la empresa", "50000"],
    [merchant, "Transferencia al cliente", "30000"],
  ] as const) {
    await openStop(phone, shipment.recipientAddress ?? "");
    await phone.getByRole("button", { name: "Registrar entrega", exact: true }).click();
    const dialog = phone.getByRole("dialog");
    await dialog.getByLabel("Efectivo", { exact: true }).fill("0");
    await dialog.getByLabel(method, { exact: true }).fill(amount);
    await dialog.getByRole("button", { name: "Revisar", exact: true }).click();
    await dialog.getByRole("button", { name: "Guardar entrega", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  const registerPaymentButton = phone.getByRole("button", {
    name: "Registrar pago por cuenta del cliente",
    exact: true,
  });
  await registerPaymentButton.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await registerPaymentButton.click();
  const payment = phone.getByRole("dialog");
  await payment.getByLabel("Valor pagado", { exact: true }).fill("12000");
  await payment.getByLabel("A quién se pagó", { exact: true }).fill("Transportadora");
  await payment.getByRole("button", { name: "Guardar pago", exact: true }).click();
  await expect(payment).not.toBeVisible();
  await phone.getByRole("link", { name: "Mi día", exact: true }).click();
  const assertTotals = async () => {
    for (const [label, value] of Object.entries({
      Entregas: "3",
      Novedades: "0",
      Devoluciones: "0",
      "Paradas pendientes": "0",
      Efectivo: "$ 100.000",
      "Transferencia a la empresa": "$ 50.000",
      "Transferencia al cliente": "$ 30.000",
      "Pagos por cuenta del cliente": "$ 12.000",
      "Efectivo por entregar": "$ 88.000",
    }))
      await expect(metric(phone, label)).toHaveText(value);
  };
  await assertTotals();
  await expect(phone.getByText(/Estimado/)).toBeVisible();
  await phone.reload();
  await assertTotals();
  expect(await accessibilityViolations(phone)).toEqual([]);
  await phone.screenshot({ path: test.info().outputPath("my-day-offline.png"), fullPage: true });
  await captureMoney(phone, "my-day-offline-money.png");
  await phone.context().setOffline(false);
  await expect
    .poll(async () => {
      const result = await phone.request.get("/api/courier/route");
      return courierSnapshot.parse(await result.json()).summary;
    })
    .toMatchObject({
      deliveries: 3,
      cash: 100_000,
      companyTransfer: 50_000,
      merchantTransfer: 30_000,
      disbursements: 12_000,
      cashToHandOver: 88_000,
    });
  await assertTotals();
  const detail = (await (
    await office.request.get(`/api/shipments/${company.id}`)
  ).json()) as ShipmentDetail;
  const deliveries = detail.records.filter((record) => record.kind === "delivery");
  expect(deliveries).toHaveLength(1);
  const [delivery] = deliveries;
  if (!delivery) throw new Error("Missing synchronized delivery");
  const corrected = await office.request.post(`/api/courier-records/${delivery.id}/correct`, {
    data: {
      actionId: crypto.randomUUID(),
      reason: "Una parte se pagó en efectivo",
      cashAmount: 10_000,
      companyTransferAmount: 40_000,
    },
  });
  expect(corrected.status()).toBe(200);
  expect((await corrected.json()) as CourierRecord).toMatchObject({ cashAmount: 10_000 });
  await phone.reload();
  await expect(metric(phone, "Efectivo")).toHaveText("$ 110.000");
  await expect(metric(phone, "Transferencia a la empresa")).toHaveText("$ 40.000");
  await expect(metric(phone, "Efectivo por entregar")).toHaveText("$ 98.000");
  await expect(phone.getByText("No tienes una ruta despachada", { exact: true })).toHaveCount(0);
});

test("shows a dated zero estimate without a route, in standard and high contrast", async ({
  courierPage: phone,
  ownerPage: owner,
}) => {
  await ownSession(phone, owner);
  await phone.setViewportSize({ width: 360, height: 800 });
  await phone.goto("/mensajero/mi-dia");
  await expect(metric(phone, "Efectivo por entregar")).toHaveText("$ 0");
  await expect(metric(phone, "Entregas")).toHaveText("0");
  await expect(phone.getByText("1 oct 2026", { exact: true })).toBeVisible();
  expect(await accessibilityViolations(phone)).toEqual([]);
  await phone.getByRole("button", { name: /contraste/i }).click();
  expect(await accessibilityViolations(phone)).toEqual([]);
  expect(
    await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await phone.screenshot({
    path: test.info().outputPath("my-day-high-contrast.png"),
    fullPage: true,
  });
  await captureMoney(phone, "my-day-high-contrast-money.png");
});
