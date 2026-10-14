import type { RouteDetail } from "@domy/domain";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, routeAction, send } from "./setup/routes.ts";

/**
 * The performance budget of research R13 on a busy day over a long history: 100,000 earlier
 * shipments, 40 routes of 15 shipments (30 of them on their way), and 200 shipments without
 * a route.
 */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let cookie: string;
let couriers: string[];
let sample: { routeId: string; shipmentId: string };
const timings: Record<string, number> = {};

const today = "2026-10-01";
const readBudget = 500;
const actionBudget = 1000;

beforeAll(async () => {
  database = await startDatabase();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  cookie = (await t.signIn("dispatcher")).cookie;
  const catalog = await createCatalog(database.db, owner.user.id);
  const insert = (from: number, to: number, status: string, serviceDate: string) =>
    database.db.execute(sql`
      insert into shipments (id, tracking_number, kind, status, service_date, merchant_id,
        pickup_address, pickup_neighborhood_id, recipient_name, recipient_name_normalized,
        recipient_phone, recipient_address, recipient_neighborhood_id, rate_zone_id,
        calculated_fee, fee, payment_mode, cod_amount, registered_at, registered_by)
      select gen_random_uuid(), upper(lpad(to_hex(i), 8, '0')), 'delivery', ${status}::shipment_status,
        ${serviceDate}::date - (case when ${status} = 'delivered' then 1 + i % 900 else 0 end),
        ${catalog.merchant.bullish}, 'Cra ' || (i % 6), ${catalog.place.laureles},
        'Persona ' || i, 'persona ' || i, '300' || lpad(i::text, 7, '0'), 'Calle ' || i,
        ${catalog.place.laureles}, ${catalog.zone.medellin}, 13000, 13000,
        'cash_on_delivery', 50000, timestamp '2024-01-01' + (i || ' minutes')::interval,
        ${owner.user.id}
      from generate_series(${from}::int, ${to}::int) i`);
  await insert(1, 100_000, "delivered", today);
  await insert(200_001, 200_800, "registered", today);
  await database.db.execute(sql`analyze shipments`);

  const ids = (
    await database.db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.status, "registered"))
      .orderBy(shipments.trackingNumber)
  ).map((row) => row.id);
  couriers = await Promise.all(
    Array.from({ length: 42 }, (_, index) =>
      createCourier(database.db, `Mensajero ${String(index)}`),
    ),
  );
  for (let index = 0; index < 40; index++) {
    const id = crypto.randomUUID();
    const created = await send<RouteDetail>(t, cookie, "/api/routes", {
      id,
      actionId: id,
      serviceDate: today,
      shipmentIds: ids.slice(index * 15, index * 15 + 15),
      courierId: couriers[index],
    });
    expect(created.status).toBe(201);
    if (index < 30) await routeAction(t, cookie, created.body, "/dispatch");
    if (index === 0) sample = { routeId: id, shipmentId: ids[0] ?? "" };
  }
}, 180_000);
afterAll(async () => {
  console.info("routes-scale timings (ms):", timings);
  await database.stop();
});

/** The slowest of five runs, after one warm-up. */
async function slowest(name: string, run: () => Promise<{ status: number }>): Promise<number> {
  expect((await run()).status, name).toBeLessThan(300);
  let worst = 0;
  for (let index = 0; index < 5; index++) {
    const started = performance.now();
    const result = await run();
    worst = Math.max(worst, performance.now() - started);
    expect(result.status, name).toBeLessThan(300);
  }
  timings[name] = Math.round(worst);
  return worst;
}

describe("reads on a busy day (research R13)", () => {
  it.each([
    ["routes board", () => `/api/routes/board?date=${today}`],
    ["unassigned shipments", () => `/api/shipments/unassigned?date=${today}`],
    ["route detail", () => `/api/routes/${sample.routeId}`],
    ["shipment detail", () => `/api/shipments/${sample.shipmentId}`],
  ])("%s answers in under 500 ms", async (name, path) => {
    expect(await slowest(name, () => send(t, cookie, path()))).toBeLessThan(readBudget);
  });

  it("serves 20 panels polling the board at once in under 2 seconds", async () => {
    const started = performance.now();
    const answers = await Promise.all(
      Array.from({ length: 20 }, () => send(t, cookie, `/api/routes/board?date=${today}`)),
    );
    timings["20 concurrent boards"] = Math.round(performance.now() - started);
    expect(answers.every((answer) => answer.status === 200)).toBe(true);
    expect(timings["20 concurrent boards"]).toBeLessThan(2000);
  });
});

describe("actions on a busy day (research R13)", () => {
  it("creates, orders, and dispatches a route of 15 shipments in under 1 second each", async () => {
    const unassigned = await send<{ shipments: { id: string }[] }>(
      t,
      cookie,
      `/api/shipments/unassigned?date=${today}`,
    );
    expect(unassigned.body.shipments).toHaveLength(200);
    const measure = async <T>(name: string, run: () => Promise<T>) => {
      const started = performance.now();
      const result = await run();
      timings[name] = Math.round(performance.now() - started);
      expect(timings[name], name).toBeLessThan(actionBudget);
      return result;
    };
    const id = crypto.randomUUID();
    const created = await measure("create a route of 15", () =>
      send<RouteDetail>(t, cookie, "/api/routes", {
        id,
        actionId: id,
        serviceDate: today,
        shipmentIds: unassigned.body.shipments.slice(0, 15).map((shipment) => shipment.id),
        courierId: couriers[40],
      }),
    );
    expect(created.status).toBe(201);
    // Pickups first, then the deliveries in reverse.
    const stops = created.body.stops;
    const stopIds = [
      ...stops.filter((stop) => stop.kind === "pickup"),
      ...stops.filter((stop) => stop.kind !== "pickup").reverse(),
    ].map((stop) => stop.id);
    const ordered = await measure("order its stops", () =>
      routeAction(t, cookie, created.body, "/stop-order", { stopIds }, "PUT"),
    );
    expect(ordered.status).toBe(200);
    const dispatched = await measure("dispatch it", () =>
      routeAction(t, cookie, ordered.body, "/dispatch"),
    );
    expect(dispatched.body.status).toBe("in_progress");
  });
});
