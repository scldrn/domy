import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const startOfSuite = "2026-10-01T15:00:00Z"; // 10:00 in Bogotá, as global-setup sets it

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function quote(page: Page): Promise<number | null> {
  const get = async <T>(path: string) => (await (await page.request.get(path)).json()) as T;
  const [merchant] = (await get<{ items: { id: string }[] }>("/api/merchants?q=Bullish")).items;
  const [place] = (await get<{ items: { id: string }[] }>("/api/neighborhoods?q=Laureles")).items;
  const response = await page.request.post("/api/shipments/fee-quote", {
    data: {
      merchantId: merchant?.id,
      kind: "delivery",
      neighborhoodId: place?.id,
      serviceLevel: "standard",
    },
  });
  return ((await response.json()) as { calculatedFee: number | null }).calculatedFee;
}

test.afterEach(async ({ setServerNow }) => {
  await setServerNow(startOfSuite);
});

test("schedules a standard rate for tomorrow (scenario 12)", async ({
  ownerPage: page,
  setServerNow,
}) => {
  await page.goto("/tarifario");
  await page.getByRole("button", { name: "Nueva tarifa" }).click();
  const dialog = page.getByRole("dialog");
  await chooseOption(page, "Zona", "Medellín");
  await dialog.getByLabel("Valor").fill("14.000");
  await dialog.getByLabel("Vigente desde").fill("2026-10-02");
  await dialog.getByRole("button", { name: "Guardar tarifa" }).click();
  await expect(page.getByText(/2 oct 2026: Tarifa de zona Medellín, \$ 14\.000/)).toBeVisible();

  expect(await quote(page)).toBe(13000);
  await setServerNow("2026-10-02T05:00:00Z"); // 00:00 on 2 October in Bogotá
  expect(await quote(page)).toBe(14000);
});

test("lets the dispatcher add a neighborhood for review, not change zones (scenario 16)", async ({
  dispatcherPage,
  ownerPage,
}) => {
  const name = `Villa Prueba ${String(Date.now()).slice(-5)}`;
  await dispatcherPage.goto("/barrios");
  await dispatcherPage.getByRole("button", { name: "Agregar barrio" }).click();
  await dispatcherPage.getByLabel("Nombre del barrio").fill(name);
  await chooseOption(dispatcherPage, "Municipio", "Medellín");
  await chooseOption(dispatcherPage, "Zona tarifaria", "Medellín");
  await dispatcherPage.getByRole("dialog").getByRole("button", { name: "Agregar barrio" }).click();
  await expect(dispatcherPage.getByText(`Barrio ${name} agregado`)).toBeVisible();

  // The zone of an existing neighborhood is not editable for the dispatcher.
  await dispatcherPage.getByLabel("Buscar barrios").fill("Laureles");
  const laureles = dispatcherPage.getByRole("row").filter({ hasText: "Laureles" }).first();
  await laureles.getByRole("button", { name: "Editar" }).click();
  const dialog = dispatcherPage.getByRole("dialog");
  await expect(dialog).toContainText("Solo el propietario la cambia");
  await expect(dialog.getByRole("combobox", { name: "Zona tarifaria" })).toHaveCount(0);

  await ownerPage.goto("/barrios");
  await ownerPage.getByRole("button", { name: "Por revisar" }).click();
  const row = ownerPage.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("Por revisar");
  await row.getByRole("button", { name: "Confirmar" }).click();
  await expect(ownerPage.getByText(`${name} confirmado`)).toBeVisible();
});

test("warns about open shipments when a merchant is deactivated (US6 scenario 7)", async ({
  dispatcherPage: page,
}) => {
  const get = async <T>(path: string) => (await (await page.request.get(path)).json()) as T;
  const [place] = (await get<{ items: { id: string }[] }>("/api/neighborhoods?q=Laureles")).items;
  const merchantId = crypto.randomUUID();
  const name = `Tienda Prueba ${String(Date.now()).slice(-5)}`;
  await page.request.post("/api/merchants", { data: { id: merchantId, name } });
  const pointId = crypto.randomUUID();
  await page.request.post(`/api/merchants/${merchantId}/pickup-points`, {
    data: { id: pointId, label: "Bodega", address: "Cl 1 # 2-3", neighborhoodId: place?.id },
  });
  for (let i = 0; i < 3; i++) {
    const response = await page.request.post("/api/shipments", {
      data: {
        id: crypto.randomUUID(),
        kind: "delivery",
        merchantId,
        pickupPointId: pointId,
        recipientName: "Laura Gómez",
        recipientPhone: "3001234567",
        recipientAddress: "Calle 10 # 43-12",
        recipientNeighborhoodId: place?.id,
        paymentMode: "merchant_account",
        fee: 13000,
      },
    });
    expect(response.status()).toBe(201);
  }

  await page.goto("/clientes");
  await page.getByLabel("Buscar clientes").fill(name);
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Desactivar cliente" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Tiene 3 envíos abiertos; seguirán su curso normal.");
  await confirm.getByRole("button", { name: "Desactivar cliente" }).click();
  await expect(page.getByText("Inactivo", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivar cliente" })).toBeVisible();
});

// Feature 006, T059/T066: the audit log reads one sentence per change, with names.
test("reads each change of master data as a sentence with names (US5)", async ({
  ownerPage: page,
}) => {
  const id = crypto.randomUUID();
  const name = `Tienda Auditada ${String(Date.now()).slice(-5)}`;
  const created = await page.request.post("/api/merchants", {
    data: { id, name, whatsappPhone: "3005550101", aliases: [] },
  });
  expect(created.status()).toBe(201);
  const renamed = await page.request.patch(`/api/merchants/${id}`, {
    data: { actionId: crypto.randomUUID(), name: `${name} Norte` },
  });
  expect(renamed.ok()).toBe(true);

  await page.goto("/auditoria");
  const changes = page.getByRole("region", { name: "Cambios" });
  await expect(changes).toContainText(`creó el cliente ${name}`);
  await expect(changes).toContainText(`cambió el cliente ${name} Norte`);
  await expect(changes).toContainText(`Nombre: ${name} → ${name} Norte`);
});
