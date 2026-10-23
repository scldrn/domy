import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportColumns } from "../src/lib/export.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let app: ReturnType<typeof createTestApp>;
let owner: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;
let catalog: Catalog;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  app = createTestApp(database.db);
  owner = await app.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
});

async function populate(count: number) {
  await database.db.execute(sql`
    insert into shipments (id, tracking_number, kind, service_date, merchant_id, pickup_address,
      pickup_neighborhood_id, recipient_name, recipient_name_normalized, recipient_phone,
      recipient_address, recipient_neighborhood_id, rate_zone_id, calculated_fee, fee,
      payment_mode, cod_amount, merchant_reference, registered_at, registered_by)
    select gen_random_uuid(), upper(lpad(to_hex(i), 8, '0')), 'delivery', date '2026-10-01',
      ${catalog.merchant.bullish}, 'Punto sintético', ${catalog.place.laureles},
      'Persona de prueba', 'persona de prueba', '3000000000', 'Dirección sintética',
      ${catalog.place.laureles}, ${catalog.zone.medellin}, 13000, 13000, 'merchant_account', 0,
      'EXPORT-' || i, timestamptz '2026-10-01T15:00:00Z' + (i || ' seconds')::interval,
      ${owner.user.id} from generate_series(1, ${count}) i
  `);
}

async function exportedLines() {
  const response = await app.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/csv");
  return (await response.text()).trim().split(/\r?\n/u);
}

describe("complete owner export at historical scale (FR-025)", () => {
  it("exports 66000 shipments without exceeding the SQL parameter limit", async () => {
    await populate(66_000);
    const lines = await exportedLines();
    expect(lines).toHaveLength(66_001);
    expect(lines.slice(1).some((line) => line.includes("EXPORT-66000"))).toBe(true);
    expect(lines.slice(1).some((line) => line.includes("EXPORT-1,"))).toBe(true);
  }, 120_000);
  it("keeps status timestamps correct across 15000 shipments with history", async () => {
    await populate(15_000);
    await database.db.execute(sql`
      insert into shipment_events (shipment_id, type, to_status, actor_user_id, occurred_at)
      select s.id, 'created', 'registered', ${owner.user.id}, s.registered_at
      from shipments s cross join generate_series(1, 2)
    `);
    const lines = await exportedLines();
    expect(lines).toHaveLength(15_001);
    const header = lines[0];
    expect(header).toContain("Fecha de estado");
    const statusColumn = exportColumns.indexOf("Fecha de estado");
    const registeredColumn = exportColumns.indexOf("Registrado el");
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      expect(cells[statusColumn]).toBe(cells[registeredColumn]);
    }
  }, 120_000);
});
