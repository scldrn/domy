import { bulkColumns } from "@domy/domain";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type Column = (typeof bulkColumns)[number];

/** A tab-separated template row, as copied from a spreadsheet. */
function line(values: Partial<Record<Column, string>>): string {
  return bulkColumns.map((column) => values[column] ?? "").join("\t");
}

const delivery = (reference: string, values: Partial<Record<Column, string>> = {}) =>
  line({
    Destinatario: `Cliente ${reference}`,
    Teléfono: "300 555 0101",
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Franja: "antes de las 5pm",
    Referencia: reference,
    ...values,
  });

async function chooseMerchant(page: Page, name: string) {
  const field = page.getByRole("combobox", { name: "Cliente" });
  await field.click();
  await field.fill(name.slice(0, 4));
  await page
    .getByRole("option", { name: new RegExp(name) })
    .first()
    .click();
}

test("registers a pasted list, with fixes in the preview (scenario 10)", async ({
  dispatcherPage: page,
}) => {
  const run = String(Date.now()).slice(-6);
  const valid = Array.from({ length: 16 }, (_, i) => delivery(`M${run}-${String(i)}`));
  const text = [
    bulkColumns.join("\t"),
    ...valid,
    delivery(`M${run}-A`, { Barrio: "copàcabana" }),
    delivery(`M${run}-B`, { Barrio: "Copacavana" }),
    delivery(`M${run}-C`, { Teléfono: "300" }),
    delivery(`M${run}-D`, { Modalidad: "Efectivo" }),
  ].join("\n");

  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page.getByLabel("Filas", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Revisar lista" }).click();

  await expect(page.getByText("17 listas · 1 por confirmar · 2 con errores")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: `M${run}-A` })).toContainText("Copacabana");
  await expect(page.getByRole("row").filter({ hasText: `M${run}-C` })).toContainText("Teléfono");

  await page.getByRole("button", { name: "Confirmar Copacabana" }).click();
  await page.getByRole("button", { name: "Crear 18 envíos" }).click();
  await expect(page.getByText("18 envíos creados")).toBeVisible();

  // The two rows with errors stay for correction.
  await expect(page.getByLabel("Filas", { exact: true })).toHaveValue(/M\d+-C[\s\S]*M\d+-D/);
  await page
    .getByLabel("Filas", { exact: true })
    .fill(
      [
        delivery(`M${run}-C`, { Teléfono: "3005550101" }),
        delivery(`M${run}-D`, { Modalidad: "Contraentrega" }),
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("2 listas · 0 por confirmar · 0 con errores")).toBeVisible();
  await page.getByRole("button", { name: "Crear 2 envíos" }).click();
  await expect(page.getByText("2 envíos creados")).toBeVisible();
});

test("drops a review that answers after the list changed (scenario 10)", async ({
  dispatcherPage: page,
}) => {
  const run = String(Date.now()).slice(-6);
  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page
    .getByLabel("Filas", { exact: true })
    .fill(
      [
        bulkColumns.join("\t"),
        delivery(`S${run}-A`),
        delivery(`S${run}-B`),
        delivery(`S${run}-C`, { Teléfono: "300" }),
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("2 listas · 0 por confirmar · 1 con errores")).toBeVisible();

  // The automatic review of the row left over answers only after the dispatcher fixed it.
  let answerStaleReview = () => {};
  const staleReviewHeld = new Promise<void>((resolve) => {
    void page.route(
      "**/api/bulk/preview",
      async (route) => {
        const response = await route.fetch();
        resolve();
        await new Promise<void>((release) => (answerStaleReview = release));
        await route.fulfill({ response });
      },
      { times: 1 },
    );
  });
  await page.getByRole("button", { name: "Crear 2 envíos" }).click();
  await expect(page.getByText("2 envíos creados")).toBeVisible();
  await staleReviewHeld;
  await page
    .getByLabel("Filas", { exact: true })
    .fill(delivery(`S${run}-C`, { Teléfono: "3005550101" }));
  const staleAnswer = page.waitForResponse("**/api/bulk/preview");
  answerStaleReview();
  await staleAnswer;

  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("1 lista · 0 por confirmar · 0 con errores")).toBeVisible();
  await page.getByRole("button", { name: "Crear 1 envío" }).click();
  await expect(page.getByText("1 envío creado")).toBeVisible();
});

test("registers an uploaded spreadsheet", async ({ dispatcherPage: page }) => {
  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page
    .getByLabel("Subir archivo")
    .setInputFiles(new URL("files/envios-amy.xlsx", import.meta.url).pathname);
  await expect(page.getByText("3 listas · 0 por confirmar · 0 con errores")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "XL-1" })).toContainText("1 oct 2026");
  await page.getByRole("button", { name: "Crear 3 envíos" }).click();
  await expect(page.getByText("3 envíos creados")).toBeVisible();
});

test("explains a list with unknown columns", async ({ dispatcherPage: page }) => {
  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page.getByLabel("Filas", { exact: true }).fill("Tipo\tCliente\nEntrega\tAmy");
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText(/La columna «Cliente» no es de la plantilla/)).toBeVisible();
});
