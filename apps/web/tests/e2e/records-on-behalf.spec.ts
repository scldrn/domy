import type { ShipmentDetail } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { dispatch, ownSession } from "./courier";
import { expect, test, accessibilityViolations } from "./fixtures";

async function enter(page: Page, kind: string, values: Record<string, string> = {}) {
  await page.getByRole("button", { name: "Registrar por mensajero", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Registro" }).click();
  await page.getByRole("option", { name: kind, exact: true }).click();
  for (const [label, value] of Object.entries(values))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  expect(await accessibilityViolations(page)).toEqual([]);
  if (kind === "Entrega")
    await page.screenshot({ path: test.info().outputPath("record-entry.png") });
  await dialog.getByRole("button", { name: "Guardar registro", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function revertLatest(page: Page) {
  const records = page.getByRole("region", { name: "Registros del mensajero" });
  await records.getByRole("button", { name: "Revertir registro", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo", { exact: true }).fill("Se registró por equivocación");
  await dialog.getByRole("button", { name: "Confirmar reversión", exact: true }).click();
  return dialog;
}

/** T073 / quickstart 19: dispatch uses real forms; the courier cannot correct those facts. */
test("records, corrects and reverts a delivery on behalf, preserving the history", async ({
  dispatcherPage: office,
  courierPage: phone,
  ownerPage: owner,
}) => {
  await office.setViewportSize({ width: 390, height: 844 });
  const account = await ownSession(phone, owner);
  const shipment = await register(office);
  const filler = await register(office, { recipientAddress: "Calle 71 # 40-03" });
  const route = await dispatch(office, [shipment, filler], account.courierId);
  await office.goto("/envios/" + shipment.trackingNumber);
  await enter(office, "Recogida");
  await enter(office, "Entrega", { "Quién recibe": "Laura Gómez", Efectivo: "85000" });
  const records = office.getByRole("region", { name: "Registros del mensajero" });
  await expect(records.getByText("Registrado por despacho", { exact: true })).toHaveCount(2);
  await records.getByRole("button", { name: "Corregir registro", exact: true }).click();
  const correction = office.getByRole("dialog");
  await correction.getByLabel("Quién recibe", { exact: true }).fill("");
  await correction.getByLabel("Motivo", { exact: true }).fill("Verificado con el mensajero");
  await correction.getByRole("button", { name: "Guardar corrección", exact: true }).click();
  await expect(correction.getByRole("alert")).toContainText("Escribe el nombre de quien recibe");
  await correction.getByLabel("Quién recibe", { exact: true }).fill("Laura Gómez");
  await correction.getByLabel("Efectivo", { exact: true }).fill("80000");
  await correction.getByLabel("Transferencia a la empresa", { exact: true }).fill("5000");
  await correction.getByLabel("Motivo", { exact: true }).fill("Una parte llegó por transferencia");
  expect(await accessibilityViolations(office)).toEqual([]);
  await office.screenshot({ path: test.info().outputPath("record-correction-mobile.png") });
  await correction.getByRole("button", { name: "Guardar corrección", exact: true }).click();
  await expect(correction).not.toBeVisible();
  await expect(
    office.getByText("Una parte llegó por transferencia", { exact: true }),
  ).toBeVisible();
  await expect(await revertLatest(office)).not.toBeVisible();
  await expect(records.getByRole("term").filter({ hasText: /^Revertido$/ })).toBeVisible();
  await expect(office.getByRole("region", { name: "Historial", exact: true })).toContainText(
    "por reversión",
  );
  const detail = (await (
    await office.request.get(`/api/shipments/${shipment.id}`)
  ).json()) as ShipmentDetail;
  expect(detail).toMatchObject({
    status: "picked_up",
    custodyCourier: { id: account.courierId },
    attempts: [],
  });
  expect(detail.records.filter((record) => record.kind === "delivery")).toMatchObject([
    {
      cashAmount: 80000,
      companyTransferAmount: 5000,
      reverted: { reason: "Se registró por equivocación" },
    },
  ]);
  await office.goto(`/rutas/${route.id}`);
  const history = office.getByRole("region", { name: "Historial de la ruta" });
  await expect(history).toContainText("Registro revertido");
  await expect(history).toContainText("Se registró por equivocación");
  await phone.goto("/mensajero");
  await expect(phone.getByRole("region", { name: "Cambios de tu ruta" })).toContainText(
    "revirtió un registro",
  );
  await expect(phone.getByRole("button", { name: "Corregir registro" })).toHaveCount(0);
  await expect(phone.getByRole("button", { name: "Revertir registro" })).toHaveCount(0);
});

for (const finish of [false, true]) {
  test(`reverts an errand without custody, original route finished=${String(finish)}`, async ({
    dispatcherPage: office,
    courierPage: phone,
    ownerPage: owner,
  }) => {
    const account = await ownSession(phone, owner);
    const shipment = await register(office, {
      kind: "errand",
      errandDescription: "Radicar documentos",
      paymentMode: "merchant_account",
      codAmount: undefined,
      feeOverrideReason: "Tarifa acordada para diligencia",
    });
    const filler = finish ? [] : [await register(office)];
    const route = await dispatch(office, [shipment, ...filler], account.courierId);
    await office.goto("/envios/" + shipment.trackingNumber);
    await enter(office, "Entrega");
    await expect(await revertLatest(office)).not.toBeVisible();
    const detail = (await (
      await office.request.get(`/api/shipments/${shipment.id}`)
    ).json()) as ShipmentDetail;
    expect(detail).toMatchObject({
      status: finish ? "registered" : "dispatched",
      custodyCourier: null,
      heldAtOffice: false,
    });
    expect(detail.route?.id ?? null).toBe(finish ? null : route.id);
    if (!finish) {
      await enter(office, "Entrega");
      const completed = (await (
        await office.request.get(`/api/shipments/${shipment.id}`)
      ).json()) as ShipmentDetail;
      expect(completed.status).toBe("delivered");
      expect(
        completed.records.filter((record) => record.kind === "delivery" && !record.reverted),
      ).toHaveLength(1);
    }
  });
}

test("explains why a subsequent dispatch decision prevents reverting a package", async ({
  dispatcherPage: office,
  courierPage: phone,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const shipment = await register(office);
  const filler = await register(office);
  const route = await dispatch(office, [shipment, filler], account.courierId);
  await office.goto("/envios/" + shipment.trackingNumber);
  await enter(office, "Recogida");
  await enter(office, "Novedad", { Nota: "La dirección no es correcta" });
  expect(
    (
      await office.request.post(`/api/shipments/${shipment.id}/exception-decision`, {
        data: {
          actionId: crypto.randomUUID(),
          decision: "return",
          routeId: route.id,
        },
      })
    ).status(),
  ).toBe(200);
  await office.reload();
  const before = (await (
    await office.request.get(`/api/shipments/${shipment.id}`)
  ).json()) as ShipmentDetail;
  const dialog = await revertLatest(office);
  await expect(dialog.getByRole("alert")).toContainText("posterior");
  expect(
    (await (await office.request.get(`/api/shipments/${shipment.id}`)).json()) as ShipmentDetail,
  ).toEqual(before);
  expect(await accessibilityViolations(office)).toEqual([]);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
});
