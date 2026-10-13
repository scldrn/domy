import type { Handover, RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handovers, routeTasks, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
  pickUp,
  registerShipment,
  routeAction,
  send,
} from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ana: string;
let beto: string;
let picked: Shipment;
let anaRoute: RouteDetail;
let betoRoute: RouteDetail;
let pending: Handover;

/** The test clock: the courier app's actions (feature 003) happen at the same moment. */
const now = new Date("2026-10-01T15:00:00Z");

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
/** Ana picked up a shipment, and the dispatcher moved it to Beto's route. */
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: now.toISOString() });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher", { name: "John Coordinador" })).cookie;
  ana = await createCourier(database.db, "Ana Ruiz");
  beto = await createCourier(database.db, "Beto Gómez");
  picked = await registerShipment(t, cookie, catalog);
  anaRoute = await dispatched([picked], ana);
  await pickUp(database.db, picked.id, now);
  betoRoute = await dispatched([await registerShipment(t, cookie, catalog)], beto);
  pending = await reassign(betoRoute.id);
});

async function dispatched(list: Shipment[], courierId: string): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((shipment) => shipment.id),
    courierId,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}

async function reassign(toRouteId: string): Promise<Handover> {
  const result = await send<{ handover: Handover }>(
    t,
    cookie,
    `/api/shipments/${picked.id}/reassign`,
    { actionId: crypto.randomUUID(), toRouteId, reason: "La moto de Ana se varó" },
  );
  expect(result.status).toBe(200);
  return result.body.handover;
}

const resolve = (
  action: "confirm" | "cancel",
  actionId = crypto.randomUUID(),
  as = cookie,
  handover = pending,
) => send<Handover>(t, as, `/api/handovers/${handover.id}/${action}`, { actionId });
const getRoute = async (id: string) =>
  (await send<RouteDetail>(t, cookie, `/api/routes/${id}`)).body;
const detail = async () =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${picked.id}`)).body;
async function custody() {
  const [row] = await database.db
    .select({ courierId: shipments.custodyCourierId })
    .from(shipments)
    .where(eq(shipments.id, picked.id));
  return row?.courierId;
}
const deliveryTask = (route: RouteDetail) =>
  route.stops
    .flatMap((stop) => stop.tasks)
    .find((task) => task.shipmentId === picked.id && task.kind === "delivery");

describe("Handovers (FR-025)", () => {
  it("keeps custody with the previous courier and the delivery blocked while pending (scenario 2)", async () => {
    expect(await custody()).toBe(ana);
    expect((await getRoute(betoRoute.id)).handovers).toEqual([
      expect.objectContaining({ id: pending.id, status: "pending" }),
    ]);
    // The database refuses to complete a task waiting for its handover.
    await expect(
      database.db
        .update(routeTasks)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(routeTasks.blockedByHandoverId, pending.id)),
    ).rejects.toThrow();
    // Ana's route cannot finish while the handover from it is pending (FR-012).
    expect((await getRoute(anaRoute.id)).status).toBe("in_progress");
  });

  it("confirms on the courier's behalf: custody passes and the delivery unblocks (scenario 3)", async () => {
    const actionId = crypto.randomUUID();
    const result = await resolve("confirm", actionId);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "confirmed",
      resolvedOnBehalf: true,
      resolvedBy: { name: "John Coordinador" },
      resolvedAt: expect.any(String),
    });
    expect(await custody()).toBe(beto);
    expect(deliveryTask(await getRoute(betoRoute.id))?.blockedByHandoverId).toBeNull();
    expect((await detail()).events.at(-1)).toMatchObject({
      type: "handover_confirmed",
      actor: { name: "John Coordinador" },
      changes: { custodyCourierId: ["Ana Ruiz", "Beto Gómez"] },
    });
    expect((await getRoute(betoRoute.id)).events.at(-1)).toMatchObject({
      type: "handover_confirmed",
      fromCourier: { name: "Ana Ruiz" },
      toCourier: { name: "Beto Gómez" },
    });
    // With nothing left, Ana's route finishes.
    expect((await getRoute(anaRoute.id)).status).toBe("finished");

    // A repeated action changes nothing; another confirmation is refused.
    expect((await resolve("confirm", actionId)).status).toBe(200);
    const confirmations = (await detail()).events.filter(
      (event) => event.type === "handover_confirmed",
    );
    expect(confirmations).toHaveLength(1);
    expect((await resolve("confirm")).status).toBe(409);
  });

  it("cancels: the delivery stop returns to the previous courier's route (scenario 4)", async () => {
    const result = await resolve("cancel");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "cancelled",
      resolvedBy: { name: "John Coordinador" },
    });
    expect(await custody()).toBe(ana);
    expect(deliveryTask(await getRoute(betoRoute.id))).toBeUndefined();
    const back = deliveryTask(await getRoute(anaRoute.id));
    expect(back).toMatchObject({ status: "pending", blockedByHandoverId: null });
    expect((await detail()).route).toMatchObject({ id: anaRoute.id });
    expect((await detail()).events.at(-1)).toMatchObject({ type: "handover_cancelled" });
    expect((await getRoute(anaRoute.id)).events.at(-1)).toMatchObject({
      type: "handover_cancelled",
    });
    expect((await resolve("confirm")).status).toBe(409);
  });

  it("lets only the owner and the dispatcher resolve a handover", async () => {
    const courier = await t.signIn("courier");
    expect((await resolve("cancel", undefined, courier.cookie)).status).toBe(403);
    expect((await resolve("confirm", undefined, courier.cookie)).status).toBe(403);
    const owner = await t.signIn("owner");
    expect((await resolve("confirm", undefined, owner.cookie)).status).toBe(200);
  });

  it("replaces a pending handover when the shipment moves again, from the courier in custody (EC-14)", async () => {
    const carla = await createCourier(database.db, "Carla Díaz");
    const carlaRoute = await dispatched([await registerShipment(t, cookie, catalog)], carla);

    const replacing = await reassign(carlaRoute.id);
    expect(replacing).toMatchObject({
      status: "pending",
      fromCourier: { name: "Ana Ruiz" },
      toCourier: { name: "Carla Díaz" },
      fromRouteId: anaRoute.id,
      toRouteId: carlaRoute.id,
    });
    const rows = await database.db
      .select({ id: handovers.id, status: handovers.status })
      .from(handovers)
      .where(and(eq(handovers.shipmentId, picked.id), eq(handovers.status, "pending")));
    expect(rows).toEqual([{ id: replacing.id, status: "pending" }]);
    expect(deliveryTask(await getRoute(betoRoute.id))).toBeUndefined();
    expect(deliveryTask(await getRoute(carlaRoute.id))?.blockedByHandoverId).toBe(replacing.id);
    expect((await resolve("confirm")).status).toBe(409);
  });
});
