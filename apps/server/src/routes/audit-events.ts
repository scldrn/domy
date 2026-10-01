import type { AuditEvent } from "@domy/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { auditEvents, users } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { validate } from "../lib/validate.ts";

const pageSize = 50;
const query = z.object({
  entityType: z.string().optional(),
  entityId: z.uuid().optional(),
  /** The id of the last event of the previous page (identifiers are time-ordered). */
  cursor: z.uuid().optional(),
});

/** History of master data and user changes, newest first; owner only (FR-036). */
export const auditEventRoutes = new Hono<AppEnv>()
  .use(requireRole("owner"))
  .get("/", validate("query", query), async (c) => {
    const { entityType, entityId, cursor } = c.req.valid("query");
    const rows = await c
      .get("db")
      .select({ event: auditEvents, actor: { id: users.id, name: users.name } })
      .from(auditEvents)
      .innerJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(
        and(
          entityType ? eq(auditEvents.entityType, entityType) : undefined,
          entityId ? eq(auditEvents.entityId, entityId) : undefined,
          cursor ? sql`${auditEvents.id} < ${cursor}::uuid` : undefined,
        ),
      )
      .orderBy(desc(auditEvents.id))
      .limit(pageSize + 1);
    const items: AuditEvent[] = rows.slice(0, pageSize).map(({ event, actor }) => ({
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actor,
      occurredAt: event.occurredAt.toISOString(),
      changes: event.changes as AuditEvent["changes"],
    }));
    return c.json({
      items,
      nextCursor: rows.length > pageSize ? (items.at(-1)?.id ?? null) : null,
    });
  });
