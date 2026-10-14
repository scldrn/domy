import {
  shipmentStatuses,
  type DispatchBoard,
  type Shipment,
  type ShipmentDetail,
} from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordPhotos, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { courierWithAccount, sendRecords } from "./setup/courier.ts";
import { createRoute, placeOnRoute, routeAction, send } from "./setup/routes.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let dispatcher: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  // 10:00 in Bogotá on 2026-10-01.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function register(overrides: Record<string, unknown> = {}): Promise<Shipment> {
  const response = await t.request("/api/shipments", {
    method: "POST",
    cookie: dispatcher.cookie,
    body: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: catalog.place.laureles,
      paymentMode: "cash_on_delivery",
      codAmount: 85000,
      fee: 13000,
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Shipment;
}

/** Status changes of features 002 and 003 do not exist yet; tests set them directly. */
async function setStatus(shipment: Shipment, status: Shipment["status"]) {
  if (status === "assigned" || status === "dispatched" || status === "picked_up") {
    await placeOnRoute(database.db, shipment.id, status, shipment.registeredBy.id);
    return;
  }
  await database.db
    .update(shipments)
    .set({ status, voidReason: status === "voided" ? "Cliente canceló" : null })
    .where(eq(shipments.id, shipment.id));
}

async function board(query = ""): Promise<DispatchBoard> {
  const response = await t.request(`/api/shipments/board${query}`, { cookie: dispatcher.cookie });
  expect(response.status).toBe(200);
  return (await response.json()) as DispatchBoard;
}

const numbers = (list: { trackingNumber: string }[]) => list.map((s) => s.trackingNumber).sort();

describe("GET /api/shipments/board", () => {
  it("counts shipments per status and lists the board fields (FR-021)", async () => {
    const first = await register({ window: { preset: "before", end: "17:00" } });
    await register();
    const voided = await register();
    await setStatus(voided, "voided");

    const result = await board();
    expect(result.date).toBe("2026-10-01");
    expect(result.serverTime).toBe("2026-10-01T15:00:00.000Z");
    expect(Object.keys(result.counts).sort()).toEqual([...shipmentStatuses].sort());
    expect(result.counts).toMatchObject({ registered: 2, voided: 1, delivered: 0 });
    expect(result.shipments).toHaveLength(3);
    expect(result.pendingFromPreviousDays).toEqual([]);
    expect(result.shipments.find((s) => s.id === first.id)).toMatchObject({
      id: first.id,
      trackingNumber: first.trackingNumber,
      kind: "delivery",
      status: "registered",
      serviceDate: "2026-10-01",
      merchant: { id: catalog.merchant.bullish, name: "Bullish Hype" },
      recipientName: "Laura Gómez",
      recipientNeighborhood: { id: catalog.place.laureles, name: "Laureles" },
      rateZone: { id: catalog.zone.medellin, name: "Medellín" },
      windowStart: null,
      windowEnd: "2026-10-01T22:00:00.000Z",
      codAmount: 85000,
      feeNeedsReview: false,
    });
  });

  it("lists pending shipments from earlier days on today's board and counts them", async () => {
    const pending = await register({ serviceDate: "2026-09-30" });
    const delivered = await register({ serviceDate: "2026-09-30" });
    await setStatus(delivered, "delivered");
    const returned = await register({ serviceDate: "2026-09-29" });
    await setStatus(returned, "returned");
    const exception = await register({ serviceDate: "2026-09-28" });
    await setStatus(exception, "exception");
    const today = await register();

    const result = await board();
    expect(numbers(result.shipments)).toEqual([today.trackingNumber]);
    expect(numbers(result.pendingFromPreviousDays)).toEqual(numbers([pending, exception]));
    expect(result.pendingFromPreviousDays.find((s) => s.id === pending.id)?.serviceDate).toBe(
      "2026-09-30",
    );
    expect(result.counts).toMatchObject({ registered: 2, exception: 1, delivered: 0 });

    // Another date shows only its own shipments, without a pending section.
    const yesterday = await board("?date=2026-09-30");
    expect(numbers(yesterday.shipments)).toEqual(numbers([pending, delivered]));
    expect(yesterday.pendingFromPreviousDays).toEqual([]);
    expect(yesterday.counts).toMatchObject({ registered: 1, delivered: 1 });
  });

  it("shows future dates", async () => {
    const tomorrow = await register({ serviceDate: "2026-10-02" });
    expect((await board()).shipments).toEqual([]);
    expect(numbers((await board("?date=2026-10-02")).shipments)).toEqual(numbers([tomorrow]));
  });

  it("filters by status, merchant, rate zone, and flag (FR-023)", async () => {
    const atRisk = await register({ window: { preset: "before", end: "10:30" } });
    const late = await register({ window: { preset: "before", end: "09:00" } });
    const amy = await register({
      merchantId: catalog.merchant.amy,
      pickupPointId: catalog.pickup.amy,
      recipientNeighborhoodId: catalog.place.itagui,
      fee: 10700,
    });
    const review = await register();
    await database.db
      .update(shipments)
      .set({ feeNeedsReview: true })
      .where(eq(shipments.id, review.id));
    const assigned = await register({ serviceDate: "2026-09-30" });
    await setStatus(assigned, "assigned");

    const statusFilter = await board("?status=assigned");
    expect(statusFilter.shipments).toEqual([]);
    expect(numbers(statusFilter.pendingFromPreviousDays)).toEqual(numbers([assigned]));
    // Counts ignore the status filter so every status chip keeps its number.
    expect(statusFilter.counts).toMatchObject({ registered: 4, assigned: 1 });

    const merchant = await board(`?merchantId=${catalog.merchant.amy}`);
    expect(numbers(merchant.shipments)).toEqual(numbers([amy]));
    expect(merchant.counts).toMatchObject({ registered: 1, assigned: 0 });

    const zone = await board(`?rateZoneId=${catalog.zone.belloItagui}`);
    expect(numbers(zone.shipments)).toEqual(numbers([amy]));

    expect(numbers((await board("?flag=at_risk")).shipments)).toEqual(numbers([atRisk]));
    expect(numbers((await board("?flag=late")).shipments)).toEqual(numbers([late]));
    expect(numbers((await board("?flag=fee_review")).shipments)).toEqual(numbers([review]));

    // After 10:30 the at-risk shipment is late too.
    t.setNow("2026-10-01T15:31:00Z");
    expect(numbers((await board("?flag=late")).shipments)).toEqual(numbers([atRisk, late]));
  });

  it("resolves today in Colombian time (FR-039)", async () => {
    const shipment = await register();
    // 19:30 in Bogotá is already the next day in UTC.
    t.setNow("2026-10-02T00:30:00Z");
    const result = await board();
    expect(result.date).toBe("2026-10-01");
    expect(numbers(result.shipments)).toEqual(numbers([shipment]));
    expect(result.serverTime).toBe("2026-10-02T00:30:00.000Z");
  });

  it("dates every response with the server clock, fake or not (research R9)", async () => {
    t.setNow("2026-10-02T00:30:00Z");
    const response = await t.request("/api/shipments/board", { cookie: dispatcher.cookie });
    expect(response.headers.get("date")).toBe("Fri, 02 Oct 2026 00:30:00 GMT");
  });

  it("is only for the owner and dispatchers", async () => {
    const courier = await t.signIn("courier");
    const response = await t.request("/api/shipments/board", { cookie: courier.cookie });
    expect(response.status).toBe(403);
  });
});

/** The courier's records on the panel (feature 003, FR-033, FR-036, research R11). */
describe("courier records on the board and the shipment", () => {
  async function delivered(
    delivery: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ) {
    const ana = await courierWithAccount(t, database.db);
    const shipment = await register(overrides);
    const route = await createRoute(t, dispatcher.cookie, {
      shipmentIds: [shipment.id],
      courierId: ana.id,
    });
    await routeAction(t, dispatcher.cookie, route, "/dispatch");
    await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      { shipmentId: shipment.id, kind: "delivery", receivedByName: "Laura Gómez", ...delivery },
    ]);
    return shipment;
  }

  const flagsOf = async (shipment: Shipment) =>
    (await board()).shipments.find((each) => each.id === shipment.id)?.recordFlags;

  it("flags a delivery without photo, and one whose photo is on its way (US1 scenario 4)", async () => {
    const withoutPhoto = await delivered({ cashAmount: 85_000 });
    const photoId = crypto.randomUUID();
    const withPhoto = await delivered({
      cashAmount: 85_000,
      photos: [{ id: photoId, kind: "proof" }],
    });

    expect(await flagsOf(withoutPhoto)).toEqual(["no_photo"]);
    expect(await flagsOf(withPhoto)).toEqual(["photo_pending"]);

    await database.db
      .update(recordPhotos)
      .set({ uploadedAt: t.now(), byteSize: 2048 })
      .where(eq(recordPhotos.id, photoId));
    expect(await flagsOf(withPhoto)).toEqual([]);
  });

  it("treats a photo missing for 24 hours as no photo (FR-023)", async () => {
    const shipment = await delivered({
      cashAmount: 85_000,
      photos: [{ id: crypto.randomUUID(), kind: "proof" }],
    });
    t.setNow("2026-10-02T15:01:00Z");
    const result = await board("?date=2026-10-01");
    expect(result.shipments.find((each) => each.id === shipment.id)?.recordFlags).toEqual([
      "no_photo",
    ]);
  });

  it("flags a collection different from the COD amount (US1 scenario 6)", async () => {
    const shipment = await delivered({
      cashAmount: 80_000,
      note: "Pagó 80.000; el resto mañana",
      photos: [{ id: crypto.randomUUID(), kind: "proof" }],
    });
    expect(await flagsOf(shipment)).toEqual(["photo_pending", "collection_differs"]);
  });

  it("has no flags before any record", async () => {
    const shipment = await register();
    expect(await flagsOf(shipment)).toEqual([]);
  });

  it("shows the records, their photos, and the collection in the shipment (FR-036)", async () => {
    const photoId = crypto.randomUUID();
    const shipment = await delivered({
      cashAmount: 50_000,
      companyTransferAmount: 35_000,
      location: { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 },
      photos: [
        { id: photoId, kind: "proof" },
        { id: crypto.randomUUID(), kind: "transfer_receipt" },
      ],
    });
    await database.db
      .update(recordPhotos)
      .set({ uploadedAt: t.now(), byteSize: 2048 })
      .where(eq(recordPhotos.id, photoId));

    const { body } = await send<ShipmentDetail>(
      t,
      dispatcher.cookie,
      `/api/shipments/${shipment.id}`,
    );

    expect(body.records.map((record) => record.kind)).toEqual(["pickup", "delivery"]);
    expect(body.records[1]).toMatchObject({
      outcome: "applied",
      courier: { name: "Ana Ruiz" },
      author: { name: "Ana Ruiz" },
      onBehalf: false,
      occurredAt: "2026-10-01T15:00:00.000Z",
      recordedAt: "2026-10-01T15:00:00.000Z",
      location: { latitude: 6.2442, longitude: -75.5812, accuracyM: 12 },
      receivedByName: "Laura Gómez",
      cashAmount: 50_000,
      companyTransferAmount: 35_000,
      merchantTransferAmount: 0,
      exceptionReason: null,
      disbursementAmount: null,
      payee: null,
      reverted: null,
    });
    expect(body.records[1]?.photos).toEqual(
      expect.arrayContaining([
        { id: photoId, kind: "proof", uploaded: true },
        { id: expect.any(String), kind: "transfer_receipt", uploaded: false },
      ]),
    );
    expect(body.recordFlags).toEqual(["photo_pending"]);
  });
});
