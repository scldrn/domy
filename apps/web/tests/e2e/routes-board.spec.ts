import { formatTrackingNumber, type RouteDetail, type Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { register } from "./api";
import { expect, test } from "./fixtures";

const startOfSuite = "2026-10-01T15:00:00Z"; // 10:00 in Bogotá, as global-setup sets it

test.afterEach(async ({ setServerNow }) => {
  await setServerNow(startOfSuite);
});

const unique = () => String(Date.now()).slice(-6);

async function createCourier(page: Page, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const response = await page.request.post("/api/couriers", {
    data: { id, name, phone: "3004445566", aliases: [] },
  });
  expect(response.status()).toBe(201);
  return id;
}

/** A route for today with a courier, dispatched through the API (feature 002, US1). */
async function dispatchedRoute(
  page: Page,
  shipments: Shipment[],
  courierId: string,
): Promise<RouteDetail> {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: shipments.map((shipment) => shipment.id),
      courierId,
    },
  });
  expect(created.status()).toBe(201);
  const route = (await created.json()) as RouteDetail;
  const dispatched = await page.request.post(`/api/routes/${route.id}/dispatch`, {
    data: { actionId: crypto.randomUUID(), version: route.version },
  });
  expect(dispatched.status()).toBe(200);
  return route;
}

const routeCard = (page: Page, list: string, number: number) =>
  page
    .getByRole("list", { name: list })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: `Ruta ${String(number)}`, exact: true }) });

test("shows the routes of the day with courier, progress, amount, and flags (scenario 6)", async ({
  dispatcherPage: page,
}) => {
  const run = unique();
  const ana = await createCourier(page, `Ana ${run}`);
  const beto = await createCourier(page, `Beto ${run}`);
  const urgent = await register(page, { window: { preset: "before", end: "10:30" } });
  const first = await dispatchedRoute(page, [urgent, await register(page)], ana);
  const second = await dispatchedRoute(page, [await register(page)], beto);
  const waiting = [
    await register(page),
    await register(page),
    await register(page),
    await register(page),
  ];

  await page.goto("/rutas");
  const card = routeCard(page, "Rutas del día", first.number);
  await expect(card).toContainText(`Ana ${run}`);
  await expect(card).toContainText("En curso");
  await expect(card).toContainText("0 de 3 paradas");
  await expect(card).toContainText("$ 170.000");
  await expect(card).toContainText("1 en riesgo");
  await expect(routeCard(page, "Rutas del día", second.number)).toContainText(`Beto ${run}`);
  for (const shipment of waiting) {
    await expect(
      page.getByRole("checkbox", {
        name: new RegExp(formatTrackingNumber(shipment.trackingNumber)),
      }),
    ).toBeVisible();
  }
});

test("shows a route dispatched by someone else within 30 seconds, without reloading (scenario 7)", async ({
  dispatcherPage,
  ownerPage,
}) => {
  await ownerPage.goto("/rutas");
  await expect(ownerPage.getByRole("heading", { name: "Rutas del día" })).toBeVisible();

  const courierId = await createCourier(dispatcherPage, `Carla ${unique()}`);
  const route = await dispatchedRoute(dispatcherPage, [await register(dispatcherPage)], courierId);
  await expect(routeCard(ownerPage, "Rutas del día", route.number)).toContainText("En curso", {
    timeout: 30_000,
  });
});

test("lists yesterday's route still in progress under its own section (scenario 8)", async ({
  dispatcherPage: page,
  setServerNow,
}) => {
  const courierId = await createCourier(page, `Dora ${unique()}`);
  const route = await dispatchedRoute(page, [await register(page)], courierId);

  await setServerNow("2026-10-02T15:00:00Z");
  await page.goto("/rutas");
  await expect(routeCard(page, "Rutas de días anteriores", route.number)).toContainText("En curso");
});

test("says what to do on a date without routes (FR-027)", async ({ dispatcherPage: page }) => {
  await page.goto("/rutas?date=2026-12-24");
  await expect(page.getByText("No hay rutas para este día")).toBeVisible();
});
