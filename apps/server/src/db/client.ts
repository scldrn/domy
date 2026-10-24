import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

/**
 * Bounded connections (ROB-1): a fixed pool, a connect timeout, and server-side limits so a
 * runaway statement or a transaction left open cannot hold a pooled connection forever.
 */
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 10,
    connection: { statement_timeout: 15_000, idle_in_transaction_session_timeout: 30_000 },
  });
  return drizzle({ client, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the database or a transaction: helpers run inside the caller's transaction. */
export type Executor = Db | Tx;
