import type { RateCard, RateCardEntry, Shipment } from "@domy/domain";
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
  // 10:00 in Bogotá on 2026-10-01.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  owner = await t.signIn("owner", { name: "Santiago Marín" });
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function call(method: string, path: string, body?: unknown, cookie = owner.cookie) {
  const response = await t.request(path, { method, cookie, body });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body: json };
}
const entry = (body: Record<string, unknown>) =>
  call("POST", "/api/rate-card/entries", { id: crypto.randomUUID(), kind: "zone_rate", ...body });

async function registerFee(): Promise<number> {
  const result = await call("POST", "/api/shipments", {
    id: crypto.randomUUID(),
    kind: "delivery",
    merchantId: catalog.merchant.bullish,
    pickupPointId: catalog.pickup.bullish,
    recipientName: "Laura Gómez",
    recipientPhone: "3001234567",
    recipientAddress: "Calle 10 # 43-12",
    recipientNeighborhoodId: catalog.place.laureles,
    paymentMode: "merchant_account",
    fee: 1,
    feeOverrideReason: "Solo para ver la tarifa calculada",
  });
  return (result.body as unknown as Shipment).calculatedFee ?? 0;
}

describe("rate card (FR-028)", () => {
  it("applies a future rate from 00:00 of its day in Bogotá (scenario 1)", async () => {
    const created = await entry({
      rateZoneId: catalog.zone.medellin,
      amount: 14000,
      effectiveFrom: "2026-10-02",
    });
    expect(created.status).toBe(201);
    expect(await registerFee()).toBe(13000);
    t.setNow("2026-10-02T04:59:00Z"); // 23:59 on 1 October in Bogotá
    expect(await registerFee()).toBe(13000);
    t.setNow("2026-10-02T05:00:00Z"); // 00:00 on 2 October
    expect(await registerFee()).toBe(14000);
  });

  it("lets the latest entry of the same day win (scenario 6)", async () => {
    await entry({ rateZoneId: catalog.zone.medellin, amount: 14000, effectiveFrom: "2026-10-01" });
    await entry({ rateZoneId: catalog.zone.medellin, amount: 13500, effectiveFrom: "2026-10-01" });
    expect(await registerFee()).toBe(13500);
  });

  it("shows the rate card in force with a merchant's overrides and the scheduled entries", async () => {
    await entry({ rateZoneId: catalog.zone.medellin, amount: 14000, effectiveFrom: "2026-11-01" });
    const standard = (await call("GET", "/api/rate-card", undefined, dispatcher.cookie))
      .body as unknown as RateCard;
    expect(standard.zones.find((zone) => zone.rateZone.id === catalog.zone.medellin)).toMatchObject(
      {
        standard: { amount: 13000, effectiveFrom: "2026-01-01" },
        merchant: null,
      },
    );
    expect(standard.expressSurcharge.standard?.amount).toBe(4500);
    expect(standard.scheduled).toMatchObject([{ amount: 14000, effectiveFrom: "2026-11-01" }]);

    const amy = (await call("GET", `/api/rate-card?merchantId=${catalog.merchant.amy}`))
      .body as unknown as RateCard;
    expect(amy.zones.find((zone) => zone.rateZone.id === catalog.zone.medellin)).toMatchObject({
      standard: { amount: 13000 },
      merchant: { amount: 9700, merchant: { name: "Amy Tecnology" } },
    });
  });

  it("adds merchant overrides of the zone rate and of the express surcharge", async () => {
    await entry({
      merchantId: catalog.merchant.bullish,
      rateZoneId: catalog.zone.medellin,
      amount: 12000,
      effectiveFrom: "2026-10-01",
    });
    await entry({
      kind: "express_surcharge",
      merchantId: catalog.merchant.bullish,
      amount: 0,
      effectiveFrom: "2026-10-01",
    });
    const card = (await call("GET", `/api/rate-card?merchantId=${catalog.merchant.bullish}`))
      .body as unknown as RateCard;
    expect(card.expressSurcharge.merchant?.amount).toBe(0);
    expect(await registerFee()).toBe(12000);
  });

  it("is changed only by the owner, only forward, and keeps its whole history (scenario 4)", async () => {
    const byDispatcher = await call(
      "POST",
      "/api/rate-card/entries",
      {
        id: crypto.randomUUID(),
        kind: "zone_rate",
        rateZoneId: catalog.zone.medellin,
        amount: 1,
        effectiveFrom: "2026-10-02",
      },
      dispatcher.cookie,
    );
    expect(byDispatcher.status).toBe(403);
    const past = await entry({
      rateZoneId: catalog.zone.medellin,
      amount: 14000,
      effectiveFrom: "2026-09-30",
    });
    expect(past.status).toBe(400);
    const invalid = await entry({ amount: 14000, effectiveFrom: "2026-10-02" });
    expect(invalid.body).toMatchObject({ error: { fields: { rateZoneId: expect.any(String) } } });

    const id = crypto.randomUUID();
    const body = {
      id,
      kind: "zone_rate",
      rateZoneId: catalog.zone.medellin,
      amount: 14000,
      effectiveFrom: "2026-10-02",
    };
    expect((await call("POST", "/api/rate-card/entries", body)).status).toBe(201);
    expect((await call("POST", "/api/rate-card/entries", body)).status).toBe(200);

    const history = (await call("GET", "/api/rate-card/history")).body["items"] as RateCardEntry[];
    const medellin = history.filter(
      (item) => item.rateZone?.id === catalog.zone.medellin && item.merchant === null,
    );
    expect(medellin.map((item) => item.amount)).toEqual([14000, 13000]);
    expect(medellin[0]?.createdBy.name).toBe("Santiago Marín");
    expect((await call("GET", "/api/rate-card/history", undefined, dispatcher.cookie)).status).toBe(
      403,
    );
    // No endpoint edits or removes entries.
    expect((await call("PATCH", `/api/rate-card/entries/${id}`, { amount: 1 })).status).toBe(404);
    expect((await call("DELETE", `/api/rate-card/entries/${id}`)).status).toBe(404);
  });
});
