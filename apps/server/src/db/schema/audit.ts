import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { auditAction } from "./enums.ts";

/** Append-only history of master data changes, visible to the owner only (FR-036). */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    action: auditAction().notNull(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    changes: jsonb(),
    clientEventId: uuid().unique("audit_events_client_event_id_key"),
  },
  (table) => [index("audit_events_entity_idx").on(table.entityType, table.entityId)],
);
