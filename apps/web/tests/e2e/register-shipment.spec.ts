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

/** The fee as the form shows it; the summary beside the form repeats it (feature 006). */
const payment = (page: Page) => page.getByRole("group", { name: "Pago y tarifa" });

async function registerAndOpen(page: Page) {
  const pendingRetry = page.getByRole("button", { name: "Reintentar solicitud pendiente" });
  if ((await pendingRetry.count()) > 0) await pendingRetry.click();
  else await page.getByRole("button", { name: "Registrar envío" }).click();
  const toast = page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Ver envío" }).click();
  await expect(page).toHaveURL(/\/envios\/[0-9A-Z]{8}$/);
}

test.beforeEach(async ({ dispatcherPage: page }) => {
  // Start without a saved draft. Each load waits for its heading: in WebKit the router's own
  // start-up counts as a navigation and would interrupt the next one.
  await page.goto("/envios/nuevo");
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo envío" })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo envío" })).toBeVisible();
});

test("registers a delivery on merchant account at the standard fee (scenario 1)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page
    .getByRole("radio", { name: "Crédito del cliente" })
    .or(page.getByRole("button", { name: "Crédito del cliente" }))
    .click();
  await expect(payment(page).getByText("$ 13.000")).toBeVisible();
  await registerAndOpen(page);
  // The state mark and the first step of «Recorrido».
  await expect(page.getByText("Registrado", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Creado", { exact: true })).toBeVisible();
  await expect(page.getByText("$ 13.000")).toBeVisible();
});

test("uses the merchant rate card (scenario 2)", async ({ dispatcherPage: page }) => {
  await fillDelivery(page, "Amy Tecnology", "Itagüí");
  await expect(payment(page).getByText("$ 10.700")).toBeVisible();
});

test("derives the COD amount from the payment mode (scenario 3)", async ({
  dispatcherPage: page,
}) => {
  await fillDelivery(page, "Bullish Hype", "Laureles");
  // The fee arrives from the rate card; without it the form reports the fee first.
  await expect(payment(page).getByText("$ 13.000")).toBeVisible();
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(
    page.getByText("En contraentrega el valor a recaudar debe ser mayor que cero."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Flete al destinatario" }).click();
  await expect(page.getByText("Valor a recaudar: $ 13.000")).toBeVisible();
  // The summary says what the courier collects, which the payment mode decides (feature 006).
  const summary = page.getByRole("region", { name: "Resumen" });
  await expect(summary).toContainText("El mensajero cobra$ 13.000");
  await expect(summary).toContainText("Bullish Hype");
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
  await expect(payment(page).getByText("$ 17.500")).toBeVisible();

  await page.getByRole("button", { name: "Entrega a transportadora" }).click();
  await page.getByRole("button", { name: "Estándar" }).click();
  await pick(page, "Punto de entrega a transportadora", "terminal norte", "Terminal del Norte");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await expect(payment(page).getByText("$ 15.000")).toBeVisible();
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(page.getByText("Elige la transportadora.")).toBeVisible();
  await expect(page.getByText("Escribe el municipio de destino.")).toBeVisible();
  await chooseSelect(page, "Transportadora", "Coonorte");
  await page.getByLabel("Municipio de destino").fill("Santa Rosa de Osos");
  await registerAndOpen(page);
  await expect(page.getByRole("region", { name: "Destino" }).getByText("Coonorte")).toBeVisible();
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
  await expect(page.getByLabel("Nombre del destinatario")).toBeDisabled();
  await page.context().setOffline(false);
  await registerAndOpen(page);
});

test("registers once the fields a first try marked are fixed (FR-038)", async ({
  dispatcherPage: page,
}) => {
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(page.getByText("Elige un cliente.")).toBeVisible();
  await fillDelivery(page, "Bullish Hype", "Laureles");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await registerAndOpen(page);
});

for (const delayedResponse of [
  "none",
  "initial merchant response",
  "merchant search",
  "fee quote",
] as const) {
  test(`registers a shipment with the keyboard only${delayedResponse === "none" ? "" : ` while the ${delayedResponse} is delayed`}`, async ({
    dispatcherPage: page,
  }) => {
    let releaseResponse = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let responseRequested = false;
    if (delayedResponse !== "none") {
      const pattern =
        delayedResponse === "fee quote"
          ? "**/api/shipments/fee-quote"
          : delayedResponse === "initial merchant response"
            ? "**/api/merchants?**"
            : "**/api/merchants?q=bullish&active=true";
      await page.route(pattern, async (route) => {
        if (
          delayedResponse !== "initial merchant response" ||
          new URL(route.request().url()).searchParams.get("q") === "bullish"
        ) {
          responseRequested = true;
        }
        await responseGate;
        await route.continue();
      });
    }
    try {
      let retainedFirstUnfilteredOptionId: string | undefined;
      if (delayedResponse === "initial merchant response") {
        // Start a fresh query cache with every real merchant response held while typing.
        await page.reload();
        await expect(page.getByRole("heading", { name: "Nuevo envío", exact: true })).toBeVisible();
      }
      const merchantCombobox = page.getByRole("combobox", { name: "Cliente" });
      await expect(merchantCombobox).toBeFocused();
      if (delayedResponse === "merchant search") {
        // Prime real unfiltered results: wait until options are loaded before keyboard navigation.
        await expect(merchantCombobox).toHaveAttribute("data-ready", "");
        await page.keyboard.press("ArrowDown");
        const firstUnfilteredOption = page.getByRole("option").first();
        await expect(firstUnfilteredOption).toBeVisible();
        const firstUnfilteredOptionId = await firstUnfilteredOption.getAttribute("id");
        const firstUnfilteredOptionName = (await firstUnfilteredOption.innerText()).trim();
        expect(firstUnfilteredOptionName).not.toBe("");
        if (firstUnfilteredOptionId === null) {
          throw new Error("The first real option has no stable identity.");
        }
        expect(firstUnfilteredOptionId).toMatch(/^[A-Za-z0-9_-]+$/u);
        retainedFirstUnfilteredOptionId = firstUnfilteredOptionId;
        const retainedFirstUnfilteredOption = page.locator(
          `[role="option"][id="${retainedFirstUnfilteredOptionId}"]`,
        );
        await expect(retainedFirstUnfilteredOption).toHaveAttribute("data-highlighted", "");
      }
      await page.keyboard.type("bullish");
      if (delayedResponse === "initial merchant response") {
        await expect.poll(() => responseRequested).toBe(true);
        releaseResponse();
      }
      await expect(page.getByRole("option", { name: /Bullish Hype/ })).toBeVisible();
      if (delayedResponse === "merchant search") {
        await expect.poll(() => responseRequested).toBe(true);
        if (retainedFirstUnfilteredOptionId === undefined) {
          throw new Error("The first real option identity was not retained.");
        }
        const retainedFirstUnfilteredOption = page.locator(
          `[role="option"][id="${retainedFirstUnfilteredOptionId}"]`,
        );
        await expect(retainedFirstUnfilteredOption).toHaveAttribute("data-highlighted", "");
        releaseResponse();
      }
      // T141: late results need actual list navigation, not assumed auto-highlighting.
      // The real filtered response has one match in this fixture; retained results do not.
      await expect(page.getByRole("option")).toHaveCount(1);
      await page.keyboard.press("ArrowDown");
      // T126: still verify the intended active item before Enter, never just visibility.
      await expect(page.getByRole("option", { name: /Bullish Hype/ })).toHaveAttribute(
        "data-highlighted",
        "",
      );
      await page.keyboard.press("Enter");
      await expect(page.getByRole("combobox", { name: "Cliente" })).toHaveValue("Bullish Hype");
      await expect(page.getByRole("combobox", { name: "Punto de recogida" })).toHaveText(
        "Bodega Estadio · Cra 70 # 45-10",
      );
      await page.getByLabel("Nombre del destinatario").focus();
      await page.keyboard.type("Laura Gómez");
      await page.keyboard.press("Tab");
      await page.keyboard.type("3001234567");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Calle 10 # 43-12");
      await page.keyboard.press("Tab");
      await page.keyboard.type("laureles");
      const neighborhood = page.getByRole("option", {
        name: "Laureles Medellín · Medellín",
        exact: true,
      });
      await expect(neighborhood).toBeVisible();
      await expect(page.getByRole("option")).toHaveCount(1);
      await page.keyboard.press("ArrowDown");
      await expect(neighborhood).toHaveAttribute("data-highlighted", "");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("combobox", { name: "Barrio", exact: true })).toHaveValue(
        "Laureles",
      );
      await page.getByRole("button", { name: "Crédito del cliente" }).focus();
      await page.keyboard.press("Enter");
      if (delayedResponse === "fee quote") {
        await expect.poll(() => responseRequested).toBe(true);
        releaseResponse();
      }
      // Feature 001 FR-006: see the actual quote before saving, not a transient empty fee.
      await expect(payment(page).getByText("$ 13.000", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Registrar envío" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/)).toBeVisible();
    } finally {
      releaseResponse();
      if (delayedResponse !== "none") await page.unrouteAll({ behavior: "wait" });
    }
  });
}
