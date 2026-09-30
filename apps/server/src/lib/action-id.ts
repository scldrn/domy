import { eq } from "drizzle-orm";
import { auditEvents, shipmentEvents } from "../db/schema/index.ts";
import type { Executor } from "../db/client.ts";

/**
 * Exactly-once support (FR-042): every mutation carries a client-generated `actionId`, stored
 * as the `client_event_id` of the event it writes. These lookups tell whether an action was
 * already applied, so the route returns the current record instead of applying it again.
 */
export async function findShipmentAction(db: Executor, actionId: string): Promise<string | null> {
  const [event] = await db
    .select({ shipmentId: shipmentEvents.shipmentId })
    .from(shipmentEvents)
    .where(eq(shipmentEvents.clientEventId, actionId));
  return event?.shipmentId ?? null;
}

export async function findAuditAction(db: Executor, actionId: string): Promise<string | null> {
  const [event] = await db
    .select({ entityId: auditEvents.entityId })
    .from(auditEvents)
    .where(eq(auditEvents.clientEventId, actionId));
  return event?.entityId ?? null;
}
