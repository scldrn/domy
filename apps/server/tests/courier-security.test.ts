import type { RouteDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import webPush from "web-push";
import {
  courierNotices,
  courierRecords,
  pushSubscriptions,
  recordPhotos,
  shipmentEvents,
  shipments,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

let database: TestDatabase;
let s3: TestStorage;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let ownerCookie: string;
let ownerId: string;
let dispatcherCookie: string;
let ana: CourierAccount;
let beto: CourierAccount;

const push = { ...webPush.generateVAPIDKeys(), subject: "mailto:pruebas@example.com" };
const receivedAt = "2026-10-01T15:00:00.000Z";

beforeAll(async () => {
  [database, s3] = await Promise.all([startDatabase(), startStorage()]);
}, 120_000);

afterAll(async () => {
  await Promise.all([database.stop(), s3.stop()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: receivedAt, storage: s3.storage, push });
  const owner = await t.signIn("owner");
  ownerCookie = owner.cookie;
  ownerId = owner.user.id;
  catalog = await createCatalog(database.db, ownerId);
  dispatcherCookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
  beto = await courierWithAccount(t, database.db, "Beto Gómez");
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

async function dispatch(courier: CourierAccount, shipmentIds: string[]): Promise<RouteDetail> {
  const draft = await createRoute(t, dispatcherCookie, { courierId: courier.id, shipmentIds });
  const result = await routeAction(t, dispatcherCookie, draft, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}

async function effectsFor(shipmentId: string) {
  const [shipment] = await database.db
    .select({
      status: shipments.status,
      version: shipments.version,
      needsReview: shipments.needsReview,
    })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  if (!shipment) throw new Error("Expected the security fixture shipment to exist");
  const [records, events, notices] = await Promise.all([
    database.db
      .select({ id: courierRecords.id })
      .from(courierRecords)
      .where(eq(courierRecords.shipmentId, shipmentId)),
    database.db
      .select({ id: shipmentEvents.id })
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipmentId)),
    database.db
      .select({ id: courierNotices.id })
      .from(courierNotices)
      .where(eq(courierNotices.shipmentId, shipmentId)),
  ]);
  return { shipment, records: records.length, events: events.length, notices: notices.length };
}

describe("courier security boundary (T090, FR-002–FR-004, FR-019, FR-040)", () => {
  it("isolates route, held work, notices, day summary, photos, and push content by courier", async () => {
    const aFirst = await registerShipment(t, dispatcherCookie, catalog, {
      recipientName: "Persona privada A",
      recipientPhone: "3009000001",
      recipientAddress: "Dirección privada A",
    });
    const aSecond = await registerShipment(t, dispatcherCookie, catalog);
    const bFirst = await registerShipment(t, dispatcherCookie, catalog, {
      recipientName: "Persona privada B",
      recipientPhone: "3009000002",
      recipientAddress: "Dirección privada B",
      codAmount: 20_000,
    });
    const bSecond = await registerShipment(t, dispatcherCookie, catalog);
    const aHeld = await registerShipment(t, dispatcherCookie, catalog);
    const bHeld = await registerShipment(t, dispatcherCookie, catalog);

    await database.db.insert(pushSubscriptions).values({
      userId: ana.userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/courier-security",
      p256dh: "synthetic-public-key",
      auth: "synthetic-auth-key",
    });
    const sent = vi
      .spyOn(webPush, "sendNotification")
      .mockResolvedValue({ statusCode: 201, body: "", headers: {} });

    const aRoute = await dispatch(ana, [aFirst.id, aSecond.id]);
    const bRoute = await dispatch(beto, [bFirst.id, bSecond.id]);
    const aPickup = crypto.randomUUID();
    const aDelivery = crypto.randomUUID();
    const aPhoto = crypto.randomUUID();
    const aRecords = await sendRecords(t, ana, [
      { id: aPickup, shipmentId: aFirst.id, kind: "pickup" },
      {
        id: aDelivery,
        shipmentId: aFirst.id,
        kind: "delivery",
        receivedByName: "Recibe A",
        cashAmount: 50_000,
        photos: [{ id: aPhoto, kind: "proof" }],
      },
    ]);
    expect(aRecords.status).toBe(200);
    expect(aRecords.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);
    const bRecords = await sendRecords(t, beto, [
      { shipmentId: bFirst.id, kind: "pickup" },
      {
        shipmentId: bFirst.id,
        kind: "delivery",
        receivedByName: "Recibe B",
        cashAmount: 20_000,
      },
    ]);
    expect(bRecords.status).toBe(200);
    expect(bRecords.body.results.map((result) => result.outcome)).toEqual(["applied", "applied"]);

    const [aHeldResult, bHeldResult] = await Promise.all([
      sendRecords(t, ana, [{ shipmentId: aHeld.id, kind: "pickup" }]),
      sendRecords(t, beto, [{ shipmentId: bHeld.id, kind: "pickup" }]),
    ]);
    expect(aHeldResult.status).toBe(200);
    expect(bHeldResult.status).toBe(200);

    const photoUpload = await t.app.request(`/api/courier/photos/${aPhoto}`, {
      method: "PUT",
      headers: { cookie: ana.cookie, "content-type": "image/jpeg" },
      body: jpeg,
    });
    expect(photoUpload.status).toBe(204);
    const [aSnapshot, bSnapshot] = await Promise.all([snapshot(t, ana), snapshot(t, beto)]);
    expect(aSnapshot.status).toBe(200);
    expect(bSnapshot.status).toBe(200);
    const aBody = aSnapshot.body;
    const bBody = bSnapshot.body;
    expect(aBody.route?.id).toBe(aRoute.id);
    expect(bBody.route?.id).toBe(bRoute.id);
    const aTaskShipmentIds = aBody.route?.stops.flatMap((stop) =>
      stop.tasks.map((task) => task.shipmentId),
    );
    const bTaskShipmentIds = bBody.route?.stops.flatMap((stop) =>
      stop.tasks.map((task) => task.shipmentId),
    );
    expect(aTaskShipmentIds).toEqual(expect.arrayContaining([aFirst.id, aSecond.id]));
    expect(aTaskShipmentIds).not.toContain(bFirst.id);
    expect(bTaskShipmentIds).toEqual(expect.arrayContaining([bFirst.id, bSecond.id]));
    expect(bTaskShipmentIds).not.toContain(aFirst.id);
    expect(aBody.heldOffRoute.map((shipment) => shipment.shipmentId)).toEqual([aHeld.id]);
    expect(bBody.heldOffRoute.map((shipment) => shipment.shipmentId)).toEqual([bHeld.id]);
    expect(aBody.notices).toEqual([
      expect.objectContaining({ type: "route_dispatched", routeNumber: aRoute.number }),
    ]);
    expect(bBody.notices).toEqual([
      expect.objectContaining({ type: "route_dispatched", routeNumber: bRoute.number }),
    ]);
    expect(aBody.summary).toMatchObject({ deliveries: 1, cash: 50_000 });
    expect(bBody.summary).toMatchObject({ deliveries: 1, cash: 20_000 });

    const ownPhoto = await t.app.request(`/api/photos/${aPhoto}`, {
      headers: { cookie: ana.cookie },
    });
    expect(ownPhoto.status).toBe(200);
    expect(new Uint8Array(await ownPhoto.arrayBuffer())).toEqual(jpeg);
    const otherPhoto = await t.app.request(`/api/photos/${aPhoto}`, {
      headers: { cookie: beto.cookie },
    });
    expect(otherPhoto.status).toBe(403);

    await expect.poll(() => sent.mock.calls.length).toBe(1);
    const call = sent.mock.calls[0];
    if (!call) throw new Error("Expected the route notification to reach the push transport");
    expect(JSON.parse(String(call[1]))).toEqual({
      type: "route_dispatched",
      routeNumber: aRoute.number,
    });
  });

  it("attributes forged record actor fields to the signed-in courier", async () => {
    const shipment = await registerShipment(t, dispatcherCookie, catalog);
    const recordId = crypto.randomUUID();
    const result = await sendRecords(t, ana, [
      {
        id: recordId,
        shipmentId: shipment.id,
        kind: "pickup",
        courierId: beto.id,
        authorUserId: beto.userId,
        onBehalf: true,
      },
    ]);

    expect(result.status).toBe(200);
    expect(result.body.results).toEqual([{ id: recordId, outcome: "applied" }]);
    const [record] = await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.id, recordId));
    expect(record).toMatchObject({
      courierId: ana.id,
      authorUserId: ana.userId,
      onBehalf: false,
    });
    const [event] = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.courierRecordId, recordId));
    expect(event?.actorUserId).toBe(ana.userId);
  });

  it("rejects over 50 valid records without storing or applying any", async () => {
    const shipment = await registerShipment(t, dispatcherCookie, catalog);
    const before = await effectsFor(shipment.id);
    const deviceNow = t.now().toISOString();
    const records = Array.from({ length: 51 }, () => ({
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      occurredAt: deviceNow,
      kind: "disbursement",
      amount: 1000,
      payee: "Tienda de prueba",
    }));

    const result = await send<{ error: { code: string } }>(t, ana.cookie, "/api/courier/records", {
      deviceNow,
      records,
    });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_request");
    expect(await effectsFor(shipment.id)).toEqual(before);
  });

  it("rejects malformed records without storing or applying any", async () => {
    const shipment = await registerShipment(t, dispatcherCookie, catalog);
    const before = await effectsFor(shipment.id);
    const deviceNow = t.now().toISOString();
    const result = await send<{ error: { code: string } }>(t, ana.cookie, "/api/courier/records", {
      deviceNow,
      records: [
        {
          id: crypto.randomUUID(),
          shipmentId: shipment.id,
          occurredAt: "not-a-time",
          kind: "pickup",
        },
      ],
    });

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_request");
    expect(await effectsFor(shipment.id)).toEqual(before);
  });

  it("rejects a body over 1 MB without storing or applying any", async () => {
    const shipment = await registerShipment(t, dispatcherCookie, catalog);
    const before = await effectsFor(shipment.id);
    const deviceNow = t.now().toISOString();
    const body = {
      deviceNow,
      records: [
        {
          id: crypto.randomUUID(),
          shipmentId: shipment.id,
          occurredAt: deviceNow,
          kind: "disbursement",
          amount: 1000,
          payee: "Tienda de prueba",
        },
      ],
      ignoredPadding: "x".repeat(1024 * 1024),
    };
    expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeGreaterThan(1024 * 1024);

    const result = await send<{ error: { code: string } }>(
      t,
      ana.cookie,
      "/api/courier/records",
      body,
    );

    expect(result.status).toBe(413);
    expect(result.body.error.code).toBe("payload_too_large");
    expect(await effectsFor(shipment.id)).toEqual(before);
  });

  it("clamps a future occurredAt to the server receipt time", async () => {
    const shipment = await registerShipment(t, dispatcherCookie, catalog);
    await dispatch(ana, [shipment.id]);
    const id = crypto.randomUUID();
    const result = await sendRecords(
      t,
      ana,
      [{ id, shipmentId: shipment.id, kind: "pickup", occurredAt: "2026-10-01T16:00:00.000Z" }],
      receivedAt,
    );

    expect(result.status).toBe(200);
    expect(result.body.results).toEqual([{ id, outcome: "applied" }]);
    const [record] = await database.db
      .select()
      .from(courierRecords)
      .where(eq(courierRecords.id, id));
    expect(record?.occurredAt).toEqual(new Date(receivedAt));
    expect(record?.recordedAt).toEqual(new Date(receivedAt));
  });

  it("refuses a photo not declared by a courier record before writing to storage", async () => {
    const photoId = crypto.randomUUID();
    const putPhoto = vi.spyOn(s3.storage, "putPhoto");
    const result = await t.app.request(`/api/courier/photos/${photoId}`, {
      method: "PUT",
      headers: { cookie: ana.cookie, "content-type": "image/jpeg" },
      body: jpeg,
    });

    expect(result.status).toBe(404);
    expect(
      await database.db
        .select({ id: recordPhotos.id })
        .from(recordPhotos)
        .where(eq(recordPhotos.id, photoId)),
    ).toEqual([]);
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("refuses a deactivated courier session on its next API request", async () => {
    expect((await snapshot(t, ana)).status).toBe(200);
    const deactivated = await t.request("/api/auth/admin/ban-user", {
      method: "POST",
      cookie: ownerCookie,
      actorId: ownerId,
      body: { actionId: crypto.randomUUID(), userId: ana.userId },
    });
    expect(deactivated.status).toBe(200);
    expect((await snapshot(t, ana)).status).toBe(401);
  });
});
