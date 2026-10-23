import type { RouteDetail, Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordPhotos } from "../src/db/schema/index.ts";
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

const jpeg = (size = 2048) => {
  const bytes = new Uint8Array(size).fill(7);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};

function upload(courier: { cookie: string }, photoId: string, body: Uint8Array) {
  return t.app.request(`/api/courier/photos/${photoId}`, {
    method: "PUT",
    headers: { cookie: courier.cookie, "content-type": "image/jpeg" },
    body,
  });
}

/** A delivery of Ana's with one proof photo declared; returns the photo and record ids. */
async function deliveryWithPhoto(): Promise<{ photoId: string; recordId: string }> {
  const shipment: Shipment = await registerShipment(t, cookie, catalog);
  const route: RouteDetail = await createRoute(t, cookie, {
    shipmentIds: [shipment.id],
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
  return { photoId, recordId };
}

const photoRow = async (id: string) =>
  (await database.db.select().from(recordPhotos).where(eq(recordPhotos.id, id)))[0];

/** Photos (feature 003, research R6, FR-009, FR-023, FR-036). */
describe("PUT /api/courier/photos/:id", () => {
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

  it("is harmless when repeated (FR-023)", async () => {
    const { photoId } = await deliveryWithPhoto();
    expect((await upload(ana, photoId, jpeg())).status).toBe(204);
    expect((await upload(ana, photoId, jpeg())).status).toBe(204);
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
});

describe("GET /api/photos/:id", () => {
  it("shows the photo to the office and to the courier who took it", async () => {
    const { photoId } = await deliveryWithPhoto();
    await upload(ana, photoId, jpeg());

    for (const viewer of [cookie, ana.cookie]) {
      const response = await t.app.request(`/api/photos/${photoId}`, {
        headers: { cookie: viewer },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg());
    }
  });

  it("hides it from other couriers, and answers 404 before it arrives", async () => {
    const { photoId } = await deliveryWithPhoto();
    const pending = await t.app.request(`/api/photos/${photoId}`, { headers: { cookie } });
    expect(pending.status).toBe(404);
    await upload(ana, photoId, jpeg());
    const beto = await courierWithAccount(t, database.db, "Beto Gómez");
    const hidden = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: beto.cookie },
    });
    expect(hidden.status).toBe(404);
  });

  it("says the photo is no longer available once retention deleted it", async () => {
    const { photoId } = await deliveryWithPhoto();
    // Uploaded, then removed by the bucket's 12-month rule: the row stays.
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
});
