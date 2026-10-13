import { formatTrackingNumber } from "@domy/domain";
import { register } from "./api";
import { expect, test } from "./fixtures";

test("edits the COD amount and voids another shipment, both in the history (scenario 8)", async ({
  dispatcherPage: page,
}) => {
  const edited = await register(page);
  await page.goto(`/envios/${edited.trackingNumber}`);
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Editar envío ${formatTrackingNumber(edited.trackingNumber)}`,
    }),
  ).toBeVisible();
  await page.getByLabel("Valor a recaudar").fill("90.000");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(new RegExp(`/envios/${edited.trackingNumber}$`));
  const history = page.getByRole("region", { name: "Historial de cambios" });
  await expect(history).toContainText("Editado");
  await expect(history).toContainText("Valor a recaudar: $ 85.000 → $ 90.000");
  await expect(history).toContainText("John Coordinador");

  const voided = await register(page);
  await page.goto(`/envios/${voided.trackingNumber}`);
  await page.getByRole("button", { name: "Anular envío" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Motivo de la anulación").fill("El cliente canceló el pedido");
  await dialog.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByText("Anulado", { exact: true }).first()).toBeVisible();
  await expect(history).toContainText("El cliente canceló el pedido");
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
});

test("refuses the second of two concurrent saves and keeps its values (scenario 9)", async ({
  dispatcherPage: first,
}) => {
  const shipment = await register(first);
  const second = await first.context().newPage();
  // Both pages must show the first version before either saves: `goto` returns before the
  // shipment arrives, and a page that loads it late would see the second version instead.
  for (const page of [first, second]) {
    await page.goto(`/envios/${shipment.trackingNumber}/editar`);
    await expect(page.getByLabel("Dirección de entrega")).toHaveValue("Calle 10 # 43-12");
  }

  await first.getByLabel("Dirección de entrega").fill("Calle 11 # 40-10");
  await first.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(first).toHaveURL(new RegExp(`/envios/${shipment.trackingNumber}$`));

  await second.getByLabel("Dirección de entrega").fill("Calle 12 # 40-10");
  await second.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(second.getByText("Este envío cambió; revisa la versión más reciente")).toBeVisible();
  await expect(second.getByLabel("Dirección de entrega")).toHaveValue("Calle 12 # 40-10");
});

test("lets the owner confirm a fee marked for review (FR-035)", async ({
  dispatcherPage,
  ownerPage,
}) => {
  const shipment = await register(
    dispatcherPage,
    { fee: 35000, feeOverrideReason: "Tarifa de Girardota sin definir" },
    "Girardota",
  );
  await dispatcherPage.goto(`/envios/${shipment.trackingNumber}`);
  await expect(dispatcherPage.getByText("Tarifa por revisar")).toBeVisible();
  await expect(dispatcherPage.getByRole("button", { name: "Confirmar tarifa" })).toHaveCount(0);

  await ownerPage.goto(`/envios/${shipment.trackingNumber}`);
  await ownerPage.getByRole("button", { name: "Confirmar tarifa" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByLabel("Tarifa").fill("30.000");
  await dialog.getByRole("button", { name: "Guardar tarifa" }).click();
  await expect(ownerPage.getByText("Tarifa por revisar", { exact: true })).toHaveCount(0);
  const history = ownerPage.getByRole("region", { name: "Historial de cambios" });
  await expect(history).toContainText("Tarifa confirmada");
  await expect(history).toContainText("Tarifa: $ 35.000 → $ 30.000");
});
