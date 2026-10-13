import { formatTrackingNumber, type Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { expect, test } from "./fixtures";

const unique = () => String(Date.now()).slice(-6);

async function createCourier(page: Page, name: string) {
  const response = await page.request.post("/api/couriers", {
    data: { id: crypto.randomUUID(), name, phone: "3004445566", aliases: [] },
  });
  expect(response.status()).toBe(201);
}

/** A second and third pickup point for Bullish Hype, so a route has three pickup places. */
async function pickupPoints(page: Page, run: string): Promise<string[]> {
  const [merchant] = (
    (await (await page.request.get("/api/merchants?q=Bullish")).json()) as {
      items: { id: string }[];
    }
  ).items;
  const [place] = (
    (await (await page.request.get("/api/neighborhoods?q=Laureles")).json()) as {
      items: { id: string }[];
    }
  ).items;
  const ids: string[] = [];
  for (const label of [`Local ${run}`, `Bodega ${run}`]) {
    const id = crypto.randomUUID();
    const response = await page.request.post(`/api/merchants/${merchant?.id ?? ""}/pickup-points`, {
      data: { id, label, address: `Calle ${label}`, neighborhoodId: place?.id },
    });
    expect(response.status()).toBe(201);
    ids.push(id);
  }
  return ids;
}

async function select(page: Page, shipments: Shipment[]) {
  for (const shipment of shipments) {
    await page
      .getByRole("checkbox", { name: new RegExp(formatTrackingNumber(shipment.trackingNumber)) })
      .check();
  }
}

/** Moves a stop with the keyboard, as a screen reader user would (FR-006). */
async function moveWithKeyboard(page: Page, stop: number, steps: number) {
  await page.getByRole("button", { name: `Mover la parada ${String(stop)}`, exact: true }).focus();
  await page.keyboard.press("Space");
  for (let i = 0; i < steps; i++) {
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowUp");
  }
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
}

const stops = (page: Page) =>
  page.getByRole("list", { name: "Paradas de la ruta" }).locator(":scope > li");

test("builds, orders, and dispatches a route (scenarios 1–4)", async ({ dispatcherPage: page }) => {
  const run = unique();
  const courier = `Mensajero ${run}`;
  await createCourier(page, courier);
  const [local, bodega] = await pickupPoints(page, run);
  const shipments: Shipment[] = [];
  for (const pickupPointId of [undefined, local, bodega]) {
    for (let i = 0; i < 3; i++) {
      shipments.push(await register(page, pickupPointId ? { pickupPointId } : {}));
    }
  }

  await page.goto("/rutas");
  await select(page, shipments);
  await page.getByRole("button", { name: "Crear ruta con 9 envíos" }).click();
  await expect(page).toHaveURL(/\/rutas\/[0-9a-f-]{36}$/);
  // The board, with a card headed "Ruta N" per route, stays until the detail page renders.
  await expect(page.getByRole("heading", { level: 1, name: /^Ruta \d+$/ })).toBeVisible();
  await expect(page.getByText("En preparación", { exact: true })).toBeVisible();
  await expect(stops(page)).toHaveCount(12);
  await expect(stops(page).filter({ hasText: "Recogida" })).toHaveCount(3);

  // Scenario 2: a delivery above its own pickup is refused, by keyboard and by dragging.
  await moveWithKeyboard(page, 4, 3);
  const refusal = page.getByText("La entrega de un envío debe quedar después de su recogida.");
  await expect(refusal).toBeVisible();
  await page
    .getByRole("button", { name: "Mover la parada 5", exact: true })
    .dragTo(page.getByRole("button", { name: "Mover la parada 1", exact: true }));
  await expect(refusal).toBeVisible();
  // A valid move with the keyboard: the first delivery right after its pickup.
  await moveWithKeyboard(page, 4, 2);
  await expect(stops(page).nth(1)).toContainText("Entrega");
  await page.reload();
  await expect(stops(page).nth(1)).toContainText("Entrega");

  // Scenario 3: no dispatch without a courier; then with one.
  await page.getByRole("button", { name: "Despachar" }).click();
  await expect(page.getByText("Asigna un mensajero antes de despachar la ruta.")).toBeVisible();
  const courierField = page.getByRole("combobox", { name: "Mensajero" });
  await courierField.click();
  await courierField.fill(courier);
  await page.getByRole("option", { name: courier }).click();
  await expect(page.getByText("Mensajero asignado")).toBeVisible();
  await page.getByRole("button", { name: "Despachar" }).click();
  await expect(page.getByText("En curso", { exact: true })).toBeVisible();
  const firstRoute = page.url();
  await page.goto(`/envios/${shipments[0]?.trackingNumber ?? ""}`);
  await expect(page.getByText("En ruta", { exact: true }).first()).toBeVisible();

  // Scenario 4: a second route in progress for the same courier is refused.
  const another = await register(page);
  await page.goto("/rutas");
  await select(page, [another]);
  await page.getByRole("button", { name: "Crear ruta con 1 envío" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Ruta \d+$/ })).toBeVisible();
  await expect(page.getByText("En preparación", { exact: true })).toBeVisible();
  const field = page.getByRole("combobox", { name: "Mensajero" });
  await field.click();
  await field.fill(courier);
  await page.getByRole("option", { name: courier }).click();
  await expect(page.getByText("Mensajero asignado")).toBeVisible();
  await page.getByRole("button", { name: "Despachar" }).click();
  await expect(
    page.getByText(new RegExp(`${courier} ya tiene la Ruta \\d+ en curso`)),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver esa ruta" }).click();
  await expect(page).toHaveURL(firstRoute);
});

test("places reverse pickups, carrier handoffs, and errands (scenario 5)", async ({
  dispatcherPage: page,
}) => {
  const reverse = await register(page, {
    kind: "reverse_pickup",
    recipientAddress: "Carrera 50 # 10-10",
  });
  const handoff = await register(
    page,
    {
      kind: "carrier_handoff",
      carrierId: (
        (await (await page.request.get("/api/carriers?q=Coonorte")).json()) as {
          items: { id: string }[];
        }
      ).items[0]?.id,
      destinationTown: "Santa Rosa de Osos",
      recipientAddress: undefined,
      fee: 15000,
    },
    "Terminal del Norte",
  );
  const errand = await register(page, {
    kind: "errand",
    errandDescription: "Pagar un recibo",
    recipientName: undefined,
    recipientPhone: undefined,
    recipientAddress: undefined,
    recipientNeighborhoodId: undefined,
    paymentMode: "merchant_account",
    codAmount: undefined,
    fee: 12000,
    feeOverrideReason: "Diligencia en el centro",
  });

  await page.goto("/rutas");
  await select(page, [reverse, handoff, errand]);
  await page.getByRole("button", { name: "Crear ruta con 3 envíos" }).click();
  await expect(stops(page)).toHaveCount(5);
  await expect(stops(page).filter({ hasText: "Recogida" }).first()).toContainText(
    "Carrera 50 # 10-10",
  );
  await expect(stops(page).filter({ hasText: "Terminal del Norte" })).toContainText("Entrega");
  await expect(stops(page).filter({ hasText: "Diligencia" })).toHaveCount(1);
});
