import type { Handover, RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot } from "./setup/courier.ts";
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
  it("keeps a continuous holder through a late off-route pickup, office receipt and the next courier (003 SC-007/T063)", async () => {
    const ana = await courierWithAccount(t, database.db, "Ana Ruiz");
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const shipment = await registerShipment(t, cookie, catalog);
    const draft = await createRoute(t, cookie, {
      shipmentIds: [shipment.id, (await registerShipment(t, cookie, catalog)).id],
      courierId: ana.id,
    });
    const route = (await routeAction(t, cookie, draft, "/dispatch")).body;
    t.setNow(at(9));
    expect((await routeAction(t, cookie, route, `/shipments/${shipment.id}/remove`)).status).toBe(
      200,
    );
    t.setNow(at(10));
    expect(
      (await sendRecords(t, ana, [{ kind: "pickup", shipmentId: shipment.id, occurredAt: at(5) }]))
        .status,
    ).toBe(200);
    const owner = await t.signIn("owner");
    expect(
      (
        await send(
          t,
          owner.cookie,
          "/api/settings",
          {
            actionId: crypto.randomUUID(),
            officeAddress: "Carrera 90 # 65C-10",
            officeNeighborhoodId: catalog.place.laureles,
          },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    t.setNow(at(15));
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/office-receipt`, {
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(200);
    const officeDraft = await createRoute(t, cookie, {
      shipmentIds: [shipment.id],
      courierId: beto.id,
    });
    expect((await routeAction(t, cookie, officeDraft, "/dispatch")).status).toBe(200);
    t.setNow(at(25));
    expect(
      (await sendRecords(t, beto, [{ kind: "pickup", shipmentId: shipment.id }])).body.results[0]
        ?.outcome,
    ).toBe("applied");
    t.setNow(at(30));
    expect(
      (
        await sendRecords(t, beto, [
          {
            kind: "delivery",
            shipmentId: shipment.id,
            receivedByName: "Laura Gómez",
            cashAmount: 50_000,
          },
        ])
      ).body.results[0]?.outcome,
    ).toBe("applied");
    const { body } = await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`);
    const custody = body.events
      .filter((event) => event.changes?.["custodyCourierId"])
      .map((event) => ({
        at: event.occurredAt,
        receivedAt: event.recordedAt,
        courier: event.changes?.["custodyCourierId"],
        office: event.changes?.["heldAtOffice"],
      }));
    expect(custody).toEqual([
      { at: at(5), receivedAt: at(10), courier: [null, "Ana Ruiz"], office: undefined },
      { at: at(15), receivedAt: at(15), courier: ["Ana Ruiz", null], office: [false, true] },
      { at: at(25), receivedAt: at(25), courier: [null, "Beto Gómez"], office: [true, false] },
      { at: at(30), receivedAt: at(30), courier: ["Beto Gómez", null], office: undefined },
    ]);
    expect(body.custodyCourier).toBeNull();
    expect(body.heldAtOffice).toBe(false);
    expect((await snapshot(t, ana)).body.heldOffRoute).toEqual([]);
  });

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
