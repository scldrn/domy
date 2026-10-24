import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordPhotos } from "../src/db/schema/index.ts";
import type { PhotoStorage } from "../src/lib/storage.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";

/**
 * A stalled or failing photo bucket must not take the API down with it (ROB-1, feature 003
 * research R6, FR-023): the upload never holds a database connection while it waits for
 * storage, and a storage failure is a catalogued 503 the phone retries.
 */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
let courier: CourierAccount;
let mode: "hang" | "fail" = "hang";
/** Pending storage calls of the hanging bucket, released in teardown. */
let stalled: ((error: Error) => void)[] = [];
let inFlight: Promise<Response>[] = [];

const storage: PhotoStorage = {
  putPhoto: () =>
    mode === "hang"
      ? new Promise<void>((_, reject) => stalled.push(reject))
      : Promise.reject(new Error("connect ETIMEDOUT")),
  getPhoto: () => Promise.reject(new Error("connect ETIMEDOUT")),
  deletePhoto: () => Promise.resolve(),
  ensureBucket: () => Promise.resolve(),
};

const jpeg = () => {
  const bytes = new Uint8Array(2048).fill(7);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};

function upload(photoId: string) {
  return t.app.request(`/api/courier/photos/${photoId}`, {
    method: "PUT",
    headers: { cookie: courier.cookie, "content-type": "image/jpeg" },
    body: jpeg(),
  });
}

/** Two deliveries with six declared photos each: more photos than pooled connections. */
async function declaredPhotos(): Promise<string[]> {
  const photoIds: string[] = [];
  const prepaid = { paymentMode: "merchant_account", codAmount: 0 };
  const a = await registerShipment(t, cookie, catalog, prepaid);
  const b = await registerShipment(t, cookie, catalog, prepaid);
  const route = await createRoute(t, cookie, { shipmentIds: [a.id, b.id], courierId: courier.id });
  expect((await routeAction(t, cookie, route, "/dispatch")).status).toBe(200);
  for (const shipment of [a, b]) {
    // At most three photos of each kind per record (FR-009).
    const photos = (["proof", "transfer_receipt"] as const).flatMap((kind) =>
      Array.from({ length: 3 }, () => ({ id: crypto.randomUUID(), kind })),
    );
    photoIds.push(...photos.map((photo) => photo.id));
    const response = await sendRecords(t, courier, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        photos,
      },
    ]);
    expect(response.status).toBe(200);
  }
  return photoIds;
}

async function waitFor(condition: () => boolean, ms: number) {
  const deadline = Date.now() + ms;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

beforeAll(async () => {
  database = await startDatabase();
}, 120_000);
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  mode = "hang";
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z", storage });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  courier = await courierWithAccount(t, database.db, "Ana Ruiz");
});
afterEach(async () => {
  // Release every stalled storage call so no request (or connection) outlives the test.
  for (let round = 0; round < 50 && (stalled.length > 0 || inFlight.length > 0); round++) {
    for (const reject of stalled.splice(0)) reject(new Error("released by teardown"));
    const pending = inFlight.splice(0);
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ]);
    if (stalled.length > 0) inFlight.push(...pending);
  }
  stalled = [];
  inFlight = [];
});

describe("Photo uploads against a stalled or failing bucket (ROB-1)", () => {
  it("keeps answering other requests while uploads wait on a bucket that never responds", async () => {
    const photoIds = await declaredPhotos();
    inFlight = photoIds.map((id) => Promise.resolve(upload(id)));
    // Every upload has reached storage (or is queued behind the ones that did).
    await waitFor(() => stalled.length >= photoIds.length, 3_000);

    const started = Date.now();
    const outcome = await Promise.race([
      t.app.request(`/api/photos/${photoIds[0] ?? ""}`, { headers: { cookie } }),
      new Promise<"stalled">((resolve) =>
        setTimeout(() => {
          resolve("stalled");
        }, 2_000),
      ),
    ]);

    expect(outcome).not.toBe("stalled");
    if (outcome === "stalled") return;
    expect(outcome.status).toBe(404);
    expect(Date.now() - started).toBeLessThan(2_000);
  }, 60_000);

  it("answers a failing bucket with 503 storage_unavailable and leaves the photo pending", async () => {
    mode = "fail";
    const [photoId = ""] = await declaredPhotos();

    const response = await upload(photoId);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "storage_unavailable",
        message: "No pudimos guardar la foto. Se volverá a intentar.",
      },
    });
    const [row] = await database.db
      .select({ uploadedAt: recordPhotos.uploadedAt })
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    expect(row?.uploadedAt).toBeNull();
  }, 60_000);
});
