import type { CourierSnapshot } from "@domy/domain";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeTasks, routes, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, createRoute, routeAction } from "./setup/routes.ts";

/** T091, SC-003/SC-004, over feature 002's original routes-scale busy-day fixture. */
let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let dispatcherCookie: string;
let courier: Awaited<ReturnType<typeof courierWithAccount>>;
let routeShipmentIds: string[];
const timings: Record<string, number> = {};

const today = "2026-10-01";
const snapshotBudget = 500;
const batchBudget = 2000;

beforeAll(async () => {
  database = await startDatabase();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  dispatcherCookie = (await t.signIn("dispatcher")).cookie;
  const catalog = await createCatalog(database.db, owner.user.id);
  courier = await courierWithAccount(t, database.db, "Mensajero de escala");

  const insertShipments = (from: number, to: number, status: "delivered" | "registered") =>
    database.db.execute(sql`
      insert into shipments (id, tracking_number, kind, status, service_date, merchant_id,
        pickup_address, pickup_neighborhood_id, recipient_name, recipient_name_normalized,
        recipient_phone, recipient_address, recipient_neighborhood_id, rate_zone_id,
        calculated_fee, fee, payment_mode, cod_amount, registered_at, registered_by)
      select gen_random_uuid(), upper(lpad(to_hex(i), 8, '0')), 'delivery', ${status}::shipment_status,
        ${today}::date - (case when ${status} = 'delivered' then 1 + i % 900 else 0 end),
        ${catalog.merchant.bullish}, 'Cra ' || (i % 6), ${catalog.place.laureles},
        'Persona ' || i, 'persona ' || i, '300' || lpad(i::text, 7, '0'), 'Calle ' || i,
        ${catalog.place.laureles}, ${catalog.zone.medellin}, 13000, 13000,
        'cash_on_delivery', 50000, timestamp '2024-01-01' + (i || ' minutes')::interval,
        ${owner.user.id}
      from generate_series(${from}::int, ${to}::int) i`);

  await insertShipments(1, 100_000, "delivered");
  await insertShipments(200_001, 200_800, "registered");
  await database.db.execute(sql`analyze shipments`);

  const registeredIds = (
    await database.db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.status, "registered"))
      .orderBy(asc(shipments.trackingNumber))
  ).map((row) => row.id);
  if (registeredIds.length !== 800) {
    throw new Error("The courier scale fixture must contain 800 current shipments");
  }
  routeShipmentIds = registeredIds.slice(0, 15);

  const courierIds = [
    courier.id,
    ...(await Promise.all(
      Array.from({ length: 41 }, (_, index) =>
        createCourier(database.db, `Mensajero ${String(index + 1)}`),
      ),
    )),
  ];
  for (let index = 0; index < 40; index++) {
    const courierId = courierIds[index];
    const shipmentIds = registeredIds.slice(index * 15, index * 15 + 15);
    if (!courierId || shipmentIds.length !== 15) {
      throw new Error("The courier scale fixture is missing a route or courier");
    }
    const route = await createRoute(t, dispatcherCookie, {
      serviceDate: today,
      shipmentIds,
      courierId,
    });
    if (index < 30) {
      const dispatched = await routeAction(t, dispatcherCookie, route, "/dispatch");
      expect(dispatched.status).toBe(200);
    }
  }

  await assertBusyDayFixture();
}, 180_000);

afterAll(async () => {
  console.info("courier-scale timings (ms):", timings);
  await database.stop();
});

async function assertBusyDayFixture(): Promise<void> {
  const [shipmentCount] = await database.db.select({ value: count() }).from(shipments);
  const [historicalCount] = await database.db
    .select({ value: count() })
    .from(shipments)
    .where(eq(shipments.status, "delivered"));
  const [unassignedCount] = await database.db
    .select({ value: count() })
    .from(shipments)
    .where(and(eq(shipments.status, "registered"), isNull(shipments.routeId)));
  const routeCounts = await database.db
    .select({ status: routes.status, value: count() })
    .from(routes)
    .groupBy(routes.status);
  const [taskCount] = await database.db.select({ value: count() }).from(routeTasks);

  expect(shipmentCount?.value).toBe(100_800);
  expect(historicalCount?.value).toBe(100_000);
  expect(unassignedCount?.value).toBe(200);
  expect(routeCounts).toEqual(
    expect.arrayContaining([
      { status: "in_progress", value: 30 },
      { status: "draft", value: 10 },
    ]),
  );
  expect(taskCount?.value).toBe(1200);
}

function routeTasksFrom(snapshotResponse: { body: CourierSnapshot }): string[] {
  const route = snapshotResponse.body.route;
  if (!route) throw new Error("The scale courier must have a route in progress");
  const tasks = route.stops.flatMap((stop) => stop.tasks);
  expect(tasks).toHaveLength(30);
  expect(new Set(tasks.map((task) => task.shipmentId)).size).toBe(15);
  return tasks.map((task) => task.shipmentId);
}

describe("courier snapshot and record batch on a busy day (SC-003, SC-004, research R13)", () => {
  it("loads a native 15-shipment snapshot in under 500 ms", async () => {
    const warmup = await snapshot(t, courier);
    expect(warmup.status).toBe(200);
    expect(routeTasksFrom(warmup)).toEqual(expect.arrayContaining(routeShipmentIds));

    let worst = 0;
    for (let index = 0; index < 5; index++) {
      const started = performance.now();
      const result = await snapshot(t, courier);
      const elapsed = performance.now() - started;
      worst = Math.max(worst, elapsed);
      expect(result.status).toBe(200);
      expect(routeTasksFrom(result)).toEqual(expect.arrayContaining(routeShipmentIds));
      expect(elapsed).toBeLessThan(snapshotBudget);
    }
    timings["15-shipment courier snapshot"] = Math.round(worst);
  });

  it("applies 50 native courier records in under 2 seconds", async () => {
    const deviceNow = t.now().toISOString();
    let worst = 0;
    for (let batchIndex = 0; batchIndex < 5; batchIndex++) {
      const records = Array.from({ length: 50 }, (_, recordIndex) => {
        const shipmentId = routeShipmentIds[recordIndex % routeShipmentIds.length];
        if (!shipmentId) throw new Error("The scale route is missing one of its 15 shipments");
        return {
          id: crypto.randomUUID(),
          shipmentId,
          kind: "disbursement",
          amount: 1000,
          payee: "Prueba de escala",
        };
      });
      const started = performance.now();
      const result = await sendRecords(t, courier, records, deviceNow);
      const elapsed = performance.now() - started;
      worst = Math.max(worst, elapsed);
      expect(result.status).toBe(200);
      expect(result.body.results).toHaveLength(50);
      expect(result.body.results.every((record) => record.outcome === "applied")).toBe(true);
      expect(elapsed).toBeLessThan(batchBudget);
    }
    timings["50-record courier batch"] = Math.round(worst);
  });
});
