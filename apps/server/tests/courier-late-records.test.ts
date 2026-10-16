import type { Handover, RouteDetail, Shipment, ShipmentDetail } from "@domy/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  courierNotices,
  courierRecords,
  handovers,
  routeStops,
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
let beto: CourierAccount;
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
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
  beto = await courierWithAccount(t, database.db, "Beto Gómez");
});
async function dispatched(courier: CourierAccount, shipment?: Shipment) {
  const filler = await registerShipment(t, cookie, catalog);
  const draft = await createRoute(t, cookie, {
    shipmentIds: [filler.id, ...(shipment ? [shipment.id] : [])],
    courierId: courier.id,
  });
  const response = await routeAction(t, cookie, draft, "/dispatch");
  expect(response.status).toBe(200);
  return response.body;
}
async function row(shipment: Shipment) {
  const [found] = await database.db.select().from(shipments).where(eq(shipments.id, shipment.id));
  if (!found) throw new Error("The fixture shipment is missing");
  return found;
}
async function detail(shipment: Shipment) {
  return (await send<ShipmentDetail>(t, cookie, `/api/shipments/${shipment.id}`)).body;
}
async function record(shipment: Shipment, input: Record<string, unknown>, courier = ana) {
  const response = await sendRecords(t, courier, [{ shipmentId: shipment.id, ...input }]);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body.results[0]?.outcome;
}
async function move(shipment: Shipment, route: RouteDetail) {
  const result = await send<{ handover: Handover | null }>(
    t,
    cookie,
    `/api/shipments/${shipment.id}/reassign`,
    { actionId: crypto.randomUUID(), toRouteId: route.id, reason: "Cambió el sector de entrega" },
  );
  expect(result.status).toBe(200);
  return result.body.handover;
}
async function pendingTasks(shipment: Shipment) {
  return database.db
    .select({ task: routeTasks, routeId: routeStops.routeId })
    .from(routeTasks)
    .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
    .where(and(eq(routeTasks.shipmentId, shipment.id), eq(routeTasks.status, "pending")));
}
async function removed() {
  const shipment = await registerShipment(t, cookie, catalog);
  const route = await dispatched(ana, shipment);
  expect((await routeAction(t, cookie, route, `/shipments/${shipment.id}/remove`)).status).toBe(
    200,
  );
  return { shipment, route };
}

/** US5/T062: FR-024–FR-026 facts from a stale phone use the current server state. */
describe("courier records after route changes", () => {
  it("restores the original return task, not a delivery, when its handover is cancelled (T116)", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const original = await dispatched(ana, shipment);
    await record(shipment, { kind: "pickup" });
    await record(shipment, { kind: "exception", reason: "recipient_absent" });
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
          actionId: crypto.randomUUID(),
          decision: "return",
          routeId: original.id,
        })
      ).status,
    ).toBe(200);
    const target = await dispatched(beto);
    const handover = await move(shipment, target);
    if (!handover) throw new Error("The return has no handover");
    expect(
      (
        await send(t, cookie, `/api/handovers/${handover.id}/cancel`, {
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(200);
    expect(
      (await pendingTasks(shipment)).map((row) => ({ routeId: row.routeId, kind: row.task.kind })),
    ).toEqual([{ routeId: original.id, kind: "return" }]);
    expect(await row(shipment)).toMatchObject({
      status: "exception",
      returnDecided: true,
      custodyCourierId: ana.id,
      routeId: original.id,
    });
  });
  it("keeps a removed shipment's late pickup off route, with custody, review and both times", async () => {
    const { shipment } = await removed();
    t.setNow("2026-10-01T15:30:00Z");
    expect(await record(shipment, { kind: "pickup", occurredAt: "2026-10-01T15:05:00Z" })).toBe(
      "applied",
    );
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: null,
      custodyCourierId: ana.id,
      needsReview: true,
    });
    expect((await snapshot(t, ana)).body.heldOffRoute).toEqual([
      expect.objectContaining({ shipmentId: shipment.id }),
    ]);
    const history = (await detail(shipment)).records;
    expect(history).toEqual([
      expect.objectContaining({
        kind: "pickup",
        outcome: "applied",
        occurredAt: "2026-10-01T15:05:00.000Z",
        recordedAt: "2026-10-01T15:30:00.000Z",
      }),
    ]);
  });

  it("creates a handover to the courier of the new route after a late pickup", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(ana, shipment);
    const target = await dispatched(beto);
    await move(shipment, target);
    expect(await record(shipment, { kind: "pickup" })).toBe("applied");
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: target.id,
      custodyCourierId: ana.id,
      needsReview: true,
    });
    const transfers = await database.db
      .select()
      .from(handovers)
      .where(eq(handovers.shipmentId, shipment.id));
    expect(transfers).toEqual([
      expect.objectContaining({
        status: "pending",
        fromCourierId: ana.id,
        toCourierId: beto.id,
        toRouteId: target.id,
      }),
    ]);
    expect(await pendingTasks(shipment)).toEqual([
      expect.objectContaining({
        routeId: target.id,
        task: expect.objectContaining({ kind: "delivery", blockedByHandoverId: transfers[0]?.id }),
      }),
    ]);
    expect((await snapshot(t, ana)).body.handoversToGive).toEqual([
      expect.objectContaining({
        shipmentId: shipment.id,
        toCourier: { id: beto.id, name: beto.name },
      }),
    ]);
  });

  it("removes a shipment from its new draft route when the original courier's pickup arrives", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(ana, shipment);
    const target = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
      courierId: beto.id,
    });
    await move(shipment, target);
    expect(await record(shipment, { kind: "pickup" })).toBe("applied");
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: null,
      custodyCourierId: ana.id,
      needsReview: true,
    });
    expect(await pendingTasks(shipment)).toEqual([]);
    expect(
      await database.db.select().from(handovers).where(eq(handovers.shipmentId, shipment.id)),
    ).toEqual([]);
  });

  it.each(["delivery", "exception", "return"] as const)(
    "applies the holder's late %s and removes the other courier's task and pending handover",
    async (kind) => {
      const shipment = await registerShipment(t, cookie, catalog);
      const original = await dispatched(ana, shipment);
      expect(await record(shipment, { kind: "pickup" })).toBe("applied");
      if (kind === "return") {
        expect(await record(shipment, { kind: "exception", reason: "recipient_absent" })).toBe(
          "applied",
        );
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
              actionId: crypto.randomUUID(),
              decision: "return",
              routeId: original.id,
            })
          ).status,
        ).toBe(200);
      }
      const target = await dispatched(beto);
      const pending = await move(shipment, target);
      if (!pending) throw new Error("The reassignment did not create a handover");
      expect(
        await record(shipment, {
          kind,
          ...(kind === "exception"
            ? { reason: "recipient_absent" }
            : { receivedByName: "Laura Gómez" }),
          ...(kind === "delivery" && { cashAmount: 50_000 }),
        }),
      ).toBe("applied");
      expect(await row(shipment)).toMatchObject({
        status: kind === "delivery" ? "delivered" : kind === "return" ? "returned" : "exception",
        needsReview: true,
        custodyCourierId: kind === "exception" ? ana.id : null,
      });
      expect(await pendingTasks(shipment)).toEqual([]);
      const [cancelled] = await database.db
        .select()
        .from(handovers)
        .where(eq(handovers.id, pending.id));
      expect(cancelled?.status).toBe("cancelled");
      expect((await snapshot(t, beto)).body.notices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "shipment_removed",
            trackingNumber: shipment.trackingNumber,
          }),
        ]),
      );
      expect((await snapshot(t, ana)).body.handoversToGive).toEqual([]);
    },
  );

  it("keeps an off-route disbursement and flags it for review", async () => {
    const { shipment } = await removed();
    expect(
      await record(shipment, { kind: "disbursement", amount: 12_000, payee: "Transportadora" }),
    ).toBe("applied");
    expect((await row(shipment)).needsReview).toBe(true);
    expect((await detail(shipment)).records).toEqual([
      expect.objectContaining({ kind: "disbursement", disbursementAmount: 12_000 }),
    ]);
  });

  it.each(["voided", "delivered", "returned", "not_in_custody"] as const)(
    "keeps a different courier's record without effect for %s and notifies only its author",
    async (state) => {
      const shipment = await registerShipment(t, cookie, catalog);
      const route = await dispatched(ana, shipment);
      if (state === "voided") {
        const stored = await row(shipment);
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/void`, {
              actionId: crypto.randomUUID(),
              version: stored.version,
              reason: "El cliente canceló el pedido",
            })
          ).status,
        ).toBe(200);
      } else {
        await record(shipment, { kind: "pickup" });
        if (state === "delivered")
          await record(shipment, {
            kind: "delivery",
            receivedByName: "Laura Gómez",
            cashAmount: 50_000,
          });
        if (state === "returned") {
          await record(shipment, { kind: "exception", reason: "recipient_absent" });
          expect(
            (
              await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
                actionId: crypto.randomUUID(),
                decision: "return",
                routeId: route.id,
              })
            ).status,
          ).toBe(200);
          await record(shipment, { kind: "return", receivedByName: "Ana Comercio" });
        }
      }
      const before = await row(shipment);
      const id = crypto.randomUUID();
      const input = { id, kind: "delivery", receivedByName: "Otra persona", cashAmount: 50_000 };
      for (let i = 0; i < 2; i++) expect(await record(shipment, input, beto)).toBe("not_applied");
      expect(await row(shipment)).toMatchObject({
        status: before.status,
        custodyCourierId: before.custodyCourierId,
        needsReview: true,
      });
      expect(
        await database.db.select().from(courierRecords).where(eq(courierRecords.id, id)),
      ).toEqual([expect.objectContaining({ outcome: "not_applied", courierId: beto.id })]);
      expect(
        await database.db
          .select()
          .from(courierNotices)
          .where(
            and(
              eq(courierNotices.shipmentId, shipment.id),
              eq(courierNotices.type, "record_not_applied"),
            ),
          ),
      ).toEqual([expect.objectContaining({ courierId: beto.id })]);
    },
  );

  it("treats the same courier's second phone delivery as a duplicate without raising a review flag", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(ana, shipment);
    await record(shipment, { kind: "pickup" });
    const delivery = { kind: "delivery", receivedByName: "Laura Gómez", cashAmount: 50_000 };
    expect(await record(shipment, delivery)).toBe("applied");
    expect(await record(shipment, delivery)).toBe("duplicate");
    expect((await row(shipment)).needsReview).toBe(false);
    expect((await detail(shipment)).attempts).toHaveLength(1);
    expect(
      await database.db
        .select()
        .from(courierNotices)
        .where(eq(courierNotices.type, "record_not_applied")),
    ).toEqual([]);
  });

  it("clears only the review flag with a note, remembers replays and preserves a later review", async () => {
    const { shipment } = await removed();
    await record(shipment, { kind: "disbursement", amount: 12_000, payee: "Transportadora" });
    const before = await row(shipment);
    const path = `/api/shipments/${shipment.id}/clear-review`;
    const payload = { actionId: crypto.randomUUID(), note: "Verificado con el mensajero" };
    const invalid = await send<{ error: { code: string; fields: Record<string, string> } }>(
      t,
      cookie,
      path,
      { ...payload, note: "abc" },
    );
    // The repository-wide validation contract is 400 invalid_request, not 422.
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatchObject({
      code: "invalid_request",
      fields: { note: expect.any(String) },
    });
    expect((await send(t, ana.cookie, path, payload)).status).toBe(403);
    const concurrent = await Promise.all([
      send(t, cookie, path, payload),
      send(t, cookie, path, payload),
    ]);
    expect(concurrent.map((result) => result.status)).toEqual([200, 200]);
    expect((await send(t, cookie, path, payload)).status).toBe(200);
    expect(await row(shipment)).toMatchObject({
      status: before.status,
      routeId: before.routeId,
      custodyCourierId: before.custodyCourierId,
      needsReview: false,
    });
    expect((await detail(shipment)).events.filter((e) => e.type === "review_cleared")).toHaveLength(
      1,
    );
    await record(shipment, { kind: "disbursement", amount: 5000, payee: "Transportadora" });
    expect((await send(t, cookie, path, payload)).status).toBe(200);
    expect((await row(shipment)).needsReview).toBe(true);
  });

  it("cancels a handover with no origin route, leaving the package off route with its holder", async () => {
    const { shipment } = await removed();
    await record(shipment, { kind: "pickup" });
    const target = await dispatched(beto);
    expect(
      (await routeAction(t, cookie, target, "/shipments", { shipmentIds: [shipment.id] })).status,
    ).toBe(200);
    const [pending] = await database.db
      .select()
      .from(handovers)
      .where(eq(handovers.shipmentId, shipment.id));
    expect(pending).toMatchObject({ fromRouteId: null, fromCourierId: ana.id });
    const payload = { actionId: crypto.randomUUID() };
    expect(
      (await send(t, cookie, `/api/handovers/${String(pending?.id)}/cancel`, payload)).status,
    ).toBe(200);
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: null,
      custodyCourierId: ana.id,
    });
    expect(await pendingTasks(shipment)).toEqual([]);
  });
});
