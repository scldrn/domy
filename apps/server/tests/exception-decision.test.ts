import { type RouteDetail, type Shipment, type ShipmentDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  courierRecords,
  handovers,
  routeTasks,
  shipmentEvents,
  shipments,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
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
  t = createTestApp(database.db);
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db);
});
async function row(shipment: Shipment) {
  const [stored] = await database.db.select().from(shipments).where(eq(shipments.id, shipment.id));
  if (!stored) throw new Error("The fixture shipment is missing");
  return stored;
}
const detail = async (shipment: Shipment) =>
  (await send<ShipmentDetail>(t, cookie, "/api/shipments/" + shipment.id)).body;
const decide = (shipment: Shipment, input: Record<string, unknown>) =>
  send<Shipment>(t, cookie, "/api/shipments/" + shipment.id + "/exception-decision", {
    actionId: crypto.randomUUID(),
    ...input,
  });
async function accepted(shipment: Shipment, input: Record<string, unknown>) {
  const response = await decide(shipment, input);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
}
/** Compare all persisted effects before/after a late retry (Constitution II and IV). */
async function effects(shipment: Shipment) {
  return {
    shipment: await row(shipment),
    tasks: await database.db
      .select()
      .from(routeTasks)
      .where(eq(routeTasks.shipmentId, shipment.id))
      .orderBy(routeTasks.id),
    handovers: await database.db
      .select()
      .from(handovers)
      .where(eq(handovers.shipmentId, shipment.id))
      .orderBy(handovers.id),
    events: await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipment.id))
      .orderBy(shipmentEvents.id),
  };
}
async function inProgress(courier = ana): Promise<RouteDetail> {
  const filler = await registerShipment(t, cookie, catalog);
  const created = await createRoute(t, cookie, { shipmentIds: [filler.id], courierId: courier.id });
  return (await routeAction(t, cookie, created, "/dispatch")).body;
}
async function exception(extra: Record<string, unknown> = {}) {
  const shipment = await registerShipment(t, cookie, catalog, extra);
  const filler = await registerShipment(t, cookie, catalog);
  const created = await createRoute(t, cookie, {
    shipmentIds: [shipment.id, filler.id],
    courierId: ana.id,
  });
  const route = (await routeAction(t, cookie, created, "/dispatch")).body;
  const recorded = await sendRecords(t, ana, [
    { shipmentId: shipment.id, kind: "pickup" },
    { shipmentId: shipment.id, kind: "exception", reason: "recipient_absent" },
  ]);
  expect(recorded.status).toBe(200);
  expect(recorded.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
  expect(await row(shipment)).toMatchObject({ status: "exception", custodyCourierId: ana.id });
  return { shipment, route };
}
const routeDetail = async (id: string) =>
  (await send<RouteDetail>(t, cookie, "/api/routes/" + id)).body;
const pending = (route: RouteDetail, shipment: Shipment) =>
  route.stops
    .flatMap((stop) => stop.tasks)
    .filter((task) => task.shipmentId === shipment.id && task.status === "pending");

/** US4 T053: decisions, custody, attempts and held-route boundaries (FR-029–FR-032). */
describe("exception decisions", () => {
  it("refuses undo-dispatch for a courier-held return on an otherwise pending route (T104)", async () => {
    const { shipment } = await exception();
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    const target = await inProgress(other);
    await accepted(shipment, { decision: "return", routeId: target.id });
    const response = await routeAction(t, cookie, await routeDetail(target.id), "/undo-dispatch", {
      reason: "Despachada por error",
    });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: "route_has_completed_stops" } });
    expect((await routeDetail(target.id)).status).toBe("in_progress");
    expect(await row(shipment)).toMatchObject({
      custodyCourierId: ana.id,
      status: "exception",
      returnDecided: true,
    });
  });
  it("keeps a decided return with its holder when the whole route passes to another courier (T103)", async () => {
    const { shipment, route } = await exception();
    await accepted(shipment, { decision: "return", routeId: route.id });
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    const response = await routeAction(t, cookie, await routeDetail(route.id), "/reassign", {
      courierId: other.id,
      reason: "Beatriz continúa la ruta",
    });
    expect(response.status).toBe(200);
    const view = await detail(shipment);
    expect(view.handover).toMatchObject({
      status: "pending",
      fromCourier: { id: ana.id },
      toCourier: { id: other.id },
    });
    expect(response.body.handovers.filter((h) => h.shipment.id === shipment.id)).toHaveLength(1);
    expect(pending(response.body, shipment)).toMatchObject([
      { kind: "return", blockedByHandoverId: view.handover?.id },
    ]);
    expect(await row(shipment)).toMatchObject({
      status: "exception",
      returnDecided: true,
      custodyCourierId: ana.id,
    });
  });
  it("adds a second delivery attempt on the same route without changing the fee", async () => {
    const { shipment, route } = await exception();
    expect((await decide(shipment, { decision: "new_attempt", routeId: route.id })).status).toBe(
      200,
    );
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: route.id,
      custodyCourierId: ana.id,
      fee: shipment.fee,
      returnDecided: false,
    });
    expect(pending(await routeDetail(route.id), shipment).map((task) => task.kind)).toEqual([
      "delivery",
    ]);
    t.setNow("2026-10-01T15:05:00Z");
    const delivered = await sendRecords(t, ana, [
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: shipment.codAmount,
      },
    ]);
    expect(delivered.status).toBe(200);
    expect(delivered.body.results).toMatchObject([{ outcome: "applied" }]);
    expect(await detail(shipment)).toMatchObject({
      status: "delivered",
      attempts: [
        expect.objectContaining({
          kind: "exception",
          courier: { id: ana.id, name: ana.name },
          exceptionReason: "recipient_absent",
          occurredAt: "2026-10-01T15:00:00.000Z",
        }),
        expect.objectContaining({
          kind: "delivery",
          courier: { id: ana.id, name: ana.name },
          occurredAt: "2026-10-01T15:05:00.000Z",
        }),
      ],
    });
  });
  it("adds an attempt to another courier's route with a blocking handover", async () => {
    const { shipment } = await exception();
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    const target = await inProgress(other);
    expect((await decide(shipment, { decision: "new_attempt", routeId: target.id })).status).toBe(
      200,
    );
    const view = await detail(shipment);
    expect(view.handover).toMatchObject({
      status: "pending",
      fromCourier: { id: ana.id },
      toCourier: { id: other.id },
    });
    expect(pending(await routeDetail(target.id), shipment)).toMatchObject([
      { blockedByHandoverId: expect.any(String) },
    ]);
    expect(await row(shipment)).toMatchObject({ custodyCourierId: ana.id, routeId: target.id });
  });
  it("reschedules off route and lists the actual holder on the selected date", async () => {
    const { shipment, route } = await exception();
    expect(
      (
        await decide(shipment, {
          decision: "new_attempt",
          serviceDate: "2026-10-02",
          routeId: route.id,
        })
      ).status,
    ).toBe(200);
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      routeId: null,
      serviceDate: "2026-10-02",
      custodyCourierId: ana.id,
    });
    const listed = await send(t, cookie, "/api/shipments/unassigned?date=2026-10-02");
    expect(listed.body).toMatchObject({
      shipments: expect.arrayContaining([
        expect.objectContaining({
          id: shipment.id,
          heldBy: { courier: { id: ana.id, name: ana.name } },
        }),
      ]),
    });
    expect(pending(await routeDetail(route.id), shipment)).toEqual([]);
  });
  it.each(["delivery", "reverse_pickup"] as const)(
    "returns a %s where it was actually picked up",
    async (kind) => {
      const { shipment, route } = await exception({ kind });
      expect((await decide(shipment, { decision: "return", routeId: route.id })).status).toBe(200);
      const current = await routeDetail(route.id);
      const returned = current.stops.find(
        (stop) =>
          stop.kind === "return" && stop.tasks.some((task) => task.shipmentId === shipment.id),
      );
      expect(returned?.address).toBe(
        kind === "reverse_pickup" ? shipment.recipientAddress : shipment.pickupAddress,
      );
      expect(await row(shipment)).toMatchObject({
        status: "exception",
        returnDecided: true,
        custodyCourierId: ana.id,
      });
      const problem = await sendRecords(t, ana, [
        { shipmentId: shipment.id, kind: "problem", note: "El cliente está cerrado" },
      ]);
      expect(problem.status).toBe(200);
      expect(problem.body.results).toMatchObject([{ outcome: "applied" }]);
      expect(await row(shipment)).toMatchObject({
        status: "exception",
        custodyCourierId: ana.id,
        returnDecided: true,
      });
      expect(
        await database.db.select().from(routeTasks).where(eq(routeTasks.shipmentId, shipment.id)),
      ).toContainEqual(
        expect.objectContaining({
          kind: "return",
          status: "pending",
          problemNote: "El cliente está cerrado",
        }),
      );
      const completed = await sendRecords(t, ana, [
        { shipmentId: shipment.id, kind: "return", receivedByName: "Persona del comercio" },
      ]);
      expect(completed.status).toBe(200);
      expect(completed.body.results).toMatchObject([{ outcome: "applied" }]);
      expect(await row(shipment)).toMatchObject({
        status: "returned",
        custodyCourierId: null,
        returnDecided: false,
      });
      const returnedRecords = await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.shipmentId, shipment.id));
      expect(returnedRecords.filter((record) => record.kind === "return")).toMatchObject([
        {
          cashAmount: 0,
          companyTransferAmount: 0,
          merchantTransferAmount: 0,
          receivedByName: "Persona del comercio",
          outcome: "applied",
        },
      ]);
    },
  );
  it("replaces a pending return with a new delivery, preserving the first attempt", async () => {
    const { shipment, route } = await exception();
    await accepted(shipment, { decision: "return", routeId: route.id });
    expect((await decide(shipment, { decision: "new_attempt", routeId: route.id })).status).toBe(
      200,
    );
    expect(pending(await routeDetail(route.id), shipment).map((task) => task.kind)).toEqual([
      "delivery",
    ]);
    expect(await detail(shipment)).toMatchObject({
      attempts: [expect.objectContaining({ kind: "exception" })],
    });
    expect(await row(shipment)).toMatchObject({ returnDecided: false, status: "picked_up" });
  });
  it("refuses non-exceptions and an already decided return without side effects", async () => {
    const registered = await registerShipment(t, cookie, catalog);
    const unchanged = await effects(registered);
    const response = await decide(registered, { decision: "new_attempt" });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: "no_exception_to_decide" } });
    expect(await effects(registered)).toEqual(unchanged);
    const { shipment, route } = await exception();
    await accepted(shipment, { decision: "return", routeId: route.id });
    const before = await effects(shipment);
    const refused = await decide(shipment, { decision: "return", routeId: route.id });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: "no_exception_to_decide" } });
    expect(pending(await routeDetail(route.id), shipment)).toHaveLength(1);
    expect(await effects(shipment)).toEqual(before);
  });
  it.each(["new_attempt", "return"] as const)(
    "remembers concurrent %s and a late replay after a different decision",
    async (decision) => {
      const { shipment, route } = await exception();
      const actionId = crypto.randomUUID();
      const input = { actionId, decision, routeId: route.id };
      const responses = await Promise.all([decide(shipment, input), decide(shipment, input)]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(pending(await routeDetail(route.id), shipment).map((task) => task.kind)).toEqual([
        decision === "return" ? "return" : "delivery",
      ]);
      expect(await row(shipment)).toMatchObject({ custodyCourierId: ana.id, fee: shipment.fee });
      expect(
        await database.db.select().from(handovers).where(eq(handovers.shipmentId, shipment.id)),
      ).toEqual([]);
      expect(
        await database.db
          .select()
          .from(shipmentEvents)
          .where(eq(shipmentEvents.clientEventId, actionId)),
      ).toHaveLength(1);
      if (decision === "new_attempt") {
        t.setNow("2026-10-01T15:05:00Z");
        const secondVisit = await sendRecords(t, ana, [
          { shipmentId: shipment.id, kind: "exception", reason: "wrong_address" },
        ]);
        expect(secondVisit.body.results).toMatchObject([{ outcome: "applied" }]);
        await accepted(shipment, { decision: "return", routeId: route.id });
      } else {
        await accepted(shipment, { decision: "new_attempt", routeId: route.id });
      }
      const before = await effects(shipment);
      const replay = await decide(shipment, input);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({
        id: shipment.id,
        status: before.shipment.status,
        version: before.shipment.version,
      });
      expect(await effects(shipment)).toEqual(before);
    },
  );
  it.each(["new_attempt", "return"] as const)(
    "creates only one blocked task and handover for concurrent %s on another courier's route",
    async (decision) => {
      const { shipment } = await exception();
      const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
      const target = await inProgress(other);
      const input = { actionId: crypto.randomUUID(), decision, routeId: target.id };
      const responses = await Promise.all([decide(shipment, input), decide(shipment, input)]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      const stored = await effects(shipment);
      expect(stored.handovers).toHaveLength(1);
      expect(stored.handovers[0]).toMatchObject({
        status: "pending",
        fromCourierId: ana.id,
        toCourierId: other.id,
      });
      expect(stored.tasks.filter((task) => task.status === "pending")).toMatchObject([
        {
          kind: decision === "return" ? "return" : "delivery",
          blockedByHandoverId: stored.handovers[0]?.id,
        },
      ]);
      expect(stored.events.filter((event) => event.clientEventId === input.actionId)).toHaveLength(
        1,
      );
      expect(stored.shipment).toMatchObject({ custodyCourierId: ana.id, fee: shipment.fee });
      expect((await decide(shipment, input)).status).toBe(200);
      expect(await effects(shipment)).toEqual(stored);
    },
  );
  it.each(["new_attempt", "return"] as const)(
    "refuses an off-route %s on a draft, then adds it to a route in progress without another pickup",
    async (decision) => {
      const { shipment } = await exception();
      await accepted(shipment, { decision });
      expect(await row(shipment)).toMatchObject({ routeId: null, custodyCourierId: ana.id });
      const refusedCreation = await send(t, cookie, "/api/routes", {
        id: crypto.randomUUID(),
        actionId: crypto.randomUUID(),
        serviceDate: "2026-10-01",
        shipmentIds: [shipment.id],
      });
      expect(refusedCreation.status).toBe(409);
      expect(refusedCreation.body).toMatchObject({ error: { code: "route_not_in_progress" } });
      const listed = await send(t, cookie, "/api/shipments/unassigned?date=2026-10-01");
      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({
        shipments: expect.arrayContaining([
          expect.objectContaining({
            id: shipment.id,
            heldBy: { courier: { id: ana.id, name: ana.name } },
          }),
        ]),
      });
      const filler = await registerShipment(t, cookie, catalog);
      const draft = await createRoute(t, cookie, { shipmentIds: [filler.id] });
      const refused = await routeAction(t, cookie, draft, "/shipments", {
        shipmentIds: [shipment.id],
      });
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ error: { code: "route_not_in_progress" } });
      const target = await inProgress(await courierWithAccount(t, database.db, "Beatriz Ruiz"));
      expect(
        (await routeAction(t, cookie, target, "/shipments", { shipmentIds: [shipment.id] })).status,
      ).toBe(200);
      expect(pending(await routeDetail(target.id), shipment).map((task) => task.kind)).toEqual([
        decision === "return" ? "return" : "delivery",
      ]);
      expect((await detail(shipment)).handover).toMatchObject({ status: "pending" });
    },
  );
  it.each(["new_attempt", "return"] as const)(
    "reassigns an off-route %s with a pending handover",
    async (decision) => {
      const { shipment } = await exception();
      await accepted(shipment, { decision });
      const target = await inProgress(await courierWithAccount(t, database.db, "Beatriz Ruiz"));
      const response = await send(t, cookie, "/api/shipments/" + shipment.id + "/reassign", {
        actionId: crypto.randomUUID(),
        version: (await row(shipment)).version,
        toRouteId: target.id,
        reason: "Beatriz continúa la entrega",
      });
      expect(response.status).toBe(200);
      expect((await detail(shipment)).handover).toMatchObject({
        status: "pending",
        fromRouteId: null,
      });
      expect(pending(await routeDetail(target.id), shipment)).toMatchObject([
        {
          kind: decision === "return" ? "return" : "delivery",
          blockedByHandoverId: expect.any(String),
        },
      ]);
      expect(await row(shipment)).toMatchObject({
        routeId: target.id,
        custodyCourierId: ana.id,
        fee: shipment.fee,
      });
    },
  );
  it("excludes reverted and non-applied records from delivery attempts", async () => {
    const { shipment } = await exception();
    const notApplied = await sendRecords(t, ana, [
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: shipment.codAmount,
      },
    ]);
    expect(notApplied.status).toBe(200);
    expect(notApplied.body.results).toMatchObject([{ outcome: "not_applied" }]);
    const record = (
      await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.shipmentId, shipment.id))
    ).find((record) => record.kind === "exception");
    if (!record) throw new Error("The fixture exception is missing");
    await database.db
      .update(courierRecords)
      .set({ revertedAt: t.now(), revertedBy: ana.userId, revertReason: "Fixture for future US6" })
      .where(eq(courierRecords.id, record.id));
    expect(await detail(shipment)).toMatchObject({ attempts: [] });
  });
  it("refuses courier access to the dispatch decision", async () => {
    const { shipment } = await exception();
    const response = await send(
      t,
      ana.cookie,
      "/api/shipments/" + shipment.id + "/exception-decision",
      { actionId: crypto.randomUUID(), decision: "return" },
    );
    expect(response.status).toBe(403);
  });
});
