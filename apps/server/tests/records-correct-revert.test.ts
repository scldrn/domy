import {
  daySummary,
  type CourierRecord,
  type RouteDetail,
  type ShipmentDetail,
} from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  courierRecords,
  handovers,
  courierNotices,
  routeTasks,
  routeEvents,
  routes,
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
const detail = async (id: string) =>
  (await send<ShipmentDetail>(t, cookie, `/api/shipments/${id}`)).body;
const routeDetail = async (id: string) =>
  (await send<RouteDetail>(t, cookie, `/api/routes/${id}`)).body;
const correct = (id: string, values: Record<string, unknown>, as = cookie) =>
  send<CourierRecord>(t, as, `/api/courier-records/${id}/correct`, {
    actionId: crypto.randomUUID(),
    reason: "Corregido con el mensajero",
    ...values,
  });
const revert = (id: string, values: Record<string, unknown> = {}, as = cookie) =>
  send<ShipmentDetail>(t, as, `/api/courier-records/${id}/revert`, {
    actionId: crypto.randomUUID(),
    reason: "Registrado por equivocación",
    ...values,
  });
async function fixture(
  kind: "delivery" | "exception" | "return" | "disbursement" = "delivery",
  options: { errand?: boolean; finish?: boolean } = {},
) {
  const shipment = await registerShipment(
    t,
    cookie,
    catalog,
    options.errand
      ? {
          kind: "errand",
          errandDescription: "Radicar documentos",
          paymentMode: "merchant_account",
          codAmount: 0,
          feeOverrideReason: "Tarifa acordada para diligencia",
        }
      : {},
  );
  const filler = options.finish ? null : await registerShipment(t, cookie, catalog);
  const created = await createRoute(t, cookie, {
    courierId: ana.id,
    shipmentIds: [shipment.id, ...(filler ? [filler.id] : [])],
  });
  const route = (await routeAction(t, cookie, created, "/dispatch")).body;
  if (!options.errand) {
    expect(
      (await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "pickup" }])).body.results,
    ).toMatchObject([{ outcome: "applied" }]);
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
  const recorded = await sendRecords(t, ana, [
    {
      id,
      shipmentId: shipment.id,
      kind,
      ...(kind === "delivery" && {
        receivedByName: "Laura Gómez",
        cashAmount: options.errand ? 0 : 50000,
      }),
      ...(kind === "exception" && { reason: "recipient_absent" }),
      ...(kind === "return" && { receivedByName: "Persona del comercio" }),
      ...(kind === "disbursement" && { amount: 12000, payee: "Transportadora" }),
    },
  ]);
  expect(recorded.status).toBe(200);
  expect(recorded.body.results).toEqual([{ id, outcome: "applied" }]);
  return { shipment, route, id };
}
async function effects(shipmentId: string) {
  return {
    shipment: await database.db.select().from(shipments).where(eq(shipments.id, shipmentId)),
    records: await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.shipmentId, shipmentId))
      .orderBy(courierRecords.id),
    tasks: await database.db
      .select()
      .from(routeTasks)
      .where(eq(routeTasks.shipmentId, shipmentId))
      .orderBy(routeTasks.id),
    events: await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipmentId))
      .orderBy(shipmentEvents.id),
    notices: await database.db.select().from(courierNotices).orderBy(courierNotices.id),
    handovers: await database.db
      .select()
      .from(handovers)
      .where(eq(handovers.shipmentId, shipmentId))
      .orderBy(handovers.id),
    routes: await database.db.select().from(routes).orderBy(routes.id),
    routeEvents: await database.db.select().from(routeEvents).orderBy(routeEvents.id),
  };
}
const pending = (route: RouteDetail, shipmentId: string) =>
  route.stops
    .flatMap((stop) => stop.tasks)
    .filter((task) => task.shipmentId === shipmentId && task.status === "pending");

/** T072 / FR-035: corrections preserve facts and financial/custody reversions are atomic. */
describe("record corrections", () => {
  it("remembers a changed concurrent correction and returns its original target even on another URL", async () => {
    const { shipment, id } = await fixture();
    const values = { actionId: crypto.randomUUID(), receivedByName: "Nombre confirmado" };
    const before = await effects(shipment.id);
    expect(
      (await Promise.all([correct(id, values), correct(id, values)])).map(
        (response) => response.status,
      ),
    ).toEqual([200, 200]);
    const changed = await effects(shipment.id);
    expect(changed.events.filter((event) => event.clientEventId === values.actionId)).toHaveLength(
      1,
    );
    expect(changed.notices).toHaveLength(before.notices.length + 1);
    await correct(id, { receivedByName: "Nombre revisado otra vez" });
    const disbursementId = crypto.randomUUID();
    await sendRecords(t, ana, [
      {
        id: disbursementId,
        shipmentId: shipment.id,
        kind: "disbursement",
        amount: 10000,
        payee: "Transportadora",
      },
    ]);
    const current = await effects(shipment.id);
    expect((await correct(disbursementId, values)).body).toMatchObject({
      id,
      receivedByName: "Nombre revisado otra vez",
    });
    expect(await effects(shipment.id)).toEqual(current);
  });
  it.each([
    [
      "delivery",
      {
        receivedByName: "Persona correcta",
        cashAmount: 20000,
        companyTransferAmount: 20000,
        merchantTransferAmount: 10000,
        note: "Cobro repartido en tres medios",
      },
    ],
    [
      "exception",
      { exceptionReason: "wrong_address", note: "La dirección indicada era incorrecta" },
    ],
    ["return", { receivedByName: "Persona correcta" }],
    [
      "disbursement",
      { amount: 13000, payee: "Transportadora correcta", note: "Valor confirmado del pago" },
    ],
  ] as const)(
    "corrects every applicable field of %s with old/new values and a notice",
    async (kind, fields) => {
      const { shipment, id } = await fixture(kind);
      const before = await detail(shipment.id);
      const old = before.records.find((record) => record.id === id);
      if (!old) throw new Error("Missing fixture record");
      const changed = await correct(id, fields);
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);
      const expected =
        "amount" in fields
          ? { disbursementAmount: fields.amount, payee: fields.payee, note: fields.note }
          : fields;
      expect(changed.body).toMatchObject({
        ...expected,
        author: { id: ana.userId },
        courier: { id: ana.id },
        onBehalf: false,
      });
      const after = await detail(shipment.id);
      const event = after.events.findLast((event) => event.type === "record_corrected");
      expect(event).toMatchObject({
        actor: { id: authorId },
        reason: "Corregido con el mensajero",
      });
      for (const [field, value] of Object.entries(expected)) {
        expect(event?.changes?.[field]).toEqual([old[field as keyof CourierRecord], value]);
      }
      expect(after.status).toBe(before.status);
      expect((await effects(shipment.id)).notices).toContainEqual(
        expect.objectContaining({ courierId: ana.id, type: "record_corrected" }),
      );
    },
  );
  it("rejects missing reasons, irrelevant fields, incomplete collection corrections and courier access without writing", async () => {
    const { shipment, id } = await fixture();
    const before = await effects(shipment.id);
    for (const values of [
      { reason: "", receivedByName: "Otra persona" },
      { exceptionReason: "wrong_address" },
      { amount: 10000 },
      { cashAmount: 1 },
    ]) {
      expect((await correct(id, values)).status).toBe(400);
    }
    expect((await correct(id, { receivedByName: "Otra persona" }, ana.cookie)).status).toBe(403);
    expect((await revert(id, {}, ana.cookie)).status).toBe(403);
    expect(await effects(shipment.id)).toEqual(before);
  });
  it("remembers an unchanged correction once, hides its receipt and does not undo a later edit", async () => {
    const { shipment, id } = await fixture();
    const before = await detail(shipment.id);
    const notices = (await effects(shipment.id)).notices;
    const values = { actionId: crypto.randomUUID(), receivedByName: "Laura Gómez" };
    const repeated = await Promise.all([correct(id, values), correct(id, values)]);
    expect(repeated.map((response) => response.status)).toEqual([200, 200]);
    expect((await detail(shipment.id)).events).toEqual(before.events);
    expect((await effects(shipment.id)).notices).toEqual(notices);
    expect(
      (await effects(shipment.id)).events.filter(
        (event) => event.clientEventId === values.actionId,
      ),
    ).toMatchObject([{ changes: {} }]);
    expect((await correct(id, { receivedByName: "Nombre confirmado" })).status).toBe(200);
    const changed = await effects(shipment.id);
    expect((await correct(id, values)).body).toMatchObject({
      id,
      receivedByName: "Nombre confirmado",
    });
    expect(await effects(shipment.id)).toEqual(changed);
    expect((await revert(id)).status).toBe(200);
    const reverted = await effects(shipment.id);
    expect((await correct(id, values)).body.reverted).not.toBeNull();
    expect(await effects(shipment.id)).toEqual(reverted);
  });
});

describe("record reversions", () => {
  it.each(["delivery", "exception", "return"] as const)(
    "preserves a later whole-route dispatch decision after %s",
    async (kind) => {
      const { shipment, route, id } = await fixture(kind);
      const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
      expect(
        (
          await routeAction(t, cookie, await routeDetail(route.id), "/reassign", {
            courierId: other.id,
            reason: "Beatriz continúa la ruta",
          })
        ).status,
      ).toBe(200);
      const before = await effects(shipment.id);
      expect((await revert(id)).status).toBe(409);
      expect(await effects(shipment.id)).toEqual(before);
      expect((await routeDetail(route.id)).courier?.id).toBe(other.id);
    },
  );
  it("serializes office receipt against reversion without mixed custody or orphan tasks", async () => {
    const { shipment, id } = await fixture("exception");
    await send(
      t,
      ownerCookie,
      "/api/settings",
      {
        actionId: crypto.randomUUID(),
        officeAddress: "Carrera 90 # 65C-10",
        officeNeighborhoodId: catalog.place.laureles,
      },
      "PATCH",
    );
    const [receipt, reverted] = await Promise.all([
      send(t, cookie, `/api/shipments/${shipment.id}/office-receipt`, {
        actionId: crypto.randomUUID(),
      }),
      revert(id),
    ]);
    expect([receipt.status, reverted.status].sort()).toEqual([200, 409]);
    const stored = await effects(shipment.id);
    expect(stored.shipment).toMatchObject([
      receipt.status === 200
        ? { status: "exception", heldAtOffice: true, custodyCourierId: null }
        : { status: "picked_up", heldAtOffice: false, custodyCourierId: ana.id },
    ]);
    expect(stored.records.find((record) => record.id === id)?.revertedAt !== null).toBe(
      reverted.status === 200,
    );
    expect(stored.tasks.filter((task) => task.status === "pending")).toHaveLength(
      reverted.status === 200 ? 1 : 0,
    );
    expect(stored.events.filter((event) => event.type === "record_reverted")).toHaveLength(
      reverted.status === 200 ? 1 : 0,
    );
    expect(stored.notices.filter((notice) => notice.type === "record_reverted")).toHaveLength(
      reverted.status === 200 ? 1 : 0,
    );
  });
  it("never reclaims custody after a confirmed handover", async () => {
    const { shipment, id } = await fixture("exception");
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    const filler = await registerShipment(t, cookie, catalog);
    const created = await createRoute(t, cookie, { shipmentIds: [filler.id], courierId: other.id });
    const target = (await routeAction(t, cookie, created, "/dispatch")).body;
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
          actionId: crypto.randomUUID(),
          decision: "new_attempt",
          routeId: target.id,
        })
      ).status,
    ).toBe(200);
    const waiting = (await detail(shipment.id)).handover;
    if (!waiting) throw new Error("Missing fixture handover");
    expect(
      (
        await send(t, cookie, `/api/handovers/${waiting.id}/confirm`, {
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(200);
    const before = await effects(shipment.id);
    expect(before.shipment).toMatchObject([{ custodyCourierId: other.id }]);
    expect((await revert(id)).status).toBe(409);
    expect(await effects(shipment.id)).toEqual(before);
  });
  it.each(["delivery", "exception", "return"] as const)(
    "reverts %s and restores one task/custody, keeping the record and reason",
    async (kind) => {
      const { shipment, route, id } = await fixture(kind);
      const beforeTasks = (await effects(shipment.id)).tasks;
      const taskKind = kind === "return" ? "return" : "delivery";
      const original = beforeTasks.findLast((task) => task.kind === taskKind);
      const response = await revert(id);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(await detail(shipment.id)).toMatchObject({
        status: kind === "return" ? "exception" : "picked_up",
        returnDecided: kind === "return",
        custodyCourier: { id: ana.id },
        heldAtOffice: false,
      });
      expect(pending(await routeDetail(route.id), shipment.id)).toMatchObject([
        { id: original?.id, kind: taskKind },
      ]);
      expect((await effects(shipment.id)).tasks).toHaveLength(beforeTasks.length);
      const [routeEvent] = await database.db
        .select()
        .from(routeEvents)
        .where(eq(routeEvents.routeId, route.id))
        .orderBy(routeEvents.id)
        .then((events) => events.filter((event) => event.type === "record_reverted"));
      expect(routeEvent).toMatchObject({
        shipmentId: shipment.id,
        actorUserId: authorId,
        reason: "Registrado por equivocación",
        occurredAt: t.now(),
        recordedAt: t.now(),
      });
      const event = (await detail(shipment.id)).events.findLast(
        (event) => event.type === "record_reverted",
      );
      if (kind === "exception") expect(event?.changes).not.toHaveProperty("custodyCourierId");
      expect(event?.changes).not.toHaveProperty("heldAtOffice");
      const view = await detail(shipment.id);
      expect(view.records.find((record) => record.id === id)?.reverted).toMatchObject({
        by: { id: authorId },
        reason: "Registrado por equivocación",
      });
      expect(view.attempts.some((attempt) => attempt.id === id)).toBe(false);
      const summary = daySummary(
        view.records.map((record) => ({
          ...record,
          reverted: record.reverted !== null,
          occurredAt: new Date(record.occurredAt),
          disbursementAmount: record.disbursementAmount ?? 0,
        })),
        { date: "2026-10-01", pendingStops: 1 },
      );
      expect(summary.cash).toBe(0);
      expect(summary.deliveries).toBe(0);
      expect((await effects(shipment.id)).notices).toContainEqual(
        expect.objectContaining({ type: "record_reverted", courierId: ana.id }),
      );
    },
  );
  it("keeps a finished route finished and the reverted package off route with its holder", async () => {
    const { shipment, route, id } = await fixture("delivery", { finish: true });
    expect((await routeDetail(route.id)).status).toBe("finished");
    expect((await revert(id, {}, ownerCookie)).status).toBe(200);
    expect((await effects(shipment.id)).shipment).toMatchObject([
      { routeId: null, custodyCourierId: ana.id, status: "picked_up" },
    ]);
    expect((await routeDetail(route.id)).status).toBe("finished");
    expect(pending(await routeDetail(route.id), shipment.id)).toEqual([]);
    expect(
      (await routeDetail(route.id)).events.some((event) => event.type === "record_reverted"),
    ).toBe(false);
  });
  it.each([false, true])(
    "restores an errand without custody, original route finished=%s",
    async (finish) => {
      const { shipment, route, id } = await fixture("delivery", { errand: true, finish });
      expect((await revert(id)).status).toBe(200);
      expect((await effects(shipment.id)).shipment).toMatchObject([
        {
          status: finish ? "registered" : "dispatched",
          routeId: finish ? null : route.id,
          custodyCourierId: null,
          heldAtOffice: false,
          serviceDate: "2026-10-01",
        },
      ]);
      expect(pending(await routeDetail(route.id), shipment.id)).toHaveLength(finish ? 0 : 1);
      const event = (await detail(shipment.id)).events.findLast(
        (event) => event.type === "record_reverted",
      );
      expect(event?.changes).not.toHaveProperty("custodyCourierId");
      expect(event?.changes).not.toHaveProperty("heldAtOffice");
      if (!finish) {
        expect(pending(await routeDetail(route.id), shipment.id)[0]?.kind).toBe("errand");
        expect(
          (await sendRecords(t, ana, [{ shipmentId: shipment.id, kind: "delivery" }])).body.results,
        ).toMatchObject([{ outcome: "applied" }]);
      }
    },
  );
  it("does not substitute another courier or the original courier's newer route for an errand", async () => {
    const { shipment, route, id } = await fixture("delivery", { errand: true });
    const other = await courierWithAccount(t, database.db, "Beatriz Ruiz");
    expect(
      (
        await routeAction(t, cookie, await routeDetail(route.id), "/reassign", {
          courierId: other.id,
          reason: "Otro mensajero continúa",
        })
      ).status,
    ).toBe(200);
    const filler = await registerShipment(t, cookie, catalog);
    const created = await createRoute(t, cookie, { courierId: ana.id, shipmentIds: [filler.id] });
    const newer = (await routeAction(t, cookie, created, "/dispatch")).body;
    expect((await revert(id)).status).toBe(200);
    expect((await effects(shipment.id)).shipment).toMatchObject([
      { status: "registered", routeId: null, custodyCourierId: null, heldAtOffice: false },
    ]);
    expect(pending(await routeDetail(route.id), shipment.id)).toEqual([]);
    expect(pending(await routeDetail(newer.id), shipment.id)).toEqual([]);
  });
  it.each(["return", "new_attempt", "office"] as const)(
    "refuses to rewind a package after %s, preserving every effect",
    async (operation) => {
      const { shipment, route, id } = await fixture("exception");
      if (operation === "office") {
        expect(
          (
            await send(
              t,
              ownerCookie,
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
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/office-receipt`, {
              actionId: crypto.randomUUID(),
            })
          ).status,
        ).toBe(200);
      } else {
        expect(
          (
            await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
              actionId: crypto.randomUUID(),
              decision: operation,
              routeId: route.id,
            })
          ).status,
        ).toBe(200);
      }
      const before = await effects(shipment.id);
      const response = await revert(id);
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: { code: "record_not_revertible" } });
      expect(await effects(shipment.id)).toEqual(before);
    },
  );
  it("remembers simultaneous reversions and a late replay after a later dispatch decision", async () => {
    const { shipment, route, id } = await fixture("exception");
    const values = { actionId: crypto.randomUUID() };
    const responses = await Promise.all([revert(id, values), revert(id, values)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(pending(await routeDetail(route.id), shipment.id)).toHaveLength(1);
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "exception", reason: "wrong_address" },
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
    const before = await effects(shipment.id);
    expect((await revert(id, values)).body).toMatchObject({ id: shipment.id, status: "exception" });
    expect(await effects(shipment.id)).toEqual(before);
    expect(before.events.filter((event) => event.clientEventId === values.actionId)).toHaveLength(
      1,
    );
  });
  it("refuses an older completion even when all record times tie", async () => {
    const { shipment, route, id } = await fixture("exception");
    await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
      actionId: crypto.randomUUID(),
      decision: "new_attempt",
      routeId: route.id,
    });
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "exception", reason: "wrong_address" },
    ]);
    const before = await effects(shipment.id);
    expect((await revert(id)).status).toBe(409);
    expect(await effects(shipment.id)).toEqual(before);
  });
  it.each([false, true])(
    "resolves legacy history only when unambiguous, ambiguous=%s",
    async (ambiguous) => {
      const second = await fixture();
      const events = (await effects(second.shipment.id)).events;
      const effect = events.find(
        (event) => event.type === "status_changed" && event.toStatus === "delivered",
      );
      if (!effect) throw new Error("Missing fixture effect");
      await database.db
        .update(shipmentEvents)
        .set({ courierRecordId: null })
        .where(eq(shipmentEvents.shipmentId, second.shipment.id));
      if (ambiguous) {
        const { id: _, ...copy } = effect;
        await database.db.insert(shipmentEvents).values({ ...copy, courierRecordId: null });
      }
      const before = await effects(second.shipment.id);
      expect((await revert(second.id)).status).toBe(ambiguous ? 409 : 200);
      if (ambiguous) expect(await effects(second.shipment.id)).toEqual(before);
    },
  );
});

it("orders tied history clocks by stable event identity", async () => {
  const { shipment, id: recordId } = await fixture();
  const instant = "2026-10-01T15:01:00.000Z";
  t.setNow("2026-10-01T15:02:00Z");
  const ids = ["ffffffff-ffff-4fff-8fff-ffffffffffff", "00000000-0000-4000-8000-000000000099"];
  await database.db.insert(shipmentEvents).values(
    ids.map((id) => ({
      id,
      shipmentId: shipment.id,
      type: "updated" as const,
      actorUserId: authorId,
      occurredAt: new Date(instant),
      recordedAt: new Date(instant),
      changes: { instructions: ["Antes", "Después"] },
    })),
  );
  for (let index = 0; index < 16; index += 1) {
    await database.db.insert(shipmentEvents).values({
      shipmentId: shipment.id,
      type: "record_corrected",
      actorUserId: authorId,
      occurredAt: new Date(instant),
      recordedAt: new Date(instant),
      courierRecordId: recordId,
      changes: {},
    });
    const tied = (await detail(shipment.id)).events.filter(
      (event) => event.occurredAt === instant && event.recordedAt === instant,
    );
    expect(tied.map((event) => event.id)).toEqual([...ids].sort());
  }
});
