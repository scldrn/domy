import type { Shipment, ShipmentDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { courierRecords, shipmentEvents, routeEvents } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ownerCookie: string;
let authorId: string;
let ana: CourierAccount;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  const owner = await t.signIn("owner");
  ownerCookie = owner.cookie;
  catalog = await createCatalog(database.db, owner.user.id);
  const dispatcher = await t.signIn("dispatcher");
  cookie = dispatcher.cookie;
  authorId = dispatcher.user.id;
  ana = await courierWithAccount(t, database.db);
});

async function dispatched(shipment: Shipment) {
  const filler = await registerShipment(t, cookie, catalog);
  const route = await createRoute(t, cookie, {
    shipmentIds: [shipment.id, filler.id],
    courierId: ana.id,
  });
  return (await routeAction(t, cookie, route, "/dispatch")).body;
}
const record = (shipment: Shipment, input: Record<string, unknown>, as = cookie) =>
  send<{ id: string; outcome: string }>(t, as, `/api/shipments/${shipment.id}/records`, input);

/** T071 / FR-034: same record application, attributed to the holder and entered by dispatch. */
describe("records entered on behalf", () => {
  it("also attributes the automatic route-finish event to dispatch", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const created = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: ana.id });
    const route = (await routeAction(t, cookie, created, "/dispatch")).body;
    await record(shipment, { id: crypto.randomUUID(), kind: "pickup" });
    expect(
      (
        await record(shipment, {
          id: crypto.randomUUID(),
          kind: "delivery",
          receivedByName: "Laura Gómez",
          cashAmount: 50000,
        })
      ).status,
    ).toBe(200);
    const events = await database.db
      .select()
      .from(routeEvents)
      .where(eq(routeEvents.routeId, route.id));
    expect(events.find((event) => event.type === "finished")).toMatchObject({
      actorUserId: authorId,
      onBehalf: true,
    });
  });
  it.each(["pickup", "delivery", "exception", "problem", "return", "disbursement"] as const)(
    "records %s with its author, courier, actual time and history",
    async (kind) => {
      const shipment = await registerShipment(t, cookie, catalog);
      const route = await dispatched(shipment);
      if (["delivery", "exception", "return"].includes(kind)) {
        expect(
          (await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }])).status,
        ).toBe(200);
      }
      if (kind === "return") {
        await sendRecords(t, ana, [
          { shipmentId: shipment.id, kind: "exception", reason: "recipient_absent" },
        ]);
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
              actionId: crypto.randomUUID(),
              decision: "return",
              routeId: route.id,
            })
          ).status,
        ).toBe(200);
      }
      const id = crypto.randomUUID();
      const input = {
        id,
        kind,
        ...(kind === "delivery" && { receivedByName: "Laura Gómez", cashAmount: 50000 }),
        ...(kind === "return" && { receivedByName: "Comercio receptor" }),
        ...(kind === "exception" && { reason: "recipient_absent" }),
        ...(kind === "problem" && { note: "El comercio no tiene listo el paquete" }),
        ...(kind === "disbursement" && { amount: 12000, payee: "Transportadora" }),
      };
      const response = await record(shipment, input);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toEqual({ id, outcome: "applied" });
      const [stored] = await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.id, id));
      expect(stored).toMatchObject({
        authorUserId: authorId,
        courierId: ana.id,
        onBehalf: true,
        occurredAt: t.now(),
        recordedAt: t.now(),
      });
      const detail = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
      expect(detail.records.find((item) => item.id === id)).toMatchObject({
        onBehalf: true,
        author: { id: authorId },
        courier: { id: ana.id },
      });
      if (["pickup", "delivery", "exception", "return"].includes(kind)) {
        const events = await database.db
          .select()
          .from(shipmentEvents)
          .where(eq(shipmentEvents.shipmentId, shipment.id))
          .orderBy(shipmentEvents.id);
        expect(
          events
            .filter((event) => event.actorUserId === authorId && event.type === "status_changed")
            .at(-1),
        ).toMatchObject({ onBehalf: true });
      }
    },
  );

  it("keeps an earlier occurredAt, rejects a future time and allows the owner", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(shipment);
    const id = crypto.randomUUID();
    expect(
      (
        await record(
          shipment,
          { id, kind: "pickup", occurredAt: "2026-10-01T14:45:00Z" },
          ownerCookie,
        )
      ).status,
    ).toBe(200);
    const [stored] = await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.id, id));
    expect(stored?.occurredAt.toISOString()).toBe("2026-10-01T14:45:00.000Z");
    const refused = await record(shipment, {
      id: crypto.randomUUID(),
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: 50000,
      occurredAt: "2026-10-01T15:01:00Z",
    });
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({ error: { code: "occurred_in_future" } });
  });

  it("remembers a pickup through simultaneous requests and a late replay after delivery", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(shipment);
    const input = { id: crypto.randomUUID(), kind: "pickup" };
    const responses = await Promise.all([record(shipment, input), record(shipment, input)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await sendRecords(t, ana, [
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 50000,
      },
    ]);
    const before = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
    expect((await record(shipment, input)).body).toEqual({ id: input.id, outcome: "applied" });
    const after = (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
    expect(after).toEqual(before);
    expect(
      await database.db.select().from(courierRecords).where(eq(courierRecords.id, input.id)),
    ).toHaveLength(1);
  });

  it("refuses couriers, missing attribution, handover inputs and malformed collections without writing", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    expect(
      (await record(shipment, { id: crypto.randomUUID(), kind: "pickup" }, ana.cookie)).status,
    ).toBe(403);
    expect((await record(shipment, { id: crypto.randomUUID(), kind: "pickup" })).status).toBe(422);
    await dispatched(shipment);
    expect(
      (await record(shipment, { id: crypto.randomUUID(), kind: "handover_confirmation" })).status,
    ).toBe(400);
    await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
    const bad = await record(shipment, {
      id: crypto.randomUUID(),
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: 1,
    });
    expect(bad.status).toBe(400);
    expect(
      await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.shipmentId, shipment.id)),
    ).toHaveLength(1);
  });
});
