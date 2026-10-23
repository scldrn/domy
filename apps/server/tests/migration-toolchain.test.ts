import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDb, type Db } from "../src/db/client.ts";

const execute = promisify(execFile);
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

async function description(db: Db) {
  const columns = await db.execute(sql`
    select table_name, column_name, is_nullable,
      data_type, udt_name, column_default
    from information_schema.columns where table_schema = 'public'
    order by table_name, column_name
  `);
  const constraints = await db.execute(sql`
    select c.relname as table_name, k.conname, k.contype,
      pg_get_constraintdef(k.oid) as definition
    from pg_constraint k join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' order by c.relname, k.conname
  `);
  const enums = await db.execute(sql`
    select t.typname, e.enumlabel
    from pg_type t join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' order by t.typname, e.enumsortorder
  `);
  const indexes = await db.execute(sql`
    select tablename, indexname, indexdef from pg_indexes
    where schemaname = 'public' order by tablename, indexname
  `);
  return {
    columns: Array.from(columns),
    constraints: Array.from(constraints),
    enums: Array.from(enums),
    indexes: Array.from(indexes),
  };
}

async function preservedData(db: Db) {
  const result = await db.execute(sql`
    select jsonb_build_object(
      'users', (select jsonb_agg(to_jsonb(u) order by id) from users u),
      'merchants', (select jsonb_agg(to_jsonb(m) - 'link_code' - 'link_replaced_at' order by id) from merchants m),
      'shipments', (select jsonb_agg(to_jsonb(s) - 'tracking_code' - 'notified_at' - 'notified_by' order by id) from shipments s),
      'shipment_events', (select jsonb_agg(to_jsonb(e) - 'courier_record_id' order by id) from shipment_events e),
      'routes', (select jsonb_agg(to_jsonb(r) order by id) from routes r),
      'route_events', (select jsonb_agg(to_jsonb(e) order by id) from route_events e)
    ) as data
  `);
  return Array.from(result);
}

async function completeData(db: Db) {
  const result = await db.execute(sql`
    select jsonb_build_object(
      'users', (select jsonb_agg(to_jsonb(u) order by id) from users u),
      'merchants', (select jsonb_agg(to_jsonb(m) order by id) from merchants m),
      'shipments', (select jsonb_agg(to_jsonb(s) order by id) from shipments s),
      'shipment_events', (select jsonb_agg(to_jsonb(e) - 'courier_record_id' order by id) from shipment_events e),
      'routes', (select jsonb_agg(to_jsonb(r) order by id) from routes r),
      'route_events', (select jsonb_agg(to_jsonb(e) order by id) from route_events e)
    ) as data
  `);
  return Array.from(result);
}

/** 001/T129: exercise native SQL generation and historical upgrades, not a package-version assertion. */
describe("migration toolchain compatibility", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let versioned: Db;
  let generated: Db;
  let upgrade: Db;
  let temporary: string;
  const databases: Db[] = [];

  beforeAll(async () => {
    const cache = join(serverDir, "node_modules/.cache");
    await mkdir(cache, { recursive: true });
    temporary = await mkdtemp(join(cache, "migration-toolchain-"));
    container = await new PostgreSqlContainer("postgres:18").start();
    versioned = createDb(container.getConnectionUri());
    databases.push(versioned);
    await versioned.execute(sql`create database tooling_generated`);
    await versioned.execute(sql`create database tooling_upgrade`);
    const url = new URL(container.getConnectionUri());
    url.pathname = "/tooling_generated";
    generated = createDb(url.href);
    databases.push(generated);
    url.pathname = "/tooling_upgrade";
    upgrade = createDb(url.href);
    databases.push(upgrade);
    await migrate(versioned, { migrationsFolder: migrationsDir });
  });

  afterAll(async () => {
    await Promise.allSettled(databases.map((database) => database.$client.end()));
    await container?.stop();
    if (temporary) await rm(temporary, { recursive: true, force: true });
  });

  it("generates a fresh schema equivalent to versioned migrations without editing them", async () => {
    const output = join(temporary, "fresh");
    const args = [
      "exec",
      "drizzle-kit",
      "generate",
      "--dialect",
      "postgresql",
      "--schema",
      "./src/db/schema/*.ts",
      "--out",
      relative(serverDir, output),
      "--casing",
      "snake_case",
      "--name",
      "tooling",
    ];
    await execute("pnpm", args, { cwd: serverDir });
    const firstFiles = await readdir(output);
    expect(firstFiles.filter((name) => name.endsWith(".sql"))).toHaveLength(1);
    // The initial extension migration is intentionally separate from generated table DDL.
    await generated.execute(sql`create extension if not exists unaccent`);
    await generated.execute(sql`create extension if not exists pg_trgm`);
    await migrate(generated, { migrationsFolder: output });
    expect(await description(generated)).toEqual(await description(versioned));
    const replay = await execute("pnpm", args, { cwd: serverDir });
    expect(replay.stdout + replay.stderr).toContain("No schema changes");
    expect(await readdir(output)).toEqual(firstFiles);
    await migrate(generated, { migrationsFolder: output });
    expect(await description(generated)).toEqual(await description(versioned));
  });

  it("upgrades the 0005 schema and preserves historical data when migrations replay", async () => {
    const prior = join(temporary, "prior");
    await cp(migrationsDir, prior, { recursive: true });
    const journalPath = join(prior, "meta/_journal.json");
    const journal = journalSchema.parse(JSON.parse(await readFile(journalPath, "utf8")));
    const cutoff = journal.entries.findIndex((entry) => entry.tag === "0005_powerful_eternals");
    expect(cutoff).toBeGreaterThanOrEqual(0);
    await writeFile(
      journalPath,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, cutoff + 1) }),
    );
    await migrate(upgrade, { migrationsFolder: prior });
    await upgrade.execute(sql`
      insert into users(id,name,email,role) values
        ('00000000-0000-4000-8000-000000000001','Synthetic Owner','tooling@example.invalid','owner');
      insert into merchants(id,name,name_normalized) values
        ('00000000-0000-4000-8000-000000000002','Synthetic Merchant','synthetic merchant');
      insert into municipalities(id,name) values ('00000000-0000-4000-8000-000000000003','Synthetic Municipality');
      insert into rate_zones(id,name) values ('00000000-0000-4000-8000-000000000004','Synthetic Zone');
      insert into neighborhoods(id,name,name_normalized,municipality_id,rate_zone_id,kind) values
        ('00000000-0000-4000-8000-000000000005','Synthetic Area','synthetic area',
        '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','neighborhood');
      insert into shipments(id,tracking_number,kind,service_date,merchant_id,pickup_address,
        pickup_neighborhood_id,errand_description,calculated_fee,fee,payment_mode,cod_amount,
        registered_at,registered_by) values
        ('00000000-0000-4000-8000-000000000006','TEST0001','errand','2026-10-01',
        '00000000-0000-4000-8000-000000000002','Synthetic pickup',
        '00000000-0000-4000-8000-000000000005','Synthetic errand',13000,13000,'merchant_account',0,
        '2026-10-01T15:00:00Z','00000000-0000-4000-8000-000000000001');
      insert into shipment_events(id,shipment_id,type,to_status,actor_user_id,occurred_at,client_event_id) values
        ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000006','created','registered',
        '00000000-0000-4000-8000-000000000001','2026-10-01T15:00:00Z','00000000-0000-4000-8000-000000000008');
      insert into routes(id,service_date,number,created_by) values
        ('00000000-0000-4000-8000-000000000009','2026-10-01',1,'00000000-0000-4000-8000-000000000001');
      insert into route_events(id,route_id,type,actor_user_id,occurred_at,client_event_id) values
        ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000009','created',
        '00000000-0000-4000-8000-000000000001','2026-10-01T15:00:00Z','00000000-0000-4000-8000-000000000011');
    `);
    const before = await preservedData(upgrade);
    await migrate(upgrade, { migrationsFolder: migrationsDir });
    expect(await preservedData(upgrade)).toEqual(before);
    const afterUpgrade = await completeData(upgrade);
    expect(await description(upgrade)).toEqual(await description(versioned));
    const applied = await upgrade.execute(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by id`,
    );
    expect(applied).toHaveLength(journal.entries.length);
    await migrate(upgrade, { migrationsFolder: migrationsDir });
    expect(await completeData(upgrade)).toEqual(afterUpgrade);
    expect(
      Array.from(
        await upgrade.execute(
          sql`select hash, created_at from drizzle.__drizzle_migrations order by id`,
        ),
      ),
    ).toEqual(Array.from(applied));
    await expect(
      upgrade.execute(sql`
      update shipment_events set courier_record_id = '00000000-0000-4000-8000-000000000099'
      where id = '00000000-0000-4000-8000-000000000007'
    `),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    expect(await completeData(upgrade)).toEqual(afterUpgrade);
  });
});
