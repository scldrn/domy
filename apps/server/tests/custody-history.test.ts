import type { Handover, RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
  finishTask,
  pickUp,
  registerShipment,
  routeAction,
  send,
} from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
});

async function dispatched(list: Shipment[], courierName: string): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId: await createCourier(database.db, courierName),
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

/** 10:MM in Bogotá on 1 October 2026. */
const at = (minute: number) => `2026-10-01T15:${String(minute).padStart(2, "0")}:00.000Z`;

async function handOver(shipment: Shipment, toRouteId: string, minute: number) {
  t.setNow(at(minute));
  const moved = await send<{ handover: Handover }>(
    t,
    cookie,
    `/api/shipments/${shipment.id}/reassign`,
    { actionId: crypto.randomUUID(), toRouteId, reason: "Cambio de mensajero" },
  );
  expect(moved.status).toBe(200);
  t.setNow(at(minute + 5));
  const confirmed = await send(t, cookie, `/api/handovers/${moved.body.handover.id}/confirm`, {
    actionId: crypto.randomUUID(),
  });
  expect(confirmed.status).toBe(200);
}

describe("Custody history (SC-005)", () => {
  it("leaves no interval between pickup and delivery without a responsible courier", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched([shipment], "Ana Ruiz");
    const beto = await dispatched([await registerShipment(t, cookie, catalog)], "Beto Gómez");
    const carla = await dispatched([await registerShipment(t, cookie, catalog)], "Carla Díaz");

    await pickUp(database.db, shipment.id, new Date(at(5)));
    await handOver(shipment, beto.id, 10);
    await handOver(shipment, carla.id, 20);
    await finishTask(database.db, shipment.id, "delivered", new Date(at(30)));

    const { body } = await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`);
    const custody = body.events.flatMap((event) => {
      const change = event.changes?.["custodyCourierId"];
      return change ? [{ from: change[0], to: change[1], at: event.occurredAt }] : [];
    });
    expect(custody).toEqual([
      { from: null, to: "Ana Ruiz", at: at(5) },
      { from: "Ana Ruiz", to: "Beto Gómez", at: at(15) },
      { from: "Beto Gómez", to: "Carla Díaz", at: at(25) },
      { from: "Carla Díaz", to: null, at: at(30) },
    ]);
    // Each holder is the one the previous record handed the package to.
    for (const [index, record] of custody.entries()) {
      expect(record.from).toBe(index === 0 ? null : custody[index - 1]?.to);
    }
    expect(body.custodyCourier).toBeNull();
  });
});
