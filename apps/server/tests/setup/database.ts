import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../../src/db/client.ts";
import { runMigrations } from "../../src/db/migrate.ts";

export type TestDatabase = {
  db: Db;
  url: string;
  /** Empties every table, keeping the schema. */
  truncate: () => Promise<void>;
  stop: () => Promise<void>;
};

/** A real PostgreSQL 18 per test file, with the migrations applied (Constitution VI). */
export async function startDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:18",
  ).start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  const db = createDb(url);
  return {
    db,
    url,
    truncate: async () => {
      const rows = await db.execute<{ tablename: string }>(
        sql`select tablename from pg_tables where schemaname = 'public'`,
      );
      const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
      await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
    },
    stop: async () => {
      await db.$client.end();
      await container.stop();
    },
  };
}
