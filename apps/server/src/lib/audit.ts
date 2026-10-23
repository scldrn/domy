import type { AuditAction } from "@domy/domain";
import { auditEvents } from "../db/schema/index.ts";
import type { Executor } from "../db/client.ts";

export type AuditEntity =
  | "user"
  | "company_settings"
  | "merchant"
  | "pickup_point"
  | "courier"
  | "carrier"
  | "neighborhood"
  | "rate_zone"
  | "rate_card_entry";

/** Records a master data change in the caller's transaction (FR-036). */
export async function recordAudit(
  tx: Executor,
  event: {
    entityType: AuditEntity;
    entityId: string;
    action: AuditAction;
    actorUserId: string;
    occurredAt: Date;
    changes?: Record<string, unknown>;
    clientEventId?: string;
  },
): Promise<void> {
  await tx.insert(auditEvents).values(event);
}
