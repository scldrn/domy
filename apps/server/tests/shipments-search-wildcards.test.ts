import type { Shipment, ShipmentSearchResult } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

/** What the office types is searched literally, never as a LIKE pattern (SEC-7, FR-024). */

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

async function register(merchantReference: string): Promise<Shipment> {
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
      merchantReference,
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Shipment;
}

async function search(q: string): Promise<string[]> {
  const response = await t.request(
    `/api/shipments/search?${new URLSearchParams({ q }).toString()}`,
    { cookie: dispatcher.cookie },
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as ShipmentSearchResult).items.map((item) => item.trackingNumber);
}

describe("search wildcards (SEC-7)", () => {
  it("does not match every shipment for % and matches a reference that has it", async () => {
    await register("D-254");
    await register("AB1");
    const percent = await register("50%OFF");

    expect(await search("%")).toEqual([percent.trackingNumber]);
  });

  it("treats _ and \\ as themselves", async () => {
    await register("AB1");
    const underscore = await register("A_1");
    const backslash = await register("X\\Y");

    expect(await search("A_1")).toEqual([underscore.trackingNumber]);
    expect(await search("_")).toEqual([underscore.trackingNumber]);
    expect(await search("\\")).toEqual([backslash.trackingNumber]);
  });
});
