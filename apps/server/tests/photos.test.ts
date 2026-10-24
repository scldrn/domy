import type { RouteDetail, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { companySettings, recordPhotos, routes, shipments } from "../src/db/schema/index.ts";
import { photoKey } from "../src/lib/storage.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

let database: TestDatabase;
let s3: TestStorage;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let ana: CourierAccount;

beforeAll(async () => {
  [database, s3] = await Promise.all([startDatabase(), startStorage()]);
}, 120_000);
afterAll(async () => {
  await Promise.all([database.stop(), s3.stop()]);
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z", storage: s3.storage });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
});

const jpeg = (size = 2048, fill = 7) => {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};

function upload(
  courier: { cookie: string },
  photoId: string,
  body: Uint8Array,
  pathPrefix = "/api/courier/photos",
) {
  return t.app.request(`${pathPrefix}/${photoId}`, {
    method: "PUT",
    headers: { cookie: courier.cookie, "content-type": "image/jpeg" },
    body,
  });
}

/** A delivery of Ana's with one proof photo declared; returns the photo and record ids.
 * By default leaves an extra shipment on the route so route remains in_progress. */
async function deliveryWithPhoto(routeInProgress = true): Promise<{
  photoId: string;
  recordId: string;
  shipment: Shipment;
  extraShipment: Shipment | null;
  route: RouteDetail;
}> {
  const shipment: Shipment = await registerShipment(t, cookie, catalog);
  const extraShipment: Shipment | null = routeInProgress
    ? await registerShipment(t, cookie, catalog)
    : null;
  const shipmentIds = extraShipment ? [shipment.id, extraShipment.id] : [shipment.id];
  const route: RouteDetail = await createRoute(t, cookie, {
    shipmentIds,
    courierId: ana.id,
  });
  await routeAction(t, cookie, route, "/dispatch");
  const photoId = crypto.randomUUID();
  const recordId = crypto.randomUUID();
  await sendRecords(t, ana, [
    { shipmentId: shipment.id, kind: "pickup" },
    {
      id: recordId,
      shipmentId: shipment.id,
      kind: "delivery",
      receivedByName: "Laura Gómez",
      cashAmount: 50_000,
      photos: [{ id: photoId, kind: "proof" }],
    },
  ]);
  return { photoId, recordId, shipment, extraShipment, route };
}

const photoRow = async (id: string) =>
  (await database.db.select().from(recordPhotos).where(eq(recordPhotos.id, id)))[0];

/** Photos (feature 003, research R6, FR-009, FR-023, FR-036, Finding IV-31, Finding IV-05 / D2). */
describe("PUT /api/courier/photos/:id and /api/photos/:id", () => {
  it("stores the image and marks the photo arrived", async () => {
    const { photoId, recordId } = await deliveryWithPhoto();
    t.setNow("2026-10-01T15:10:00Z");

    const response = await upload(ana, photoId, jpeg());

    expect(response.status).toBe(204);
    expect(await photoRow(photoId)).toMatchObject({
      uploadedAt: new Date("2026-10-01T15:10:00Z"),
      byteSize: 2048,
    });
    expect(await s3.storage.getPhoto(photoKey({ recordId, photoId }))).toEqual(jpeg());
  });

  it("is harmless when repeated with identical bytes and does not mutate uploadedAt (FR-023 / IV-31)", async () => {
    const { photoId } = await deliveryWithPhoto();
    t.setNow("2026-10-01T15:10:00Z");
    expect((await upload(ana, photoId, jpeg())).status).toBe(204);
    const originalRow = await photoRow(photoId);
    expect(originalRow?.uploadedAt).toEqual(new Date("2026-10-01T15:10:00Z"));

    // One hour later: retry with exact same bytes
    t.setNow("2026-10-01T16:10:00Z");
    expect((await upload(ana, photoId, jpeg())).status).toBe(204);
    const replayedRow = await photoRow(photoId);
    expect(replayedRow?.uploadedAt).toEqual(originalRow?.uploadedAt);
    expect(replayedRow?.byteSize).toBe(originalRow?.byteSize);
  });

  it("rejects overwriting an acknowledged photo with different bytes (Finding IV-31 / CRITICAL)", async () => {
    const { photoId, recordId } = await deliveryWithPhoto();
    t.setNow("2026-10-01T15:10:00Z");
    const originalBytes = jpeg(2048, 7);
    expect((await upload(ana, photoId, originalBytes)).status).toBe(204);

    // One hour later: upload different bytes under the same photo UUID
    t.setNow("2026-10-01T16:10:00Z");
    const differentBytes = jpeg(2048, 9);
    const overwriteResponse = await upload(ana, photoId, differentBytes);

    expect(overwriteResponse.status).toBe(409);
    const body = (await overwriteResponse.json()) as { error: { code: string } };
    expect(body.error.code).toBe("photo_immutable");

    // Authoritative PostgreSQL metadata and S3 bytes are immutable
    const row = await photoRow(photoId);
    expect(row?.uploadedAt).toEqual(new Date("2026-10-01T15:10:00Z"));
    expect(row?.byteSize).toBe(2048);
    expect(await s3.storage.getPhoto(photoKey({ recordId, photoId }))).toEqual(originalBytes);
  });

  it("rejects overwriting an acknowledged photo with different byte size (Finding IV-31)", async () => {
    const { photoId, recordId } = await deliveryWithPhoto();
    const originalBytes = jpeg(2048);
    expect((await upload(ana, photoId, originalBytes)).status).toBe(204);

    const differentSize = jpeg(4096);
    const overwriteResponse = await upload(ana, photoId, differentSize);

    expect(overwriteResponse.status).toBe(409);
    expect(await s3.storage.getPhoto(photoKey({ recordId, photoId }))).toEqual(originalBytes);
  });

  it("serializes concurrent uploads and rejects the conflicting writer", async () => {
    const { photoId, recordId } = await deliveryWithPhoto();
    const bytesA = jpeg(2048, 1);
    const bytesB = jpeg(2048, 2);

    const [resA, resB] = await Promise.all([
      upload(ana, photoId, bytesA),
      upload(ana, photoId, bytesB),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([204, 409]);

    const winnerBytes = resA.status === 204 ? bytesA : bytesB;
    expect(await s3.storage.getPhoto(photoKey({ recordId, photoId }))).toEqual(winnerBytes);
  });

  it("supports upload via PUT /api/photos/:id as well as /api/courier/photos/:id", async () => {
    const { photoId, recordId } = await deliveryWithPhoto();
    const response = await upload(ana, photoId, jpeg(), "/api/photos");
    expect(response.status).toBe(204);
    expect(await s3.storage.getPhoto(photoKey({ recordId, photoId }))).toEqual(jpeg());
  });

  it("answers 404 while its record has not arrived, and for another courier's photo", async () => {
    expect((await upload(ana, crypto.randomUUID(), jpeg())).status).toBe(404);
    const { photoId } = await deliveryWithPhoto();
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    expect((await upload(beto, photoId, jpeg())).status).toBe(404);
    expect((await photoRow(photoId))?.uploadedAt).toBeNull();
  });

  it("refuses an image above 1 MB with 413 payload_too_large", async () => {
    const { photoId } = await deliveryWithPhoto();
    const response = await upload(ana, photoId, jpeg(1024 * 1024 + 1));
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "payload_too_large",
    );
  });

  it("refuses an empty body or another media type", async () => {
    const { photoId } = await deliveryWithPhoto();
    expect((await upload(ana, photoId, new Uint8Array())).status).toBe(400);
    const png = await t.app.request(`/api/courier/photos/${photoId}`, {
      method: "PUT",
      headers: { cookie: ana.cookie, "content-type": "image/png" },
      body: jpeg(),
    });
    expect(png.status).toBe(400);
  });

  it("refuses a body that is not a JPEG even when labelled image/jpeg (SEC-6)", async () => {
    const { photoId } = await deliveryWithPhoto();
    const png = new Uint8Array(2048).fill(7);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const body of [png, new Uint8Array([0xff, 0xd8])]) {
      const response = await upload(ana, photoId, body);
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: { message: string } }).error.message).toBe(
        "La foto debe ser una imagen JPEG.",
      );
    }
    expect((await photoRow(photoId))?.uploadedAt).toBeNull();
  });
});

describe("GET /api/photos/:id", () => {
  it("shows the photo to the office and to the courier who took it while route is in progress (D2 / FR-036)", async () => {
    const { photoId } = await deliveryWithPhoto(true);
    await upload(ana, photoId, jpeg());

    for (const viewer of [cookie, ana.cookie]) {
      const response = await t.app.request(`/api/photos/${photoId}`, {
        headers: { cookie: viewer },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("cache-control")).toBe(
        "private, no-cache, no-store, must-revalidate",
      );
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg());
    }
  });

  it("refuses another courier with 403 Forbidden (Finding IV-05 / D2)", async () => {
    const { photoId } = await deliveryWithPhoto(true);
    await upload(ana, photoId, jpeg());
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const response = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: beto.cookie },
    });
    expect(response.status).toBe(403);
  });

  it("refuses courier access once route is completed/finished (Finding IV-05 / D2)", async () => {
    const { photoId, extraShipment } = await deliveryWithPhoto(true);
    await upload(ana, photoId, jpeg());

    // While route is in progress, Ana can view it
    expect(
      (await t.app.request(`/api/photos/${photoId}`, { headers: { cookie: ana.cookie } })).status,
    ).toBe(200);

    // Ana completes the remaining delivery on the route, so route finishes
    if (!extraShipment) throw new Error("extraShipment is required");
    await sendRecords(t, ana, [
      { shipmentId: extraShipment.id, kind: "pickup" },
      {
        id: crypto.randomUUID(),
        shipmentId: extraShipment.id,
        kind: "delivery",
        receivedByName: "Pedro Pérez",
        cashAmount: 0,
      },
    ]);

    // Now that route is finished (completed work), Ana is refused with 403
    const courierResp = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: ana.cookie },
    });
    expect(courierResp.status).toBe(403);

    // Office can still view completed shipment photos
    const officeResp = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: cookie },
    });
    expect(officeResp.status).toBe(200);
  });

  it("refuses courier access once work is removed/reassigned from their route (D2)", async () => {
    const { photoId, route } = await deliveryWithPhoto(true);
    await upload(ana, photoId, jpeg());

    // Dispatcher reassigns the route in progress to Beto: work leaves Ana's app
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const [currentRoute] = await database.db.select().from(routes).where(eq(routes.id, route.id));
    if (!currentRoute) throw new Error("currentRoute is required");
    const reassignRes = await t.app.request(`/api/routes/${route.id}/reassign`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        version: currentRoute.version,
        courierId: beto.id,
        reason: "Pinchazo en vía",
      }),
    });
    expect(reassignRes.status).toBe(200);

    // Ana can no longer access photos for the work removed from her app
    const response = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: ana.cookie },
    });
    expect(response.status).toBe(403);

    // Beto now carries the route but did not take the photo: a courier sees only their own
    // records (003 FR-036, owner decision D2); the office retains access.
    expect(
      (await t.app.request(`/api/photos/${photoId}`, { headers: { cookie: beto.cookie } })).status,
    ).toBe(403);
    expect((await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } })).status).toBe(
      200,
    );
  });

  it("allows courier access for held work in custody off-route, and refuses after office receipt (D2)", async () => {
    await database.db.insert(companySettings).values({
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhoodId: catalog.place.estadio,
    });
    const shipment: Shipment = await registerShipment(t, cookie, catalog);
    const route: RouteDetail = await createRoute(t, cookie, {
      shipmentIds: [shipment.id],
      courierId: ana.id,
    });
    await routeAction(t, cookie, route, "/dispatch");
    const photoId = crypto.randomUUID();
    const recordId = crypto.randomUUID();

    // Ana picks up and records an exception with photo
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        id: recordId,
        shipmentId: shipment.id,
        kind: "exception",
        reason: "recipient_absent",
        photos: [{ id: photoId, kind: "exception" }],
      },
    ]);
    await upload(ana, photoId, jpeg());

    // Ana holds the package in custody off-route ("En mi custodia") -> access granted
    const heldResp = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: ana.cookie },
    });
    expect(heldResp.status).toBe(200);

    // Dispatcher receives it at the office -> custody ends
    const receiptRes = await t.app.request(`/api/shipments/${shipment.id}/office-receipt`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ actionId: crypto.randomUUID() }),
    });
    expect(receiptRes.status).toBe(200);

    // Custody ended: Ana is refused with 403
    const endedResp = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: ana.cookie },
    });
    expect(endedResp.status).toBe(403);

    // Office can still access
    expect((await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } })).status).toBe(
      200,
    );
  });

  it("refuses the courier who received the package through a handover: only the author sees it (FR-036 / D2)", async () => {
    // Ana's route stays in progress with a second shipment.
    const shipment: Shipment = await registerShipment(t, cookie, catalog);
    const extra: Shipment = await registerShipment(t, cookie, catalog);
    const anaRoute: RouteDetail = await createRoute(t, cookie, {
      shipmentIds: [shipment.id, extra.id],
      courierId: ana.id,
    });
    await routeAction(t, cookie, anaRoute, "/dispatch");
    const photoId = crypto.randomUUID();
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        shipmentId: shipment.id,
        kind: "exception",
        reason: "recipient_absent",
        photos: [{ id: photoId, kind: "exception" }],
      },
    ]);
    expect((await upload(ana, photoId, jpeg())).status).toBe(204);

    // The office sends a new attempt on Beto's route; Beto confirms the handover.
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const betoRoute: RouteDetail = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
      courierId: beto.id,
    });
    await routeAction(t, cookie, betoRoute, "/dispatch");
    const decision = await t.app.request(`/api/shipments/${shipment.id}/exception-decision`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        decision: "new_attempt",
        routeId: betoRoute.id,
      }),
    });
    expect(decision.status).toBe(200);
    const confirmation = await sendRecords(t, beto, [
      { kind: "handover_confirmation", shipmentId: shipment.id },
    ]);
    expect(confirmation.body.results).toEqual([expect.objectContaining({ outcome: "applied" })]);
    const [held] = await database.db
      .select({ custodyCourierId: shipments.custodyCourierId, routeId: shipments.routeId })
      .from(shipments)
      .where(eq(shipments.id, shipment.id));
    expect(held).toEqual({ custodyCourierId: beto.id, routeId: betoRoute.id });

    // Beto holds the package on his in-progress route, but the photo is Ana's record.
    expect(
      (await t.app.request(`/api/photos/${photoId}`, { headers: { cookie: beto.cookie } })).status,
    ).toBe(403);
    expect((await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } })).status).toBe(
      200,
    );
  });

  it("answers 404 before photo arrives in storage", async () => {
    const { photoId } = await deliveryWithPhoto(true);
    const pending = await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } });
    expect(pending.status).toBe(404);
  });

  it("answers 404 for unknown photo ID", async () => {
    const response = await t.app.request(`/api/photos/${crypto.randomUUID()}`, {
      headers: { cookie },
    });
    expect(response.status).toBe(404);
  });

  it("says the photo is no longer available once retention deleted it (404)", async () => {
    const { photoId } = await deliveryWithPhoto(true);
    // Uploaded, then removed by bucket's 12-month rule
    await database.db
      .update(recordPhotos)
      .set({ uploadedAt: new Date("2025-09-01T15:00:00Z"), byteSize: 10 })
      .where(eq(recordPhotos.id, photoId));

    const response = await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } });

    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { message: string } }).error.message).toBe(
      "Esta foto ya no está disponible.",
    );
  });

  it("enforces cache isolation headers so responses are never stored across account switches", async () => {
    const { photoId } = await deliveryWithPhoto(true);
    await upload(ana, photoId, jpeg());

    const response = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: ana.cookie },
    });
    expect(response.status).toBe(200);
    const cacheControl = response.headers.get("cache-control");
    expect(cacheControl).toBe("private, no-cache, no-store, must-revalidate");
  });
});
