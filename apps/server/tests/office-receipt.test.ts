import type { CompanySettings, RouteDetail, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, companySettings, shipmentEvents, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: string;
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
  const account = await t.signIn("owner");
  owner = account.cookie;
  catalog = await createCatalog(database.db, account.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db);
});
const office = {
  officeAddress: "Carrera 90 # 65C-10",
  officeNeighborhoodId: () => catalog.place.estadio,
};
const configure = (values: Record<string, unknown> = {}) =>
  send<CompanySettings>(
    t,
    owner,
    "/api/settings",
    {
      actionId: crypto.randomUUID(),
      officeAddress: office.officeAddress,
      officeNeighborhoodId: office.officeNeighborhoodId(),
      ...values,
    },
    "PATCH",
  );
async function row(shipment: Shipment) {
  const [stored] = await database.db.select().from(shipments).where(eq(shipments.id, shipment.id));
  if (!stored) throw new Error("The fixture shipment is missing");
  return stored;
}
/** Receipt tests isolate the office fixture from the settings endpoint under test above. */
const configured = () =>
  database.db.insert(companySettings).values({
    officeAddress: office.officeAddress,
    officeNeighborhoodId: office.officeNeighborhoodId(),
  });
const receive = (shipment: Shipment, actionId = crypto.randomUUID()) =>
  send<Shipment>(t, cookie, "/api/shipments/" + shipment.id + "/office-receipt", { actionId });
async function decide(shipment: Shipment, input: Record<string, unknown>) {
  const response = await send<Shipment>(
    t,
    cookie,
    "/api/shipments/" + shipment.id + "/exception-decision",
    { actionId: crypto.randomUUID(), ...input },
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response;
}
async function exception(overrides: Record<string, unknown> = {}) {
  const shipment = await registerShipment(t, cookie, catalog, overrides);
  const filler = await registerShipment(t, cookie, catalog);
  const created = await createRoute(t, cookie, {
    shipmentIds: [shipment.id, filler.id],
    courierId: ana.id,
  });
  const dispatched = await routeAction(t, cookie, created, "/dispatch");
  expect(dispatched.status).toBe(200);
  const route = dispatched.body;
  const records = await sendRecords(t, ana, [
    { shipmentId: shipment.id, kind: "pickup" },
    { shipmentId: shipment.id, kind: "exception", reason: "recipient_absent" },
  ]);
  expect(records.status).toBe(200);
  expect(records.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
  return { shipment, route };
}
const routeDetail = async (id: string) =>
  (await send<RouteDetail>(t, cookie, "/api/routes/" + id)).body;

/** US4 T054: office custody, configured pickup and auditable settings (FR-041). */
describe("company office settings", () => {
  it("returns empty settings, lets only the owner set them, and records the change", async () => {
    for (const roleCookie of [owner, cookie]) {
      const empty = await send<CompanySettings>(t, roleCookie, "/api/settings");
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({
        officeAddress: null,
        officeNeighborhood: null,
        supportPhone: null,
        companyName: "Cohex",
      });
    }
    const changed = await configure();
    expect(changed.status).toBe(200);
    expect(changed.body).toEqual({
      officeAddress: office.officeAddress,
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: null,
      companyName: "Cohex",
    });
    expect(
      (
        await send(
          t,
          cookie,
          "/api/settings",
          {
            actionId: crypto.randomUUID(),
            officeAddress: "Otra dirección",
            officeNeighborhoodId: catalog.place.estadio,
          },
          "PATCH",
        )
      ).status,
    ).toBe(403);
    expect((await send(t, ana.cookie, "/api/settings")).status).toBe(403);
    expect(
      (
        await send(
          t,
          ana.cookie,
          "/api/settings",
          {
            actionId: crypto.randomUUID(),
            officeAddress: office.officeAddress,
            officeNeighborhoodId: catalog.place.estadio,
          },
          "PATCH",
        )
      ).status,
    ).toBe(403);
    expect(
      await database.db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityType, "company_settings")),
    ).toEqual([
      expect.objectContaining({
        action: "updated",
        changes: {
          officeAddress: [null, office.officeAddress],
          officeNeighborhoodId: [null, catalog.place.estadio],
        },
      }),
    ]);
  });
  it("returns null fields when the unconfigured singleton row already exists", async () => {
    await database.db.insert(companySettings).values({});
    const response = await send<CompanySettings>(t, owner, "/api/settings");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: null,
      companyName: "Cohex",
    });
  });
  it.each([true, false])(
    "remembers settings retries without undoing later settings (unchanged: %s)",
    async (unchanged) => {
      await configured();
      const actionId = crypto.randomUUID();
      const input = {
        actionId,
        officeAddress: unchanged ? office.officeAddress : "Carrera 80 # 20-10",
      };
      const responses = await Promise.all([configure(input), configure(input)]);
      expect(responses.map((result) => result.status)).toEqual([200, 200]);
      expect((await configure({ officeAddress: "Calle 30 # 10-20" })).status).toBe(200);
      const before = await database.db.select().from(companySettings);
      const replay = await configure(input);
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual({
        officeAddress: "Calle 30 # 10-20",
        officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
        supportPhone: null,
        companyName: "Cohex",
      });
      expect(await database.db.select().from(companySettings)).toEqual(before);
      expect(
        await database.db.select().from(auditEvents).where(eq(auditEvents.clientEventId, actionId)),
      ).toHaveLength(1);
    },
  );
  it("rejects malformed and unknown office neighborhoods without changing settings", async () => {
    expect((await configure({ officeAddress: "abc" })).status).toBe(400);
    expect((await configure({ officeNeighborhoodId: crypto.randomUUID() })).status).toBe(400);
    expect(await database.db.select().from(companySettings)).toEqual([]);
  });
});
describe("receipt at the office", () => {
  it.each(["delivery", "reverse_pickup"] as const)(
    "returns to the first physical pickup after office receipt and a %s address edit (T105)",
    async (kind) => {
      await configured();
      const { shipment } = await exception({ kind });
      expect((await receive(shipment)).status).toBe(200);
      await decide(shipment, { decision: "new_attempt" });
      const current = await row(shipment);
      const edited = await send<Shipment>(
        t,
        cookie,
        "/api/shipments/" + shipment.id,
        {
          actionId: crypto.randomUUID(),
          version: current.version,
          ...(kind === "delivery"
            ? {
                pickupPointId: null,
                pickupAddress: "Calle 55 # 20-30",
                pickupNeighborhoodId: catalog.place.laureles,
              }
            : {
                recipientAddress: "Calle 55 # 20-30",
                recipientNeighborhoodId: catalog.place.laureles,
              }),
        },
        "PATCH",
      );
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
      const filler = await registerShipment(t, cookie, catalog);
      const draft = await createRoute(t, cookie, {
        shipmentIds: [shipment.id, filler.id],
        courierId: other.id,
      });
      expect((await routeAction(t, cookie, draft, "/dispatch")).status).toBe(200);
      const records = await sendRecords(t, other, [
        { shipmentId: shipment.id, kind: "pickup" },
        { shipmentId: shipment.id, kind: "exception", reason: "recipient_absent" },
      ]);
      expect(records.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
      await decide(shipment, { decision: "return", routeId: draft.id });
      const stops = (await routeDetail(draft.id)).stops;
      const returned = stops.find((stop) =>
        stop.tasks.some((task) => task.shipmentId === shipment.id && task.kind === "return"),
      );
      expect(returned?.address).toBe(
        kind === "delivery" ? shipment.pickupAddress : shipment.recipientAddress,
      );
      expect(
        (await row(shipment))[kind === "delivery" ? "pickupAddress" : "recipientAddress"],
      ).toBe("Calle 55 # 20-30");
    },
  );
  it.each(["remove", "cancel", "undo"] as const)(
    "preserves an office-held return through route %s (T104)",
    async (action) => {
      await configured();
      const { shipment } = await exception();
      expect((await receive(shipment)).status).toBe(200);
      await decide(shipment, { decision: "return" });
      const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
      let route = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: other.id });
      if (action === "undo") {
        route = (await routeAction(t, cookie, route, "/dispatch")).body;
        const undone = await routeAction(t, cookie, route, "/undo-dispatch", {
          reason: "Despachada por error",
        });
        expect(undone.status).toBe(200);
        expect(undone.body.status).toBe("draft");
        expect(await row(shipment)).toMatchObject({
          routeId: route.id,
          status: "exception",
          returnDecided: true,
          heldAtOffice: true,
        });
        route = undone.body;
      }
      const released = await routeAction(
        t,
        cookie,
        route,
        action === "remove" ? `/shipments/${shipment.id}/remove` : "/cancel",
        { reason: "Preparación corregida" },
      );
      expect(released.status).toBe(200);
      expect(await row(shipment)).toMatchObject({
        routeId: null,
        status: "exception",
        returnDecided: true,
        heldAtOffice: true,
        custodyCourierId: null,
      });
      const unassigned = await send(t, cookie, "/api/shipments/unassigned?date=2026-10-01");
      expect(unassigned.body).toMatchObject({
        shipments: expect.arrayContaining([
          expect.objectContaining({ id: shipment.id, heldBy: "office" }),
        ]),
      });
      expect((await routeDetail(route.id)).stops).toEqual([]);
    },
  );
  it("takes an office-held return onto a new route in preparation, retaining its office pickup", async () => {
    await configured();
    const { shipment } = await exception();
    expect((await receive(shipment)).status).toBe(200);
    await decide(shipment, { decision: "return" });
    const draft = await createRoute(t, cookie, { shipmentIds: [shipment.id] });
    expect(draft.status).toBe("draft");
    expect(draft.stops.map((stop) => stop.kind)).toEqual(["pickup", "return"]);
    expect(draft.stops[0]?.address).toBe(office.officeAddress);
    expect(draft.stops[1]?.address).toBe(shipment.pickupAddress);
    expect(await row(shipment)).toMatchObject({
      status: "exception",
      heldAtOffice: true,
      returnDecided: true,
      routeId: draft.id,
    });
  });
  it("requires a configured office and actual courier custody", async () => {
    const { shipment } = await exception();
    const missing = await receive(shipment);
    expect(missing.status).toBe(409);
    expect(missing.body).toMatchObject({ error: { code: "office_not_configured" } });
    expect(await row(shipment)).toMatchObject({ custodyCourierId: ana.id, heldAtOffice: false });
    await configured();
    const registered = await registerShipment(t, cookie, catalog);
    const refused = await receive(registered);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { code: "not_held_by_courier" } });
    expect(
      (
        await send(t, ana.cookie, "/api/shipments/" + shipment.id + "/office-receipt", {
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(403);
  });
  it("takes custody after an exception, preserving its status and recording the office", async () => {
    await configured();
    const { shipment } = await exception();
    expect((await receive(shipment)).status).toBe(200);
    expect(await row(shipment)).toMatchObject({
      status: "exception",
      custodyCourierId: null,
      heldAtOffice: true,
    });
    expect(
      await database.db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, shipment.id)),
    ).toContainEqual(
      expect.objectContaining({
        type: "office_received",
        changes: expect.objectContaining({
          custodyCourierId: [ana.id, null],
          heldAtOffice: [false, true],
        }),
      }),
    );
  });
  it("registers an off-route new attempt at the office, then picks it up from there", async () => {
    await configured();
    const { shipment } = await exception();
    await decide(shipment, { decision: "new_attempt", serviceDate: "2026-10-02" });
    expect((await receive(shipment)).status).toBe(200);
    expect(await row(shipment)).toMatchObject({
      status: "registered",
      routeId: null,
      serviceDate: "2026-10-02",
      custodyCourierId: null,
      heldAtOffice: true,
    });
    const created = await createRoute(t, cookie, {
      serviceDate: "2026-10-02",
      shipmentIds: [shipment.id],
      courierId: ana.id,
    });
    expect(created.stops[0]).toMatchObject({ kind: "pickup", address: office.officeAddress });
    // A second courier takes tomorrow's route while the first route remains in progress.
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    const assigned = await routeAction(t, cookie, created, "", { courierId: other.id }, "PATCH");
    expect(assigned.status).toBe(200);
    t.setNow("2026-10-02T15:00:00Z");
    expect((await routeAction(t, cookie, assigned.body, "/dispatch")).status).toBe(200);
    await sendRecords(
      t,
      other,
      [{ shipmentId: shipment.id, kind: "pickup" }],
      t.now().toISOString(),
    );
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      custodyCourierId: other.id,
      heldAtOffice: false,
    });
    expect(
      await database.db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, shipment.id)),
    ).toContainEqual(
      expect.objectContaining({
        changes: expect.objectContaining({
          heldAtOffice: [true, false],
          custodyCourierId: [null, other.id],
        }),
      }),
    );
  });
  it("returns an office-held exception through an office pickup before its return", async () => {
    await configured();
    const { shipment, route } = await exception();
    expect((await receive(shipment)).status).toBe(200);
    expect((await decide(shipment, { decision: "return", routeId: route.id })).status).toBe(200);
    const planned = (await routeDetail(route.id)).stops.filter((stop) =>
      stop.tasks.some((task) => task.shipmentId === shipment.id && task.status === "pending"),
    );
    expect(planned.map((stop) => stop.kind)).toEqual(["pickup", "return"]);
    expect(planned[0]?.address).toBe(office.officeAddress);
    expect(planned[1]?.address).toBe(shipment.pickupAddress);
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      { shipmentId: shipment.id, kind: "return", receivedByName: "Persona del comercio" },
    ]);
    expect(await row(shipment)).toMatchObject({
      status: "returned",
      heldAtOffice: false,
      custodyCourierId: null,
    });
  });
  it("adds the office pickup if custody is received after the return was already decided", async () => {
    await configured();
    const { shipment, route } = await exception();
    await decide(shipment, { decision: "return", routeId: route.id });
    expect((await receive(shipment)).status).toBe(200);
    const planned = (await routeDetail(route.id)).stops.filter((stop) =>
      stop.tasks.some((task) => task.shipmentId === shipment.id && task.status === "pending"),
    );
    expect(planned.map((stop) => stop.kind)).toEqual(["pickup", "return"]);
    expect(planned[0]?.address).toBe(office.officeAddress);
  });
  it("refuses receipt of a picked-up package that is still on a route", async () => {
    await configured();
    const { shipment, route } = await exception();
    await decide(shipment, { decision: "new_attempt", routeId: route.id });
    const response = await receive(shipment);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: "not_held_by_courier" } });
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      custodyCourierId: ana.id,
      heldAtOffice: false,
      routeId: route.id,
    });
  });
  it("replays concurrent receipts once and cannot take custody back after an office pickup", async () => {
    await configured();
    const { shipment, route } = await exception();
    const actionId = crypto.randomUUID();
    expect(
      (await Promise.all([receive(shipment, actionId), receive(shipment, actionId)])).map(
        (result) => result.status,
      ),
    ).toEqual([200, 200]);
    await decide(shipment, { decision: "new_attempt", routeId: route.id });
    const pickup = await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }]);
    expect(pickup.body.results).toMatchObject([{ outcome: "applied" }]);
    const before = await row(shipment);
    const replay = await receive(shipment, actionId);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      status: "picked_up",
      heldAtOffice: false,
      version: before.version,
    });
    expect(await row(shipment)).toEqual(before);
    expect(await row(shipment)).toMatchObject({
      status: "picked_up",
      heldAtOffice: false,
      custodyCourierId: ana.id,
    });
    expect(
      await database.db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.clientEventId, actionId)),
    ).toHaveLength(1);
  });
});
