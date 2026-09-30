import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Types in a search field and picks the first option containing `option`. */
async function pick(page: Page, label: string, query: string, option: string) {
  const field = page.getByRole("combobox", { name: label });
  await field.click();
  await field.fill(query);
  await page
    .getByRole("option", { name: new RegExp(option, "i") })
    .first()
    .click();
}

async function chooseSelect(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

async function fillDelivery(page: Page, merchant: string, neighborhood: string) {
  await pick(page, "Cliente", merchant.slice(0, 5), merchant);
  await page.getByLabel("Nombre del destinatario").fill("Laura Gómez");
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByLabel("Dirección de entrega").fill("Calle 10 # 43-12");
  await pick(page, "Barrio", neighborhood, neighborhood);
}

async function registerAndOpen(page: Page) {
  await page.getByRole("button", { name: "Registrar envío" }).click();
  const toast = page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Ver envío" }).click();
  await expect(page).toHaveURL(/\/envios\/[0-9A-Z]{8}$/);
}

test.beforeEach(async ({ dispatcherPage }) => {
  await dispatcherPage.goto("/envios/nuevo");
  await dispatcherPage.evaluate(() => {
    sessionStorage.clear();
  });
  await dispatcherPage.reload();
});

test("registers a delivery on merchant account at the standard fee (scenario 1)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page
    .getByRole("radio", { name: "Crédito del cliente" })
    .or(page.getByRole("button", { name: "Crédito del cliente" }))
    .click();
  await expect(page.getByText("$ 13.000")).toBeVisible();
  await registerAndOpen(page);
  await expect(page.getByText("Registrado", { exact: true })).toBeVisible();
  await expect(page.getByText("Creado", { exact: true })).toBeVisible();
  await expect(page.getByText("$ 13.000")).toBeVisible();
});

test("uses the merchant rate card (scenario 2)", async ({ dispatcherPage: page }) => {
  await fillDelivery(page, "Amy Tecnology", "Itagüí");
  await expect(page.getByText("$ 10.700")).toBeVisible();
});

test("derives the COD amount from the payment mode (scenario 3)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(
    page.getByText("En contraentrega el valor a recaudar debe ser mayor que cero."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Flete al destinatario" }).click();
  await expect(page.getByText("Valor a recaudar: $ 13.000")).toBeVisible();
});

test("requires a manual fee with a reason for an errand (scenario 4)", async ({
  dispatcherPage: page,
}) => {
  await page.getByRole("button", { name: "Diligencia" }).click();
  await pick(page, "Cliente", "Bulli", "Bullish Hype");
  await page.getByLabel("Descripción de la diligencia").fill("Consignar en Bancolombia");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await page.getByRole("textbox", { name: "Tarifa", exact: true }).fill("20000");
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(
    page
      .getByText("Escribe un motivo de al menos 5 caracteres.")
      .or(page.getByText("Escribe el motivo de la tarifa manual.")),
  ).toBeVisible();
  await page.getByLabel(/Motivo de la tarifa/).fill("Consignación y regreso");
  await registerAndOpen(page);
  await expect(page.getByText("Tarifa por revisar")).toHaveCount(0);
});

test("adds the express surcharge and prices a carrier handoff by its place (scenario 15)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page.getByRole("button", { name: "Exprés" }).click();
  await expect(page.getByText("$ 17.500")).toBeVisible();

  await page.getByRole("button", { name: "Entrega a transportadora" }).click();
  await page.getByRole("button", { name: "Estándar" }).click();
  await pick(page, "Punto de entrega a transportadora", "terminal norte", "Terminal del Norte");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await expect(page.getByText("$ 15.000")).toBeVisible();
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(page.getByText("Elige la transportadora.")).toBeVisible();
  await expect(page.getByText("Escribe el municipio de destino.")).toBeVisible();
  await chooseSelect(page, "Transportadora", "Coonorte");
  await page.getByLabel("Municipio de destino").fill("Santa Rosa de Osos");
  await registerAndOpen(page);
  await expect(page.getByText("Coonorte")).toBeVisible();
});

test("keeps the values after a failed save and registers once on retry (FR-038)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(page.getByText(/No hay conexión con el servidor/)).toBeVisible();
  await expect(page.getByLabel("Nombre del destinatario")).toHaveValue("Laura Gómez");
  await page.context().setOffline(false);
  await registerAndOpen(page);
});

test("registers a shipment with the keyboard only", async ({ dispatcherPage: page }) => {
  await expect(page.getByRole("combobox", { name: "Cliente" })).toBeFocused();
  await page.keyboard.type("bullish");
  await expect(page.getByRole("option", { name: /Bullish Hype/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByLabel("Nombre del destinatario").focus();
  await page.keyboard.type("Laura Gómez");
  await page.keyboard.press("Tab");
  await page.keyboard.type("3001234567");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Calle 10 # 43-12");
  await page.keyboard.press("Tab");
  await page.keyboard.type("laureles");
  await expect(page.getByRole("option", { name: /Laureles/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Crédito del cliente" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Registrar envío" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/)).toBeVisible();
});
