import type { Handover, RouteDetail, RoutesBoard, Shipment } from "@domy/domain";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import webPush from "web-push";
import pino from "pino";
import { sendNoticePushes } from "../src/lib/push.ts";
import { courierNotices, pushSubscriptions } from "../src/db/schema/index.ts";
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
const push = { ...webPush.generateVAPIDKeys(), subject: "mailto:pruebas@example.com" };
afterEach(() => {
  vi.restoreAllMocks();
});
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

async function dispatched(courier = ana, list?: Shipment[]) {
  const shipments = list ?? [await registerShipment(t, cookie, catalog)];
  const draft = await createRoute(t, cookie, {
    shipmentIds: shipments.map((s) => s.id),
    courierId: courier.id,
  });
  const result = await routeAction(t, cookie, draft, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}
async function current(route: RouteDetail) {
  return (await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body;
}
async function notices(courier = ana) {
  return database.db
    .select()
    .from(courierNotices)
    .where(eq(courierNotices.courierId, courier.id))
    .orderBy(courierNotices.id);
}
async function hasNotice(
  type: (typeof courierNotices.$inferSelect)["type"],
  courier = ana,
  shipment?: Shipment,
) {
  expect(await notices(courier)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type,
        acknowledgedAt: null,
        ...(shipment && { shipmentId: shipment.id }),
      }),
    ]),
  );
}

/** US5/T061: real transactions and role isolation for FR-027/FR-033/FR-040. */
describe("courier notices", () => {
  it("does not claim an unchanged stop order is a route change; a late replay cannot undo a real reorder (T118)", async () => {
    const route = await dispatched(ana, [
      await registerShipment(t, cookie, catalog),
      await registerShipment(t, cookie, catalog, { recipientAddress: "Calle 20 # 30-40" }),
    ]);
    const before = await notices();
    const actionId = crypto.randomUUID();
    const original = route.stops.map((stop) => stop.id);
    const unchanged = await routeAction(
      t,
      cookie,
      route,
      "/stop-order",
      { actionId, stopIds: original },
      "PUT",
    );
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.version).toBe(route.version);
    expect(await notices()).toEqual(before);
    const reordered = [original[0], ...original.slice(1).reverse()];
    const changed = await routeAction(
      t,
      cookie,
      route,
      "/stop-order",
      { stopIds: reordered },
      "PUT",
    );
    expect(changed.status).toBe(200);
    expect(
      (await routeAction(t, cookie, route, "/stop-order", { actionId, stopIds: original }, "PUT"))
        .status,
    ).toBe(409);
    expect((await current(route)).stops.map((stop) => stop.id)).toEqual(reordered);
    expect((await notices()).filter((notice) => notice.type === "stops_reordered")).toHaveLength(1);
  });
  it("writes one void notice while retaining the route removal event (T115)", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const route = await dispatched(ana, [shipment]);
    const editable = (await send<Shipment>(t, cookie, `/api/shipments/${shipment.id}`)).body;
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/void`, {
          actionId: crypto.randomUUID(),
          version: editable.version,
          reason: "El cliente canceló el envío",
        })
      ).status,
    ).toBe(200);
    expect(
      (await notices())
        .filter((notice) => notice.shipmentId === shipment.id)
        .map((notice) => notice.type),
    ).toEqual(["shipment_voided"]);
    expect((await current(route)).events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "shipment_removed",
          shipment: { id: shipment.id, trackingNumber: shipment.trackingNumber },
        }),
      ]),
    );
  });
  it("records dispatch once even when its action is replayed", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const draft = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: ana.id });
    const actionId = crypto.randomUUID();
    for (let i = 0; i < 2; i++) {
      expect((await routeAction(t, cookie, draft, "/dispatch", { actionId })).status).toBe(200);
    }
    expect(await notices()).toEqual([
      expect.objectContaining({ type: "route_dispatched", routeId: draft.id }),
    ]);
    expect((await snapshot(t, beto)).body.notices).toEqual([]);
  });

  it("covers add, reorder, recipient edit, remove and void without notifying a draft courier", async () => {
    const route = await dispatched();
    const added = await registerShipment(t, cookie, catalog, {
      recipientAddress: "Calle 55 # 20-30",
    });
    expect(
      (
        await routeAction(t, cookie, await current(route), "/shipments", {
          shipmentIds: [added.id],
        })
      ).status,
    ).toBe(200);
    await hasNotice("shipment_added", ana, added);
    const ordered = await current(route);
    expect(
      (
        await routeAction(
          t,
          cookie,
          ordered,
          "/stop-order",
          {
            stopIds: [
              ordered.stops[0]?.id,
              ...ordered.stops
                .slice(1)
                .reverse()
                .map((s) => s.id),
            ],
          },
          "PUT",
        )
      ).status,
    ).toBe(200);
    await hasNotice("stops_reordered");
    const editable = (await send<Shipment>(t, cookie, `/api/shipments/${added.id}`)).body;
    const edit = await send<Shipment>(
      t,
      cookie,
      `/api/shipments/${added.id}`,
      {
        actionId: crypto.randomUUID(),
        version: editable.version,
        instructions: "Llamar al llegar a portería",
      },
      "PATCH",
    );
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    await hasNotice("shipment_updated", ana, added);
    expect(
      (await routeAction(t, cookie, await current(route), `/shipments/${added.id}/remove`)).status,
    ).toBe(200);
    await hasNotice("shipment_removed", ana, added);
    const toVoid = await registerShipment(t, cookie, catalog);
    expect(
      (
        await routeAction(t, cookie, await current(route), "/shipments", {
          shipmentIds: [toVoid.id],
        })
      ).status,
    ).toBe(200);
    const fresh = (await send<Shipment>(t, cookie, `/api/shipments/${toVoid.id}`)).body;
    expect(
      (
        await send(t, cookie, `/api/shipments/${toVoid.id}/void`, {
          actionId: crypto.randomUUID(),
          version: fresh.version,
          reason: "El cliente canceló el envío",
        })
      ).status,
    ).toBe(200);
    await hasNotice("shipment_voided", ana, toVoid);
    const draft = await createRoute(t, cookie, { shipmentIds: [added.id], courierId: beto.id });
    expect(
      (await routeAction(t, cookie, draft, "/cancel", { reason: "Ya no se necesita la ruta" }))
        .status,
    ).toBe(200);
    expect(await notices(beto)).toEqual([]);
  });

  it("notifies shipment additions from a joined draft route, not a reassignment from a phone", async () => {
    const target = await dispatched();
    const added = await registerShipment(t, cookie, catalog);
    const draft = await createRoute(t, cookie, { shipmentIds: [added.id], courierId: ana.id });
    expect((await routeAction(t, cookie, draft, "/join", { toRouteId: target.id })).status).toBe(
      200,
    );
    await hasNotice("shipment_added", ana, added);
    expect((await notices()).filter((n) => n.shipmentId === added.id).map((n) => n.type)).toEqual([
      "shipment_added",
    ]);
  });

  it("notifies the previous and new courier on whole-route reassignment, and the latter on undo", async () => {
    const route = await dispatched();
    expect(
      (
        await routeAction(t, cookie, route, "/reassign", {
          courierId: beto.id,
          reason: "Cambio de turno del mensajero",
        })
      ).status,
    ).toBe(200);
    await hasNotice("route_reassigned", ana);
    await hasNotice("route_reassigned", beto);
    expect((await snapshot(t, ana)).body.route).toBeNull();
    expect(
      (
        await routeAction(t, cookie, await current(route), "/undo-dispatch", {
          reason: "El despacho fue un error",
        })
      ).status,
    ).toBe(200);
    await hasNotice("dispatch_undone", beto);
  });

  it.each(["confirm", "cancel"] as const)(
    "notifies both affected couriers of shipment moves and handover %s",
    async (action) => {
      const shipment = await registerShipment(t, cookie, catalog);
      await dispatched(ana, [shipment]);
      expect(
        (await sendRecords(t, ana, [{ kind: "pickup", shipmentId: shipment.id }])).status,
      ).toBe(200);
      const target = await dispatched(beto);
      const moved = await send<{ handover: Handover }>(
        t,
        cookie,
        `/api/shipments/${shipment.id}/reassign`,
        {
          actionId: crypto.randomUUID(),
          toRouteId: target.id,
          reason: "Cambió el sector de entrega",
        },
      );
      expect(moved.status).toBe(200);
      await hasNotice("shipment_reassigned_out", ana, shipment);
      await hasNotice("shipment_reassigned_in", beto, shipment);
      await hasNotice("handover_requested", ana, shipment);
      await hasNotice("handover_requested", beto, shipment);
      const beforeResolution = [await notices(ana), await notices(beto)];
      expect(
        (
          await send(t, cookie, `/api/handovers/${moved.body.handover.id}/${action}`, {
            actionId: crypto.randomUUID(),
          })
        ).status,
      ).toBe(200);
      for (const [index, courier] of [ana, beto].entries()) {
        expect((await notices(courier)).length).toBeGreaterThan(
          beforeResolution[index]?.length ?? 0,
        );
      }
      if (action === "cancel") {
        await hasNotice("handover_cancelled", ana, shipment);
        await hasNotice("handover_cancelled", beto, shipment);
      } else {
        expect(
          (await notices())
            .filter((notice) => notice.shipmentId === shipment.id)
            .map((notice) => notice.type),
        ).toContain("handover_confirmed");
      }
    },
  );

  it("notifies exception decisions and office receipt even after the route finishes", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    await dispatched(ana, [shipment]);
    expect(
      (
        await sendRecords(t, ana, [
          { kind: "pickup", shipmentId: shipment.id },
          { kind: "exception", shipmentId: shipment.id, reason: "recipient_absent" },
        ])
      ).status,
    ).toBe(200);
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/exception-decision`, {
          actionId: crypto.randomUUID(),
          decision: "new_attempt",
        })
      ).status,
    ).toBe(200);
    await hasNotice("exception_decided", ana, shipment);
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
    expect(
      (
        await send(t, cookie, `/api/shipments/${shipment.id}/office-receipt`, {
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(200);
    await hasNotice("office_received", ana, shipment);
  });

  it("acknowledges only the caller's shown notices once, preserving newer unseen changes", async () => {
    const route = await dispatched();
    await dispatched(beto);
    const [first] = await notices();
    const [other] = await notices(beto);
    if (!first || !other) throw new Error("Dispatch notices are missing");
    const before = await snapshot(t, ana);
    expect(before.body.notices.map((n) => n.id)).toEqual([first.id]);
    const added = await registerShipment(t, cookie, catalog);
    expect(
      (await routeAction(t, cookie, route, "/shipments", { shipmentIds: [added.id] })).status,
    ).toBe(200);
    const payload = {
      actionId: crypto.randomUUID(),
      noticeIds: [first.id, other.id],
      occurredAt: t.now().toISOString(),
    };
    for (const at of ["2026-10-01T15:01:00Z", "2026-10-01T15:02:00Z"]) {
      t.setNow(at);
      expect((await send(t, ana.cookie, "/api/courier/notices/acknowledge", payload)).status).toBe(
        204,
      );
    }
    expect(await notices()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, acknowledgedAt: new Date(payload.occurredAt) }),
      ]),
    );
    expect((await notices(beto))[0]?.acknowledgedAt).toBeNull();
    expect((await snapshot(t, ana)).body.notices).toEqual([
      expect.objectContaining({ type: "shipment_added" }),
    ]);
    const board = (await send<RoutesBoard>(t, cookie, "/api/routes/board")).body;
    expect(board.routes.find((r) => r.id === route.id)).toMatchObject({
      courierLastSyncedAt: t.now().toISOString(),
      unacknowledgedNotices: 1,
    });
  });

  it("rolls the route mutation back when its notice cannot be written", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const draft = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: ana.id });
    await database.db.execute(
      sql`create function reject_notice() returns trigger language plpgsql as $$ begin raise exception 'controlled notice failure'; end $$`,
    );
    await database.db.execute(
      sql`create trigger reject_notice before insert on courier_notices for each row execute function reject_notice()`,
    );
    try {
      expect((await routeAction(t, cookie, draft, "/dispatch")).status).toBe(500);
      expect((await current(draft)).status).toBe("draft");
      expect(await notices()).toEqual([]);
    } finally {
      await database.db.execute(sql`drop trigger reject_notice on courier_notices`);
      await database.db.execute(sql`drop function reject_notice()`);
    }
  });
});

describe("push configuration and subscriptions (FR-040)", () => {
  it("refuses arbitrary push destinations at the authenticated HTTP boundary (T113)", async () => {
    const response = await send(t, ana.cookie, "/api/courier/push-subscriptions", {
      actionId: crypto.randomUUID(),
      endpoint: "https://127.0.0.1/internal",
      keys: { p256dh: "key", auth: "auth" },
    });
    expect(response.status).toBe(400);
    expect(await database.db.select().from(pushSubscriptions)).toEqual([]);
  });
  it("sends the committed notice when a later record in the batch is invalid (T114)", async () => {
    t = createTestApp(database.db, { push });
    const sent = vi
      .spyOn(webPush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    await database.db.insert(pushSubscriptions).values({
      userId: ana.userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/ana",
      p256dh: "key",
      auth: "auth",
    });
    const shipment = await registerShipment(t, cookie, catalog);
    const result = await sendRecords(t, ana, [
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 50_000,
      },
      { shipmentId: shipment.id, kind: "delivery", cashAmount: 50_000 },
    ]);
    expect(result.status).toBe(400);
    expect((await notices()).filter((notice) => notice.type === "record_not_applied")).toHaveLength(
      1,
    );
    await expect.poll(() => sent.mock.calls.length).toBe(1);
  });
  it("preserves renewed subscription keys when an older push responds 410 (T115)", async () => {
    const deferred = Promise.withResolvers<never>();
    const sent = vi.spyOn(webPush, "sendNotification").mockReturnValue(deferred.promise);
    const endpoint = "https://fcm.googleapis.com/fcm/send/ana";
    await database.db
      .insert(pushSubscriptions)
      .values({ userId: ana.userId, endpoint, p256dh: "old-key", auth: "old-auth" });
    await dispatched();
    // Own the real delivery promise to observe its complete error path without sleeps.
    const delivery = sendNoticePushes(
      database.db,
      (await notices()).map((notice) => notice.id),
      push,
      pino({ level: "silent" }),
    );
    await expect.poll(() => sent.mock.calls.length).toBe(1);
    const renewed = await send(t, ana.cookie, "/api/courier/push-subscriptions", {
      actionId: crypto.randomUUID(),
      endpoint,
      keys: { p256dh: "new-key", auth: "new-auth" },
    });
    expect(renewed.status).toBe(204);
    deferred.reject({ statusCode: 410 });
    await delivery;
    expect(await database.db.select().from(pushSubscriptions)).toEqual([
      expect.objectContaining({ endpoint, p256dh: "new-key", auth: "new-auth" }),
    ]);
  });
  it("sends no push if commit fails after the notice was inserted", async () => {
    t = createTestApp(database.db, { push });
    const sent = vi
      .spyOn(webPush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    await database.db.insert(pushSubscriptions).values({
      userId: ana.userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/ana",
      p256dh: "test-key",
      auth: "test-auth",
    });
    const shipment = await registerShipment(t, cookie, catalog);
    const draft = await createRoute(t, cookie, { shipmentIds: [shipment.id], courierId: ana.id });
    await database.db.execute(
      sql`create function reject_notice_commit() returns trigger language plpgsql as $$ begin raise exception 'controlled commit failure'; end $$`,
    );
    await database.db.execute(
      sql`create constraint trigger reject_notice_commit after insert on courier_notices deferrable initially deferred for each row execute function reject_notice_commit()`,
    );
    try {
      expect((await routeAction(t, cookie, draft, "/dispatch")).status).toBe(500);
      expect((await current(draft)).status).toBe("draft");
      expect(await notices()).toEqual([]);
      expect(sent).not.toHaveBeenCalled();
    } finally {
      await database.db.execute(sql`drop trigger reject_notice_commit on courier_notices`);
      await database.db.execute(sql`drop function reject_notice_commit()`);
    }
  });

  it("returns exactly the configured public key, never its private key or subject", async () => {
    t = createTestApp(database.db, { push });
    const response = await send(t, ana.cookie, "/api/courier/push-config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: push.publicKey });
  });

  it("sends only type and route number after commit, without waiting for the push service", async () => {
    t = createTestApp(database.db, { push });
    const release = Promise.withResolvers<undefined>();
    let committedNotice = false;
    const sent = vi.spyOn(webPush, "sendNotification").mockImplementation(async () => {
      // A separate connection cannot see an uncommitted row: this checks real commit order.
      const rows = await notices();
      committedNotice = rows.some((n) => n.type === "route_dispatched");
      await release.promise;
      return { statusCode: 201, body: "", headers: {} };
    });
    await database.db.insert(pushSubscriptions).values({
      userId: ana.userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/ana",
      p256dh: "test-key",
      auth: "test-auth",
    });
    try {
      // Must return with the real transport still unresolved.
      const route = await dispatched();
      expect(route.status).toBe("in_progress");
      await expect.poll(() => sent.mock.calls.length).toBe(1);
      await expect.poll(() => committedNotice).toBe(true);
      // Assert outside the transport: the app intentionally catches push failures.
      expect(JSON.parse(String(sent.mock.calls[0]?.[1]))).toEqual({
        type: "route_dispatched",
        routeNumber: route.number,
      });
    } finally {
      release.resolve(undefined);
    }
  });

  it.each([404, 410, 503])(
    "keeps dispatch successful on push HTTP %s; deletes only expired subscriptions",
    async (statusCode) => {
      t = createTestApp(database.db, { push });
      const sent = vi.spyOn(webPush, "sendNotification").mockRejectedValue({ statusCode });
      await database.db.insert(pushSubscriptions).values({
        userId: ana.userId,
        endpoint: "https://fcm.googleapis.com/fcm/send/ana",
        p256dh: "test-key",
        auth: "test-auth",
      });
      expect((await dispatched()).status).toBe("in_progress");
      await expect.poll(() => sent.mock.calls.length).toBe(1);
      await expect
        .poll(async () => (await database.db.select().from(pushSubscriptions)).length)
        .toBe(statusCode === 503 ? 1 : 0);
      await hasNotice("route_dispatched");
    },
  );

  it("returns null, not secrets, when phone notifications are disabled", async () => {
    const response = await send(t, ana.cookie, "/api/courier/push-config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: null });
  });

  it("restricts push configuration to signed-in linked couriers", async () => {
    const unlinked = await t.signIn("courier");
    const owner = await t.signIn("owner");
    for (const as of [unlinked.cookie, owner.cookie, cookie]) {
      expect((await send(t, as, "/api/courier/push-config")).status).toBe(403);
    }
    expect((await t.request("/api/courier/push-config")).status).toBe(401);
  });

  it("subscribes once, prevents cross-account removal and remembers a late registration replay", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/ana";
    const registration = {
      actionId: crypto.randomUUID(),
      endpoint,
      keys: { p256dh: "public-device-key", auth: "device-auth" },
    };
    for (let i = 0; i < 2; i++)
      expect(
        (await send(t, ana.cookie, "/api/courier/push-subscriptions", registration)).status,
      ).toBe(204);
    expect(await database.db.select().from(pushSubscriptions)).toEqual([
      expect.objectContaining({ endpoint, userId: ana.userId }),
    ]);
    const unchanged = { ...registration, actionId: crypto.randomUUID() };
    const concurrent = await Promise.all([
      send(t, ana.cookie, "/api/courier/push-subscriptions", unchanged),
      send(t, ana.cookie, "/api/courier/push-subscriptions", unchanged),
    ]);
    expect(concurrent.map((result) => result.status)).toEqual([204, 204]);
    expect(
      (
        await send(t, beto.cookie, "/api/courier/push-subscriptions/remove", {
          actionId: crypto.randomUUID(),
          endpoint,
        })
      ).status,
    ).toBe(204);
    expect(await database.db.select().from(pushSubscriptions)).toHaveLength(1);
    const removal = { actionId: crypto.randomUUID(), endpoint };
    expect(
      (await send(t, ana.cookie, "/api/courier/push-subscriptions/remove", removal)).status,
    ).toBe(204);
    expect(
      (await send(t, ana.cookie, "/api/courier/push-subscriptions", registration)).status,
    ).toBe(204);
    expect((await send(t, ana.cookie, "/api/courier/push-subscriptions", unchanged)).status).toBe(
      204,
    );
    expect(
      await database.db
        .select()
        .from(pushSubscriptions)
        .where(
          and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ana.userId)),
        ),
    ).toEqual([]);
    // A genuinely new subscription must survive the delayed retry of its preceding removal.
    expect(
      (
        await send(t, ana.cookie, "/api/courier/push-subscriptions", {
          ...registration,
          actionId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(204);
    expect(
      (await send(t, ana.cookie, "/api/courier/push-subscriptions/remove", removal)).status,
    ).toBe(204);
    expect(await database.db.select().from(pushSubscriptions)).toHaveLength(1);
  });
});
