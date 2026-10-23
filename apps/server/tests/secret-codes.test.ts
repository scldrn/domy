import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeText } from "@domy/domain";
import { createDb, type Db } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";
import {
  municipalities,
  neighborhoods,
  pickupPoints,
  rateCardEntries,
  rateZones,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";

const serverDir = new URL("../", import.meta.url).pathname;
const migrationsDir = new URL("../src/db/migrations/", import.meta.url).pathname;
const journalSchema = z.object({
  version: z.string(),
  dialect: z.literal("postgresql"),
  entries: z.array(
    z.object({
      idx: z.number().int(),
      version: z.string(),
      when: z.number().int(),
      tag: z.string(),
      breakpoints: z.boolean(),
    }),
  ),
});

const clientSuppliedCode = "A".repeat(22);
const isSecretCode = (value: string | null): boolean =>
  value !== null && /^[A-Za-z0-9_-]{22}$/.test(value);

let container: StartedPostgreSqlContainer;
let database: Db;
let databaseUrl: string;
let t: ReturnType<typeof createTestApp>;
let owner: { user: { id: string } };
let dispatcher: { cookie: string };
let merchantId: string;
let pickupPointId: string;
let recipientNeighborhoodId: string;
let temporary = "";
const extraDatabases: Db[] = [];

beforeAll(async () => {
  const cache = join(serverDir, "node_modules/.cache");
  await mkdir(cache, { recursive: true });
  temporary = await mkdtemp(join(cache, "secret-codes-"));
  container = await new PostgreSqlContainer("postgres:18").start();
  databaseUrl = container.getConnectionUri();
  await runMigrations(databaseUrl);
  database = createDb(databaseUrl);
});

afterAll(async () => {
  await Promise.allSettled([
    database.$client.end(),
    ...extraDatabases.map((connection) => connection.$client.end()),
  ]);
  await container.stop();
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

beforeEach(async () => {
  const tables = await database.execute<{ tablename: string }>(sql`
    select tablename from pg_tables where schemaname = 'public'
  `);
  const names = tables.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`).join(", ");
  await database.execute(sql.raw(`truncate table ${names} restart identity cascade`));

  t = createTestApp(database, { now: "2026-10-01T15:00:00Z" });
  const signedOwner = await t.signIn("owner");
  owner = { user: { id: signedOwner.user.id } };
  dispatcher = await t.signIn("dispatcher");

  merchantId = crypto.randomUUID();
  const merchantResponse = await t.request("/api/merchants", {
    method: "POST",
    cookie: dispatcher.cookie,
    body: { id: merchantId, name: "Tienda para códigos" },
  });
  expect(merchantResponse.status).toBe(201);

  const zoneId = crypto.randomUUID();
  const municipalityId = crypto.randomUUID();
  recipientNeighborhoodId = crypto.randomUUID();
  pickupPointId = crypto.randomUUID();
  await database.insert(rateZones).values({ id: zoneId, name: "Zona de prueba" });
  await database.insert(municipalities).values({ id: municipalityId, name: "Municipio de prueba" });
  await database.insert(neighborhoods).values({
    id: recipientNeighborhoodId,
    name: "Barrio de prueba",
    nameNormalized: normalizeText("Barrio de prueba"),
    municipalityId,
    rateZoneId: zoneId,
    kind: "neighborhood",
  });
  await database.insert(pickupPoints).values({
    id: pickupPointId,
    merchantId,
    label: "Bodega",
    address: "Calle 1 # 2-3",
    neighborhoodId: recipientNeighborhoodId,
    isDefault: true,
  });
  await database.insert(rateCardEntries).values({
    id: crypto.randomUUID(),
    kind: "zone_rate",
    amount: 13000,
    rateZoneId: zoneId,
    effectiveFrom: new Date("2026-01-01T05:00:00Z"),
    createdBy: owner.user.id,
  });
});

function shipment(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind: "delivery",
    merchantId,
    pickupPointId,
    recipientName: "Laura Gómez",
    recipientPhone: "3001234567",
    recipientAddress: "Calle 10 # 43-12",
    recipientNeighborhoodId,
    paymentMode: "merchant_account",
    fee: 13000,
    ...overrides,
  };
}

async function post(path: string, body: unknown) {
  const response = await t.request(path, { method: "POST", cookie: dispatcher.cookie, body });
  return response.status;
}

async function readShipmentCode(
  id: string,
): Promise<{ code: string | null; trackingNumber: string }> {
  const rows = await database.execute<{ code: string | null; tracking_number: string }>(sql`
    select to_jsonb(s)->>'tracking_code' as code, s.tracking_number
    from shipments s where s.id = ${id}::uuid
  `);
  const row = rows[0];
  if (!row) throw new Error("Expected the shipment code row");
  return { code: row.code, trackingNumber: row.tracking_number };
}

async function readMerchantCode(id: string): Promise<string | null> {
  const rows = await database.execute<{ code: string | null }>(sql`
    select to_jsonb(m)->>'link_code' as code from merchants m where m.id = ${id}::uuid
  `);
  return rows[0]?.code ?? null;
}

function hasSecretField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSecretField);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      ["trackingCode", "tracking_code", "linkCode", "link_code"].includes(key) ||
      hasSecretField(nested),
  );
}

function sqlState(error: unknown): string | null {
  if (!(error instanceof Error) || typeof error.cause !== "object" || error.cause === null) {
    return null;
  }
  const code = Reflect.get(error.cause, "code");
  return typeof code === "string" ? code : null;
}

async function probeShipmentInsert(
  source: Record<string, unknown>,
  changes: Record<string, unknown>,
): Promise<{ inserted: boolean; state: string | null }> {
  const id = crypto.randomUUID();
  let trackingNumber: string;
  do {
    trackingNumber = `Z${crypto.randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase()}`;
  } while (
    (
      await database.execute(sql`
        select 1 from shipments where tracking_number = ${trackingNumber}
      `)
    ).length > 0
  );
  const payload = {
    ...source,
    id,
    tracking_number: trackingNumber,
    ...changes,
  };
  try {
    const inserted = await database.execute<{ id: string }>(sql`
      insert into public.shipments
      select (jsonb_populate_record(null::public.shipments, ${JSON.stringify(payload)}::jsonb)).*
      on conflict do nothing
      returning id
    `);
    if (inserted.length > 0) {
      await database.execute(sql`delete from public.shipments where id = ${id}::uuid`);
    }
    return { inserted: inserted.length > 0, state: null };
  } catch (error) {
    return { inserted: false, state: sqlState(error) };
  }
}

async function probeMerchantInsert(
  source: Record<string, unknown>,
  changes: Record<string, unknown>,
): Promise<{ inserted: boolean; state: string | null }> {
  const id = crypto.randomUUID();
  const suffix = crypto.randomUUID();
  const payload = {
    ...source,
    id,
    name: `Constraint probe ${suffix}`,
    name_normalized: `constraint probe ${suffix}`,
    ...changes,
  };
  try {
    const inserted = await database.execute<{ id: string }>(sql`
      insert into public.merchants
      select (jsonb_populate_record(null::public.merchants, ${JSON.stringify(payload)}::jsonb)).*
      on conflict do nothing
      returning id
    `);
    if (inserted.length > 0) {
      await database.execute(sql`delete from public.merchants where id = ${id}::uuid`);
    }
    return { inserted: inserted.length > 0, state: null };
  } catch (error) {
    return { inserted: false, state: sqlState(error) };
  }
}

async function legacyData(db: Db) {
  const rows = await db.execute<{ data: unknown }>(sql`
    select jsonb_build_object(
      'merchants', (select jsonb_agg(to_jsonb(m) - 'link_code' - 'link_replaced_at' order by id) from merchants m),
      'pickup_points', (select jsonb_agg(to_jsonb(p) order by id) from pickup_points p),
      'shipments', (select jsonb_agg(to_jsonb(s) - 'tracking_code' - 'notified_at' - 'notified_by' order by id) from shipments s),
      'shipment_events', (select jsonb_agg(to_jsonb(e) order by id) from shipment_events e),
      'audit_events', (select jsonb_agg(to_jsonb(a) order by id) from audit_events a)
    ) as data
  `);
  return rows[0]?.data;
}

async function seedNonempty0008(db: Db): Promise<void> {
  const actorId = "00400000-0000-4000-8000-000000000001";
  const zoneId = "00400000-0000-4000-8000-000000000002";
  const municipalityId = "00400000-0000-4000-8000-000000000003";
  const neighborhoodId = "00400000-0000-4000-8000-000000000004";
  const merchantOne = {
    id: "00400000-0000-4000-8000-000000000005",
    name: "Fixture Merchant One",
    normalized: "fixture merchant one",
  };
  const merchantTwo = {
    id: "00400000-0000-4000-8000-000000000006",
    name: "Fixture Merchant Two",
    normalized: "fixture merchant two",
  };
  const merchants = [merchantOne, merchantTwo];
  const pointOne = { id: "00400000-0000-4000-8000-000000000007", merchantId: merchantOne.id };
  const pointTwo = { id: "00400000-0000-4000-8000-000000000008", merchantId: merchantTwo.id };
  const points = [pointOne, pointTwo];
  const shipments = [
    {
      id: "00400000-0000-4000-8000-000000000009",
      tracking: "BASE0001",
      merchantId: merchantOne.id,
      pointId: pointOne.id,
      reference: "legacy-one",
    },
    {
      id: "00400000-0000-4000-8000-000000000010",
      tracking: "BASE0002",
      merchantId: merchantTwo.id,
      pointId: pointTwo.id,
      reference: "legacy-two",
    },
  ];

  await db.execute(sql`
    insert into users(id, name, email, role)
    values (${actorId}::uuid, 'T002 Upgrade Owner', 't002-upgrade@example.invalid', 'owner')
  `);
  await db.execute(sql`insert into rate_zones(id, name) values (${zoneId}::uuid, 'Upgrade Zone')`);
  await db.execute(
    sql`insert into municipalities(id, name) values (${municipalityId}::uuid, 'Upgrade Town')`,
  );
  await db.execute(sql`
    insert into neighborhoods(id, name, name_normalized, municipality_id, rate_zone_id, kind)
    values (${neighborhoodId}::uuid, 'Upgrade Area', 'upgrade area', ${municipalityId}::uuid, ${zoneId}::uuid, 'neighborhood')
  `);

  for (const merchant of merchants) {
    await db.execute(sql`
      insert into merchants(id, name, name_normalized)
      values (${merchant.id}::uuid, ${merchant.name}, ${merchant.normalized})
    `);
    await db.execute(sql`
      insert into audit_events(entity_type, entity_id, action, actor_user_id, occurred_at, changes)
      values ('merchant', ${merchant.id}::uuid, 'created', ${actorId}::uuid,
        '2026-10-01T15:00:00Z', jsonb_build_object('name', jsonb_build_array(null, ${merchant.name}::text)))
    `);
  }
  for (const point of points) {
    await db.execute(sql`
      insert into pickup_points(id, merchant_id, label, address, neighborhood_id, is_default)
      values (${point.id}::uuid, ${point.merchantId}::uuid, 'Upgrade Pickup', 'Calle 1 # 2-3', ${neighborhoodId}::uuid, true)
    `);
  }
  for (const [index, item] of shipments.entries()) {
    const phone = index === 0 ? "3000000001" : "3000000002";
    await db.execute(sql`
      insert into shipments(
        id, tracking_number, kind, status, service_date, merchant_id, pickup_point_id,
        pickup_address, pickup_neighborhood_id, recipient_name, recipient_phone,
        recipient_address, recipient_neighborhood_id, rate_zone_id, service_level,
        calculated_fee, fee, fee_needs_review, payment_mode, cod_amount, merchant_reference,
        registered_at, registered_by
      ) values (
        ${item.id}::uuid, ${item.tracking}, 'delivery', 'registered', '2026-10-01',
        ${item.merchantId}::uuid, ${item.pointId}::uuid, 'Calle 1 # 2-3', ${neighborhoodId}::uuid,
        'Upgrade Recipient', ${phone}, 'Calle 4 # 5-6', ${neighborhoodId}::uuid, ${zoneId}::uuid,
        'standard', 13000, 13000, false, 'merchant_account', 0, ${item.reference},
        '2026-10-01T15:00:00Z', ${actorId}::uuid
      )
    `);
    await db.execute(sql`
      insert into shipment_events(shipment_id, type, to_status, actor_user_id, occurred_at, changes)
      values (${item.id}::uuid, 'created', 'registered', ${actorId}::uuid,
        '2026-10-01T15:00:00Z', jsonb_build_object('fee', jsonb_build_array(null, 13000)))
    `);
  }
}

describe("generated public secret codes (004/T002)", () => {
  it("generates independent codes for single, bulk, and merchant creation without accepting client codes", async () => {
    const singleId = crypto.randomUUID();
    const single = await post(
      "/api/shipments",
      shipment(singleId, {
        trackingCode: clientSuppliedCode,
        tracking_code: clientSuppliedCode,
      }),
    );
    expect(single).toBe(201);

    const bulkIds = [crypto.randomUUID(), crypto.randomUUID()];
    const bulk = await post("/api/bulk/confirm", {
      batchId: crypto.randomUUID(),
      merchantId,
      rows: bulkIds.map((id, index) =>
        shipment(id, {
          merchantReference: `bulk-${String(index)}`,
          confirmed: true,
          trackingCode: clientSuppliedCode,
          tracking_code: clientSuppliedCode,
        }),
      ),
    });
    expect(bulk).toBe(201);

    const otherMerchantId = crypto.randomUUID();
    const otherMerchant = await post("/api/merchants", {
      id: otherMerchantId,
      name: "Otra tienda para códigos",
      linkCode: clientSuppliedCode,
      link_code: clientSuppliedCode,
    });
    expect(otherMerchant).toBe(201);

    const shipmentRows = await Promise.all([singleId, ...bulkIds].map(readShipmentCode));
    const shipmentCodes = shipmentRows.map((row) => row.code);
    expect(shipmentCodes.every(isSecretCode)).toBe(true);
    expect(new Set(shipmentCodes).size === shipmentCodes.length).toBe(true);
    expect(shipmentRows.every((row) => row.code !== row.trackingNumber)).toBe(true);
    expect(shipmentCodes.every((code) => code !== clientSuppliedCode)).toBe(true);

    const merchantCodes = await Promise.all([merchantId, otherMerchantId].map(readMerchantCode));
    expect(merchantCodes.every(isSecretCode)).toBe(true);
    expect(new Set(merchantCodes).size === merchantCodes.length).toBe(true);
    expect(merchantCodes.every((code) => code !== clientSuppliedCode)).toBe(true);
  });

  it("keeps codes stable through concurrent creation replay and edits, outside creation audit snapshots", async () => {
    const shipmentId = crypto.randomUUID();
    const shipmentBody = shipment(shipmentId);
    const concurrent = await Promise.all([
      post("/api/shipments", shipmentBody),
      post("/api/shipments", shipmentBody),
    ]);
    expect(concurrent.every((status) => status === 200 || status === 201)).toBe(true);
    expect(
      (await database.execute(sql`select id from shipments where id = ${shipmentId}::uuid`)).length,
    ).toBe(1);

    const beforeShipmentEdit = await readShipmentCode(shipmentId);
    expect(isSecretCode(beforeShipmentEdit.code)).toBe(true);
    const edit = await t.request(`/api/shipments/${shipmentId}`, {
      method: "PATCH",
      cookie: dispatcher.cookie,
      body: { actionId: crypto.randomUUID(), version: 1, instructions: "Dejar en recepción" },
    });
    expect(edit.status).toBe(200);
    const afterShipmentEdit = await readShipmentCode(shipmentId);
    expect(afterShipmentEdit.code === beforeShipmentEdit.code).toBe(true);

    const secondMerchantId = crypto.randomUUID();
    const merchantBody = { id: secondMerchantId, name: "Tienda concurrente" };
    const merchantCreates = await Promise.all([
      post("/api/merchants", merchantBody),
      post("/api/merchants", merchantBody),
    ]);
    expect(merchantCreates.every((status) => status === 200 || status === 201)).toBe(true);
    const beforeMerchantEdit = await readMerchantCode(secondMerchantId);
    expect(isSecretCode(beforeMerchantEdit)).toBe(true);
    const merchantEdit = await t.request(`/api/merchants/${secondMerchantId}`, {
      method: "PATCH",
      cookie: dispatcher.cookie,
      body: { actionId: crypto.randomUUID(), name: "Tienda concurrente editada" },
    });
    expect(merchantEdit.status).toBe(200);
    const afterMerchantEdit = await readMerchantCode(secondMerchantId);
    expect(afterMerchantEdit === beforeMerchantEdit).toBe(true);

    const shipmentEvents = await database.execute<{ changes: unknown }>(sql`
      select changes from shipment_events where shipment_id = ${shipmentId}::uuid
    `);
    const merchantAudits = await database.execute<{ changes: unknown }>(sql`
      select changes from audit_events where entity_id = ${secondMerchantId}::uuid and action = 'created'
    `);
    const shipmentCode = afterShipmentEdit.code;
    expect(shipmentEvents.every(({ changes }) => !hasSecretField(changes))).toBe(true);
    expect(merchantAudits.every(({ changes }) => !hasSecretField(changes))).toBe(true);
    expect(
      shipmentEvents.every(({ changes }) =>
        shipmentCode === null ? true : !JSON.stringify(changes).includes(shipmentCode),
      ),
    ).toBe(true);
    expect(
      merchantAudits.every(({ changes }) =>
        afterMerchantEdit === null ? true : !JSON.stringify(changes).includes(afterMerchantEdit),
      ),
    ).toBe(true);
  });

  it("enforces database code format, uniqueness, non-null values, and notification actor/time pairing", async () => {
    const shipmentId = crypto.randomUUID();
    const created = await post("/api/shipments", shipment(shipmentId));
    expect(created).toBe(201);
    const row = await database.execute<{ source: Record<string, unknown> }>(sql`
      select to_jsonb(s) as source from shipments s where s.id = ${shipmentId}::uuid
    `);
    const source = row[0]?.source;
    if (!source) throw new Error("Expected a shipment for constraint probes");

    const columns = await database.execute<{ column_name: string; is_nullable: string }>(sql`
      select column_name, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'shipments'
        and column_name in ('tracking_code', 'notified_at', 'notified_by')
    `);
    const nullableByName = new Map(
      columns.map(({ column_name, is_nullable }) => [column_name, is_nullable]),
    );
    expect(nullableByName.get("tracking_code") === "NO").toBe(true);
    expect(nullableByName.get("notified_at") === "YES").toBe(true);
    expect(nullableByName.get("notified_by") === "YES").toBe(true);

    const controlCode = crypto.randomUUID().replaceAll("-", "").slice(0, 22);
    const validControl = await probeShipmentInsert(source, { tracking_code: controlCode });
    expect(isSecretCode(controlCode)).toBe(true);
    expect(validControl.inserted).toBe(true);
    const code =
      typeof source["tracking_code"] === "string" ? source["tracking_code"] : clientSuppliedCode;
    const duplicate = await probeShipmentInsert(source, { tracking_code: code });
    expect(duplicate.inserted).toBe(false);
    const missing = await probeShipmentInsert(source, { tracking_code: null });
    expect(missing.state).toBe("23502");
    const malformed = await probeShipmentInsert(source, { tracking_code: "!".repeat(22) });
    expect(malformed.state).toBe("23514");
    const unpairedNotification = await probeShipmentInsert(source, {
      tracking_code: crypto.randomUUID().replaceAll("-", "").slice(0, 22),
      notified_at: "2026-10-01T15:00:00Z",
      notified_by: null,
    });
    expect(unpairedNotification.state).toBe("23514");

    const merchantRow = await database.execute<{ source: Record<string, unknown> }>(sql`
      select to_jsonb(m) as source from merchants m where m.id = ${merchantId}::uuid
    `);
    const merchantSource = merchantRow[0]?.source;
    if (!merchantSource) throw new Error("Expected a merchant for constraint probes");
    const merchantColumns = await database.execute<{
      column_name: string;
      is_nullable: string;
    }>(sql`
      select column_name, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'merchants'
        and column_name in ('link_code', 'link_replaced_at')
    `);
    const merchantNullableByName = new Map(
      merchantColumns.map(({ column_name, is_nullable }) => [column_name, is_nullable]),
    );
    expect(merchantNullableByName.get("link_code") === "NO").toBe(true);
    expect(merchantNullableByName.get("link_replaced_at") === "YES").toBe(true);

    const merchantControlCode = crypto.randomUUID().replaceAll("-", "").slice(0, 22);
    const validMerchantControl = await probeMerchantInsert(merchantSource, {
      link_code: merchantControlCode,
    });
    expect(isSecretCode(merchantControlCode)).toBe(true);
    expect(validMerchantControl.inserted).toBe(true);
    const merchantCode =
      typeof merchantSource["link_code"] === "string"
        ? merchantSource["link_code"]
        : clientSuppliedCode;
    const duplicateMerchant = await probeMerchantInsert(merchantSource, {
      link_code: merchantCode,
    });
    expect(duplicateMerchant.inserted).toBe(false);
    const missingMerchantCode = await probeMerchantInsert(merchantSource, { link_code: null });
    expect(missingMerchantCode.state).toBe("23502");
    const malformedMerchantCode = await probeMerchantInsert(merchantSource, {
      link_code: "!".repeat(22),
    });
    expect(malformedMerchantCode.state).toBe("23514");
  });

  it("backfills a nonempty 0008 schema without rotating codes or changing history and relationships", async () => {
    const admin = createDb(databaseUrl);
    extraDatabases.push(admin);
    await admin.execute(sql`create database t002_upgrade`);
    const upgradeUrl = new URL(databaseUrl);
    upgradeUrl.pathname = "/t002_upgrade";
    const upgrade = createDb(upgradeUrl.href);
    extraDatabases.push(upgrade);

    const prior = join(temporary, "prior-0008");
    await cp(migrationsDir, prior, { recursive: true });
    const journalPath = join(prior, "meta/_journal.json");
    const journal = journalSchema.parse(JSON.parse(await readFile(journalPath, "utf8")));
    const cutoff = journal.entries.findIndex((entry) => entry.tag === "0008_purple_red_hulk");
    expect(cutoff >= 0).toBe(true);
    await writeFile(
      journalPath,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, cutoff + 1) }),
    );
    await migrate(upgrade, { migrationsFolder: prior });
    await seedNonempty0008(upgrade);
    const before = await legacyData(upgrade);

    await migrate(upgrade, { migrationsFolder: migrationsDir });
    const merchantCodes = await upgrade.execute<{ code: string | null }>(sql`
      select to_jsonb(m)->>'link_code' as code from merchants m order by id
    `);
    const shipmentCodes = await upgrade.execute<{ code: string | null }>(sql`
      select to_jsonb(s)->>'tracking_code' as code from shipments s order by id
    `);
    expect(merchantCodes.length).toBe(2);
    expect(merchantCodes.every(({ code }) => isSecretCode(code))).toBe(true);
    expect(new Set(merchantCodes.map(({ code }) => code)).size === merchantCodes.length).toBe(true);
    expect(shipmentCodes.length).toBe(2);
    expect(shipmentCodes.every(({ code }) => isSecretCode(code))).toBe(true);
    expect(new Set(shipmentCodes.map(({ code }) => code)).size === shipmentCodes.length).toBe(true);
    const after = await legacyData(upgrade);
    expect(JSON.stringify(before) === JSON.stringify(after)).toBe(true);

    await migrate(upgrade, { migrationsFolder: migrationsDir });
    const replayedMerchantCodes = await upgrade.execute<{ code: string | null }>(sql`
      select to_jsonb(m)->>'link_code' as code from merchants m order by id
    `);
    const replayedShipmentCodes = await upgrade.execute<{ code: string | null }>(sql`
      select to_jsonb(s)->>'tracking_code' as code from shipments s order by id
    `);
    expect(
      JSON.stringify(merchantCodes.map(({ code }) => code)) ===
        JSON.stringify(replayedMerchantCodes.map(({ code }) => code)),
    ).toBe(true);
    expect(
      JSON.stringify(shipmentCodes.map(({ code }) => code)) ===
        JSON.stringify(replayedShipmentCodes.map(({ code }) => code)),
    ).toBe(true);
    expect(JSON.stringify(after) === JSON.stringify(await legacyData(upgrade))).toBe(true);
  });

  it("generates codes in the API path without relying on SQL fallback defaults", async () => {
    const admin = createDb(databaseUrl);
    extraDatabases.push(admin);
    await admin.execute(sql`create database t005_api_codes`);
    const apiUrl = new URL(databaseUrl);
    apiUrl.pathname = "/t005_api_codes";
    await runMigrations(apiUrl.href);
    const apiDatabase = createDb(apiUrl.href);
    extraDatabases.push(apiDatabase);

    const api = createTestApp(apiDatabase, { now: "2026-10-01T15:00:00Z" });
    const owner = await api.signIn("owner");
    const catalog = await createCatalog(apiDatabase, owner.user.id);
    const dispatcher = await api.signIn("dispatcher");

    await apiDatabase.execute(sql`alter table shipments alter column tracking_code drop default`);
    await apiDatabase.execute(sql`alter table merchants alter column link_code drop default`);
    const defaults = await apiDatabase.execute<{
      table_name: string;
      column_name: string;
      column_default: string | null;
    }>(sql`
      select table_name, column_name, column_default from information_schema.columns
      where table_schema = 'public' and
        ((table_name = 'shipments' and column_name = 'tracking_code') or
         (table_name = 'merchants' and column_name = 'link_code'))
    `);
    expect(defaults).toHaveLength(2);
    expect(defaults.every(({ column_default }) => column_default === null)).toBe(true);

    const create = async (path: string, body: unknown) => {
      const response = await api.request(path, {
        method: "POST",
        cookie: dispatcher.cookie,
        body,
      });
      return response.status;
    };
    const shipmentInput = (id: string, overrides: Record<string, unknown> = {}) => ({
      id,
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
    });
    const singleId = crypto.randomUUID();
    expect(await create("/api/shipments", shipmentInput(singleId))).toBe(201);
    const bulkIds = [crypto.randomUUID(), crypto.randomUUID()];
    expect(
      await create("/api/bulk/confirm", {
        batchId: crypto.randomUUID(),
        merchantId: catalog.merchant.bullish,
        rows: bulkIds.map((id, index) =>
          shipmentInput(id, {
            merchantReference: `no-default-${String(index)}`,
            confirmed: true,
          }),
        ),
      }),
    ).toBe(201);
    const newMerchantId = crypto.randomUUID();
    expect(
      await create("/api/merchants", { id: newMerchantId, name: "Tienda sin default SQL" }),
    ).toBe(201);

    const shipmentCodes = await Promise.all(
      [singleId, ...bulkIds].map(async (id) => {
        const rows = await apiDatabase.execute<{
          code: string | null;
          tracking_number: string;
        }>(sql`
          select to_jsonb(s)->>'tracking_code' as code, s.tracking_number
          from shipments s where s.id = ${id}::uuid
        `);
        const row = rows[0];
        if (!row) throw new Error("Expected an API-created shipment");
        return row;
      }),
    );
    expect(shipmentCodes.every(({ code }) => isSecretCode(code))).toBe(true);
    expect(new Set(shipmentCodes.map(({ code }) => code)).size === shipmentCodes.length).toBe(true);
    const merchantRows = await apiDatabase.execute<{ code: string | null }>(sql`
      select to_jsonb(m)->>'link_code' as code from merchants m where m.id = ${newMerchantId}::uuid
    `);
    const merchantCode = merchantRows[0]?.code ?? null;
    expect(isSecretCode(merchantCode)).toBe(true);
  });
});
