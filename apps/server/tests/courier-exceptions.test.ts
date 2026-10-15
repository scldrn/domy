import {
  exceptionReasons,
  type DispatchBoard,
  type RouteDetail,
  type Shipment,
  type ShipmentDetail,
} from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  courierRecords,
  recordPhotos,
  routes,
  routeTasks,
  shipments,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ana: CourierAccount;
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
  ana = await courierWithAccount(t, database.db);
});

async function dispatched(list: Shipment[]): Promise<RouteDetail> {
  const route = await createRoute(t, cookie, {
    shipmentIds: list.map((s) => s.id),
    courierId: ana.id,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}
const rowOf = async (shipment: Shipment) =>
  (await database.db.select().from(shipments).where(eq(shipments.id, shipment.id)))[0];
const recordsOf = (shipment: Shipment) =>
  database.db.select().from(courierRecords).where(eq(courierRecords.shipmentId, shipment.id));
const board = async () => (await send<DispatchBoard>(t, cookie, "/api/shipments/board")).body;
const entryOf = async (shipment: Shipment) => {
  const view = await board();
  return [...view.shipments, ...view.pendingFromPreviousDays].find((s) => s.id === shipment.id);
};

/** US3 scenarios 1–5, FR-013–FR-014/FR-033: real transactions, custody, notes and projections. */
describe("courier exceptions and pickup problems", () => {
  it.each(exceptionReasons)(
    "records %s, keeps custody and completes the failed visit",
    async (reason) => {
      const shipment = await registerShipment(t, cookie, catalog);
      const route = await dispatched([shipment]);
      await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
      const id = crypto.randomUUID();
      const response = await sendRecords(t, ana, [
        { id, shipmentId: shipment.id, kind: "exception", reason },
      ]);
      expect(response.body.results).toEqual([{ id, outcome: "applied" }]);
      expect(await rowOf(shipment)).toMatchObject({
        status: "exception",
        custodyCourierId: ana.id,
      });
      const tasks = await database.db
        .select()
        .from(routeTasks)
        .where(eq(routeTasks.shipmentId, shipment.id));
      expect(tasks.map((task) => task.status).sort()).toEqual(["completed", "failed"]);
      expect(
        (await database.db.select().from(routes).where(eq(routes.id, route.id)))[0]?.status,
      ).toBe("finished");
      expect((await snapshot(t, ana)).body.route).toBeNull();
      expect((await recordsOf(shipment)).find((r) => r.kind === "exception")).toMatchObject({
        id,
        exceptionReason: reason,
        note: null,
        courierId: ana.id,
        authorUserId: ana.userId,
      });
      expect(await entryOf(shipment)).toMatchObject({ status: "exception", returnDecided: false });
      expect((await board()).exceptionsToDecide).toBe(1);
    },
  );

  it.each([undefined, "other"])(
    "refuses an invalid reason (%s) without storing a record",
    async (reason) => {
      const shipment = await registerShipment(t, cookie, catalog);
      await dispatched([shipment]);
      await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
      expect(
        (await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "exception", reason }]))
          .status,
      ).toBe(400);
      expect(await rowOf(shipment)).toMatchObject({
        status: "picked_up",
        custodyCourierId: ana.id,
      });
      expect((await recordsOf(shipment)).filter((r) => r.kind === "exception")).toEqual([]);
    },
  );

  it("keeps optional exception note, private photo declaration and location on one record", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched([shipment]);
    await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
    const id = crypto.randomUUID();
    const photoId = crypto.randomUUID();
    await sendRecords(t, ana, [
      {
        id,
        shipmentId: shipment.id,
        kind: "exception",
        reason: "wrong_address",
        note: "La numeración no existe",
        location: { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 },
        photos: [{ id: photoId, kind: "exception" }],
      },
    ]);
    expect((await recordsOf(shipment)).find((r) => r.id === id)).toMatchObject({
      note: "La numeración no existe",
      latitude: 6.2442,
    });
    expect(
      await database.db.select().from(recordPhotos).where(eq(recordPhotos.id, photoId)),
    ).toEqual([expect.objectContaining({ recordId: id, kind: "exception", uploadedAt: null })]);
  });

  it("replaces a pickup problem without changing status, ignores late retries, and clears it after pickup", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched([shipment]);
    const first = {
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      kind: "problem",
      note: "El pedido no está listo",
    };
    const second = {
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      kind: "problem",
      note: "El cliente está cerrando",
    };
    await sendRecords(t, ana, [first]);
    await sendRecords(t, ana, [second]);
    await sendRecords(t, ana, [first]);
    expect(await rowOf(shipment)).toMatchObject({ status: "dispatched", custodyCourierId: null });
    const pickup = (await snapshot(t, ana)).body.route?.stops.find(
      (stop) => stop.kind === "pickup",
    );
    expect(pickup?.tasks[0]).toMatchObject({ status: "pending", problemNote: second.note });
    expect((await entryOf(shipment))?.recordFlags).toContain("pickup_problem");
    expect((await recordsOf(shipment)).filter((r) => r.kind === "problem")).toHaveLength(2);
    await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
    expect((await entryOf(shipment))?.recordFlags).not.toContain("pickup_problem");
    expect(
      (
        await database.db.select().from(routeTasks).where(eq(routeTasks.shipmentId, shipment.id))
      ).every((task) => task.problemNote === null),
    ).toBe(true);
  });

  it.each(["remove", "void"] as const)(
    "clears the problem flag after %s while retaining its record",
    async (action) => {
      const shipment = await registerShipment(t, cookie, catalog);
      const route = await dispatched([shipment]);
      const id = crypto.randomUUID();
      await sendRecords(t, ana, [
        { id, shipmentId: shipment.id, kind: "problem", note: "El pedido no está listo" },
      ]);
      expect((await entryOf(shipment))?.recordFlags).toContain("pickup_problem");
      if (action === "remove") {
        const current = (await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body;
        expect(
          (await routeAction(t, cookie, current, `/shipments/${shipment.id}/remove`)).status,
        ).toBe(200);
      } else {
        const current = await rowOf(shipment);
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/void`, {
              actionId: crypto.randomUUID(),
              version: current?.version,
              reason: "El cliente cancela el envío",
            })
          ).status,
        ).toBe(200);
      }
      expect((await entryOf(shipment))?.recordFlags).not.toContain("pickup_problem");
      expect((await recordsOf(shipment)).filter((record) => record.id === id)).toHaveLength(1);
      const detail = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
      expect(detail.records).toContainEqual(
        expect.objectContaining({
          id,
          note: "El pedido no está listo",
          author: { id: ana.userId, name: ana.name },
        }),
      );
    },
  );

  it.each(["", "corto".slice(0, 4), "a".repeat(201)])(
    "refuses a malformed problem note without effects",
    async (note) => {
      const shipment = await registerShipment(t, cookie, catalog);
      await dispatched([shipment]);
      expect(
        (await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "problem", note }])).status,
      ).toBe(400);
      expect(await recordsOf(shipment)).toEqual([]);
      expect((await entryOf(shipment))?.recordFlags).not.toContain("pickup_problem");
    },
  );

  it("keeps an errand pending after a problem and clears the flag upon completion", async () => {
    const shipment = await registerShipment(t, cookie, catalog, {
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
    await dispatched([shipment]);
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "problem", note: "La oficina está cerrada" },
    ]);
    expect(await rowOf(shipment)).toMatchObject({ status: "dispatched", custodyCourierId: null });
    expect((await entryOf(shipment))?.recordFlags).toContain("pickup_problem");
    await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "delivery" }]);
    expect(await rowOf(shipment)).toMatchObject({ status: "delivered" });
    expect((await entryOf(shipment))?.recordFlags).not.toContain("pickup_problem");
  });

  it("projects decided returns but excludes them from the count, including earlier days", async () => {
    const first = await registerShipment(t, cookie, catalog);
    const second = await registerShipment(t, cookie, catalog);
    await dispatched([first, second]);
    await sendRecords(
      t,
      ana,
      [first, second].flatMap((s) => [
        { shipmentId: s.id, kind: "pickup" },
        { shipmentId: s.id, kind: "exception", reason: "recipient_absent" },
      ]),
    );
    // Future US4 state is fixture data only; no decision endpoint is implemented here.
    await database.db
      .update(shipments)
      .set({ returnDecided: true })
      .where(eq(shipments.id, second.id));
    await database.db
      .update(shipments)
      .set({ serviceDate: "2026-09-30" })
      .where(eq(shipments.id, first.id));
    const view = await board();
    expect(view.exceptionsToDecide).toBe(1);
    expect(view.counts.exception).toBe(2);
    expect(view.pendingFromPreviousDays).toContainEqual(
      expect.objectContaining({ id: first.id, returnDecided: false }),
    );
    expect(view.shipments).toContainEqual(
      expect.objectContaining({ id: second.id, returnDecided: true }),
    );
  });
});
