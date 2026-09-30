import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  return drizzle({ client, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the database or a transaction: helpers run inside the caller's transaction. */
export type Executor = Db | Tx;
