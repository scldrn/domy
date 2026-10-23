import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

/** R19/T132: durable safe outcomes, including unchanged account actions (FR-042). */
export const accountActionReceipts = pgTable(
  "account_action_receipts",
  {
    clientIntentId: uuid().primaryKey(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id),
    operation: text().notNull(),
    targetUserId: uuid()
      .notNull()
      .references(() => users.id),
    input: jsonb().notNull(),
    response: jsonb().notNull(),
    status: integer().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "account_action_receipts_operation_check",
      sql`${table.operation} in ('create', 'profile', 'role', 'deactivate', 'reactivate', 'end_sessions')`,
    ),
    check(
      "account_action_receipts_status_check",
      sql`${table.status} >= 200 and ${table.status} < 300`,
    ),
  ],
);
