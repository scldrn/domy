import type { ShipmentSearchResult } from "@domy/domain";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let cookie: string;

beforeAll(async () => {
  database = await startDatabase();
  t = createTestApp(database.db);
  const owner = await t.signIn("owner");
  cookie = owner.cookie;
  const catalog = await createCatalog(database.db, owner.user.id);
  // 100,000 shipments over about two and a half years of history.
  await database.db.execute(sql`
    insert into shipments (id, tracking_number, kind, service_date, merchant_id, pickup_address,
      pickup_neighborhood_id, recipient_name, recipient_name_normalized, recipient_phone,
      recipient_address, recipient_neighborhood_id, rate_zone_id, calculated_fee, fee,
      payment_mode, cod_amount, merchant_reference, registered_at, registered_by)
    select gen_random_uuid(), upper(lpad(to_hex(i), 8, '0')), 'delivery',
      date '2024-01-01' + (i % 900), ${catalog.merchant.bullish}, 'Cra 1', ${catalog.place.laureles},
      'Persona ' || i, 'persona ' || i, '300' || lpad(i::text, 7, '0'), 'Calle ' || i,
      ${catalog.place.laureles}, ${catalog.zone.medellin}, 13000, 13000, 'merchant_account', 0,
      'REF-' || i, timestamp '2024-01-01' + (i || ' minutes')::interval, ${owner.user.id}
    from generate_series(1, 100000) i`);
  await database.db.execute(sql`analyze shipments`);
}, 120_000);
afterAll(async () => {
  await database.stop();
});

describe("history search at scale (SC-006)", () => {
  it.each([
    ["tracking number", "0001-86A0", "000186A0"],
    ["merchant reference", "REF-77777", "00012FD1"],
    ["recipient phone", "300 005 4321", "0000D431"],
  ])("finds a shipment by %s among 100,000 in under 2 seconds", async (_, q, trackingNumber) => {
    const started = performance.now();
    const response = await t.request(`/api/shipments/search?q=${encodeURIComponent(q)}`, {
      cookie,
    });
    const elapsed = performance.now() - started;
    const result = (await response.json()) as ShipmentSearchResult;
    expect(result.items[0]?.trackingNumber).toBe(trackingNumber);
    expect(elapsed).toBeLessThan(2000);
  });
});
