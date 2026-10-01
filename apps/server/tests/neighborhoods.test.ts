import type { NeighborhoodDetail, Shipment } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function call(method: string, path: string, body?: unknown, cookie = dispatcher.cookie) {
  const response = await t.request(path, { method, cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
const patch = (id: string, body: Record<string, unknown>, cookie = dispatcher.cookie) =>
  call("PATCH", `/api/neighborhoods/${id}`, { actionId: crypto.randomUUID(), ...body }, cookie);

describe("neighborhood catalog (FR-026, FR-036)", () => {
  it("lets the dispatcher add a neighborhood for the owner's review (scenario 5)", async () => {
    const created = await call("POST", "/api/neighborhoods", {
      id: crypto.randomUUID(),
      name: "La Castellana",
      municipalityId: catalog.municipality.medellin,
      rateZoneId: catalog.zone.medellin,
    });
    expect(created.body).toMatchObject({ needsReview: true });
    const review = (await call("GET", "/api/neighborhoods?needsReview=true")).body;
    expect(review["items"]).toMatchObject([{ name: "La Castellana" }]);
  });

  it("lets the dispatcher rename and add variants, but not change the zone or deactivate", async () => {
    const renamed = await patch(catalog.place.estadio, {
      name: "Estadio",
      variants: ["el estadio", "estadio atanasio"],
    });
    expect(renamed.status).toBe(200);
    const place = (await call("GET", `/api/neighborhoods/${catalog.place.estadio}`))
      .body as unknown as NeighborhoodDetail;
    expect(place).toMatchObject({ name: "Estadio", variants: ["el estadio", "estadio atanasio"] });
    const found = (await call("GET", "/api/neighborhoods?q=estadio atanasio")).body;
    expect(found["items"]).toMatchObject([{ id: catalog.place.estadio }]);

    expect(
      (await patch(catalog.place.estadio, { rateZoneId: catalog.zone.belloItagui })).status,
    ).toBe(403);
    expect((await patch(catalog.place.estadio, { isActive: false })).status).toBe(403);
    expect((await patch(catalog.place.estadio, { needsReview: false })).status).toBe(403);
  });

  it("refuses a variant that belongs to another neighborhood", async () => {
    const result = await patch(catalog.place.laureles, { variants: ["terminal norte"] });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { fields: { variants: expect.any(String) } } });
  });

  it("lets the owner change the zone, confirm the review, and deactivate (FR-008)", async () => {
    const shipment = (
      await call("POST", "/api/shipments", {
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
      })
    ).body as unknown as Shipment;

    const moved = await patch(
      catalog.place.laureles,
      { rateZoneId: catalog.zone.belloItagui, needsReview: false },
      owner.cookie,
    );
    expect(moved.body).toMatchObject({ rateZone: { id: catalog.zone.belloItagui } });
    // Existing shipments keep their fee and zone.
    const kept = (await call("GET", `/api/shipments/${shipment.id}`)).body;
    expect(kept).toMatchObject({ fee: 13000, rateZone: { id: catalog.zone.medellin } });

    const deactivated = await patch(catalog.place.laureles, { isActive: false }, owner.cookie);
    expect(deactivated.body).toMatchObject({ isActive: false });
    const found = (await call("GET", "/api/neighborhoods?q=laureles")).body;
    expect(found["items"]).toEqual([]);
  });
});

describe("inactive rate zones (FR-029)", () => {
  it("are refused for new neighborhoods and rates", async () => {
    await call(
      "PATCH",
      `/api/rate-zones/${catalog.zone.noRate}`,
      { actionId: crypto.randomUUID(), isActive: false },
      owner.cookie,
    );
    const place = await call("POST", "/api/neighborhoods", {
      id: crypto.randomUUID(),
      name: "Vereda Nueva",
      municipalityId: catalog.municipality.girardota,
      rateZoneId: catalog.zone.noRate,
    });
    expect(place.body).toMatchObject({ error: { fields: { rateZoneId: expect.any(String) } } });
    const rate = await call(
      "POST",
      "/api/rate-card/entries",
      {
        id: crypto.randomUUID(),
        kind: "zone_rate",
        rateZoneId: catalog.zone.noRate,
        amount: 20000,
        effectiveFrom: "2030-01-01",
      },
      owner.cookie,
    );
    expect(rate.status).toBe(400);
  });
});

describe("rate zones (FR-028)", () => {
  it("are managed by the owner only", async () => {
    const body = { id: crypto.randomUUID(), name: "Rionegro" };
    expect((await call("POST", "/api/rate-zones", body)).status).toBe(403);
    expect((await call("POST", "/api/rate-zones", body, owner.cookie)).status).toBe(201);
    const renamed = await call(
      "PATCH",
      `/api/rate-zones/${body.id}`,
      { actionId: crypto.randomUUID(), name: "Oriente" },
      owner.cookie,
    );
    expect(renamed.body).toMatchObject({ name: "Oriente" });
  });
});
