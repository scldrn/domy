import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.ts";

/** Applies the versioned migrations in src/db/migrations. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const db = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: new URL("migrations", import.meta.url).pathname });
  } finally {
    await db.$client.end();
  }
}

if (import.meta.main) {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("Migrations applied");
}
