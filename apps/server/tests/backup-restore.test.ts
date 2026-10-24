import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";

/**
 * Release review DEPLOY-1, business master decision #28: the tracked scripts/backup.sh and
 * scripts/restore.sh run for real against PostgreSQL 18 (DOMY_DB_CONTAINER stands in for the
 * compose service), and the restored copy keeps every row and every COP total.
 */
const run = promisify(execFile);
const backupScript = fileURLToPath(new URL("../../../scripts/backup.sh", import.meta.url));
const restoreScript = fileURLToPath(new URL("../../../scripts/restore.sh", import.meta.url));

let container: StartedPostgreSqlContainer;
let db: Db;
let backupDir: string;

function script(path: string, args: string[], env: Record<string, string> = {}) {
  return run("bash", [path, ...args], {
    env: { PATH: process.env["PATH"], DOMY_DB_CONTAINER: container.getId(), ...env },
  });
}

async function failure(path: string, args: string[], env: Record<string, string> = {}) {
  const outcome = await script(path, args, env).then(
    () => undefined,
    (error: unknown) => error as { code: number; stderr: string },
  );
  expect(outcome, "the script should have failed").toBeDefined();
  expect(outcome?.code).not.toBe(0);
  return outcome?.stderr ?? "";
}

type Snapshot = { tables: Record<string, number>; cop: Record<string, number> };

/** Independent of verify-counts.sql: every table's rows and the money columns, by Drizzle. */
async function snapshot(target: Db): Promise<Snapshot> {
  const tables = await target.execute<{ schema: string; name: string }>(
    sql`select table_schema as schema, table_name as name from information_schema.tables
        where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE'`,
  );
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await target.execute<{ count: number }>(
      sql.raw(`select count(*)::int as count from "${table.schema}"."${table.name}"`),
    );
    counts[`${table.schema}.${table.name}`] = row?.count ?? -1;
  }
  const [money] = await target.execute<{ fee: number; cod: number; rates: number }>(
    sql`select (select coalesce(sum(fee), 0)::int from shipments) as fee,
               (select coalesce(sum(cod_amount), 0)::int from shipments) as cod,
               (select coalesce(sum(amount), 0)::int from rate_card_entries) as rates`,
  );
  return { tables: counts, cop: { ...money } };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18").start();
  await runMigrations(container.getConnectionUri());
  db = createDb(container.getConnectionUri());
  backupDir = await mkdtemp(join(tmpdir(), "domy-backup-"));

  const t = createTestApp(db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  const catalog = await createCatalog(db, owner.user.id);
  const dispatcher = await t.signIn("dispatcher");
  const shipment = (overrides: Record<string, unknown>) => ({
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
  });
  for (const body of [
    shipment({}),
    shipment({ paymentMode: "cash_on_delivery", codAmount: 85000 }),
    shipment({ paymentMode: "recipient_pays_fee", codAmount: 13000 }),
  ]) {
    const response = await t.request("/api/shipments", {
      method: "POST",
      cookie: dispatcher.cookie,
      body,
    });
    expect(response.status, await response.text()).toBe(201);
  }
}, 120_000);

afterAll(async () => {
  await db.$client.end();
  await container.stop();
  await rm(backupDir, { recursive: true, force: true });
});

describe("scripts/backup.sh and scripts/restore.sh", () => {
  let dumpPath = "";

  it("writes a checksummed custom-format dump and keeps the newest by count", async () => {
    // Two older dumps from an earlier schedule; DOMY_BACKUP_KEEP=2 keeps one of them.
    for (const stamp of ["20200101T000000Z", "20200102T000000Z"]) {
      await writeFile(join(backupDir, `domy-${stamp}.dump`), "old");
      await writeFile(join(backupDir, `domy-${stamp}.dump.sha256`), "old");
    }

    const { stdout } = await script(backupScript, [backupDir], { DOMY_BACKUP_KEEP: "2" });

    const files = (await readdir(backupDir)).sort();
    const dump = files.find(
      (file) => /^domy-\d{8}T\d{6}Z\.dump$/u.test(file) && file > "domy-2021",
    );
    expect(dump).toBeDefined();
    dumpPath = join(backupDir, dump ?? "");
    expect(files).toEqual([
      "domy-20200102T000000Z.dump",
      "domy-20200102T000000Z.dump.sha256",
      dump,
      `${dump ?? ""}.sha256`,
    ]);
    expect(stdout).toContain("removed domy-20200101T000000Z.dump");
    const { stdout: check } = await run("sh", [
      "-c",
      'cd "$1" && (sha256sum -c "$2.sha256" 2>/dev/null || shasum -a 256 -c "$2.sha256")',
      "sh",
      backupDir,
      dump ?? "",
    ]);
    expect(check).toContain(": OK");
  }, 60_000);

  it("restores into a new database with every row and COP total of the source", async () => {
    const source = await snapshot(db);
    expect(source.tables["public.shipments"]).toBe(3);
    expect(source.cop).toMatchObject({ fee: 39000, cod: 98000 });
    expect(source.tables["drizzle.__drizzle_migrations"]).toBeGreaterThan(0);

    const { stdout } = await script(restoreScript, [dumpPath, "domy_restore_check"]);

    expect(stdout).toContain("Every count and COP total matches the live database.");
    expect(stdout).toMatch(/rows public\.shipments\s+3\s+3\n/u);
    expect(stdout).toMatch(/cop shipments\.cod_amount\s+98000\s+98000\n/u);

    const restoredUrl = new URL(container.getConnectionUri());
    restoredUrl.pathname = "/domy_restore_check";
    const restored = createDb(restoredUrl.toString());
    try {
      expect(await snapshot(restored)).toEqual(source);
    } finally {
      await restored.$client.end();
    }
  }, 60_000);

  it("never restores over the live, a system, or an existing database", async () => {
    expect(await failure(restoreScript, [dumpPath, container.getDatabase()])).toContain(
      "refusing to restore over the live database",
    );
    expect(await failure(restoreScript, [dumpPath, "postgres"])).toContain("system database");
    expect(await failure(restoreScript, [dumpPath, "domy_restore_check"])).toContain(
      "already exists",
    );
    expect(await failure(restoreScript, [dumpPath, "Bad-Name"])).toContain("NEW_DATABASE");
  }, 60_000);

  it("refuses a dump whose checksum does not match", async () => {
    const tampered = join(backupDir, "domy-20990101T000000Z.dump");
    await writeFile(tampered, "not a dump");
    await writeFile(`${tampered}.sha256`, `${"0".repeat(64)}  domy-20990101T000000Z.dump\n`);
    expect(await failure(restoreScript, [tampered, "domy_restore_tampered"])).toContain(
      "checksum mismatch",
    );
  }, 60_000);

  it("fails without leaving a partial dump when PostgreSQL cannot be reached", async () => {
    const before = await readdir(backupDir);
    expect(
      await failure(backupScript, [backupDir], { DOMY_DB_CONTAINER: "domy-no-such-container" }),
    ).toContain("pg_dump failed");
    expect(await readdir(backupDir)).toEqual(before);
  }, 60_000);
});
