import type { Shipment, ShipmentSearchResult } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
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
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

let minute = 0;
/** Registers a shipment one minute after the previous one. */
async function register(overrides: Record<string, unknown> = {}): Promise<Shipment> {
  minute += 1;
  t.setNow(new Date(Date.parse("2026-10-01T15:00:00Z") + minute * 60_000).toISOString());
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
      paymentMode: "merchant_account",
      fee: 13000,
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Shipment;
}

async function search(query: Record<string, string> = {}): Promise<ShipmentSearchResult> {
  const response = await t.request(
    `/api/shipments/search?${new URLSearchParams(query).toString()}`,
    {
      cookie: dispatcher.cookie,
    },
  );
  expect(response.status).toBe(200);
  return (await response.json()) as ShipmentSearchResult;
}

const numbers = (result: ShipmentSearchResult) => result.items.map((item) => item.trackingNumber);

describe("GET /api/shipments/search", () => {
  it("shows the shipment of a tracking number first, typed loosely (scenario 1)", async () => {
    const target = await register({ recipientName: "Ana Ruiz" });
    await register();
    const loose = `${target.trackingNumber.slice(0, 4).toLowerCase()} ${target.trackingNumber.slice(4)}`;
    const result = await search({ q: loose });
    expect(numbers(result)[0]).toBe(target.trackingNumber);
  });

  it("finds by recipient phone, newest first (scenario 2)", async () => {
    const older = await register({ recipientPhone: "3109876543" });
    await register();
    const newer = await register({ recipientPhone: "3109876543" });
    expect(numbers(await search({ q: "310 987-6543" }))).toEqual([
      newer.trackingNumber,
      older.trackingNumber,
    ]);
  });

  it("finds by merchant reference, merchant name or alias, and recipient name", async () => {
    const referenced = await register({ merchantReference: "D-254" });
    const amy = await register({
      merchantId: catalog.merchant.amy,
      pickupPointId: catalog.pickup.amy,
      fee: 9700,
      recipientName: "Pedro Pérez",
    });
    expect(numbers(await search({ q: "d-254" }))).toEqual([referenced.trackingNumber]);
    expect(numbers(await search({ q: "amy tech" }))).toEqual([amy.trackingNumber]);
    expect(numbers(await search({ q: "Tecnology" }))).toEqual([amy.trackingNumber]);
    expect(numbers(await search({ q: "pedro perez" }))).toEqual([amy.trackingNumber]);
    // Trigram similarity tolerates a typo in the name.
    expect(numbers(await search({ q: "Pedro Peres" }))).toEqual([amy.trackingNumber]);
  });

  it("filters by neighborhood, status, dates, merchant, and fee review (FR-024, FR-035)", async () => {
    const itagui = await register({ recipientNeighborhoodId: catalog.place.itagui, fee: 15000 });
    const early = await register({ serviceDate: "2026-09-20" });
    const voided = await register();
    await database.db
      .update(shipments)
      .set({ status: "voided", voidReason: "Cliente canceló" })
      .where(eq(shipments.id, voided.id));
    const review = await register({
      recipientNeighborhoodId: catalog.place.girardota,
      fee: 35000,
      feeOverrideReason: "Tarifa de Girardota sin definir",
    });

    expect(numbers(await search({ neighborhoodId: catalog.place.itagui }))).toEqual([
      itagui.trackingNumber,
    ]);
    expect(numbers(await search({ status: "voided" }))).toEqual([voided.trackingNumber]);
    expect(numbers(await search({ to: "2026-09-30" }))).toEqual([early.trackingNumber]);
    expect(numbers(await search({ from: "2026-10-01" }))).not.toContain(early.trackingNumber);
    expect(numbers(await search({ feeReview: "true" }))).toEqual([review.trackingNumber]);
    expect((await search({ merchantId: catalog.merchant.amy })).items).toEqual([]);
  });

  it("returns the summary fields", async () => {
    const shipment = await register({ merchantReference: "D-1" });
    const [item] = (await search()).items;
    expect(item).toEqual({
      id: shipment.id,
      trackingNumber: shipment.trackingNumber,
      kind: "delivery",
      status: "registered",
      serviceDate: "2026-10-01",
      merchant: { id: catalog.merchant.bullish, name: "Bullish Hype" },
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientNeighborhood: { id: catalog.place.laureles, name: "Laureles" },
      rateZone: { id: catalog.zone.medellin, name: "Medellín" },
      merchantReference: "D-1",
      windowStart: null,
      windowEnd: null,
      codAmount: 0,
      fee: 13000,
      feeNeedsReview: false,
      registeredAt: shipment.registeredAt,
    });
  });

  it("pages newest first with a cursor", async () => {
    const created: Shipment[] = [];
    for (let i = 0; i < 55; i++) created.push(await register());
    const first = await search();
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.trackingNumber).toBe(created.at(-1)?.trackingNumber);
    expect(first.nextCursor).not.toBeNull();
    const second = await search({ cursor: first.nextCursor ?? "" });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const all = new Set([...numbers(first), ...numbers(second)]);
    expect(all.size).toBe(55);
  });

  it("is only for the owner and dispatchers", async () => {
    const courier = await t.signIn("courier");
    const response = await t.request("/api/shipments/search", { cookie: courier.cookie });
    expect(response.status).toBe(403);
  });
});
