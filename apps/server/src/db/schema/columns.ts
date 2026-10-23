import { sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

/** Fresh column builders: a builder must not be shared between tables. */
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** PostgreSQL 18 migration/direct-fixture fallback; ordinary API creation uses Node crypto. */
export const publicCodeDefault = () =>
  sql`translate(rtrim(encode(substring(sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid())) from 1 for 16), 'base64'), '='), '+/', '-_')`;
