import { normalizeText } from "@domy/domain";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import type { Db, Executor } from "../db/client.ts";
import {
  courierAliases,
  couriers,
  merchantAliases,
  merchants,
  rateZones,
} from "../db/schema/index.ts";
import { findAuditAction } from "./action-id.ts";
import { recordAudit, type AuditEntity } from "./audit.ts";
import { AppError } from "./errors.ts";
import { isUniqueViolation } from "./validate.ts";

/**
 * Audited, exactly-once master data changes (FR-036, FR-042). A creation is keyed by the new
 * record's `id`; any other change by its `actionId`, stored with its audit event. Each change
 * and its audit event are written in one transaction.
 */

/** `{ field: [old, new] }` for each field whose value changes. */
export function diffValues(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const [field, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (JSON.stringify(before[field] ?? null) !== JSON.stringify(value)) {
      changes[field] = [before[field] ?? null, value];
    }
  }
  return changes;
}

/**
 * Creates a record once: `insert` returns false when the `id` already existed, and then
 * nothing else happens. Returns whether it was created now.
 */
export async function auditedCreate(
  c: Context<AppEnv>,
  entity: { type: AuditEntity; id: string },
  insert: (tx: Executor) => Promise<Record<string, unknown> | false>,
): Promise<boolean> {
  return c.get("db").transaction(async (tx) => {
    const values = await insert(tx);
    if (!values) return false;
    await recordAudit(tx, {
      entityType: entity.type,
      entityId: entity.id,
      action: "created",
      actorUserId: c.get("user").id,
      occurredAt: c.get("clock")(),
      changes: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, [null, value]]),
      ),
    });
    return true;
  });
}

/**
 * Applies a change once per `actionId`. `apply` returns the changed fields (old and new), or
 * null when nothing changed; deactivation and reactivation are recorded as such.
 */
export async function auditedChange(
  c: Context<AppEnv>,
  entity: { type: AuditEntity; id: string; actionId: string },
  apply: (tx: Executor) => Promise<Record<string, [unknown, unknown]> | null>,
): Promise<void> {
  const db: Db = c.get("db");
  if (await findAuditAction(db, entity.actionId)) return;
  await db
    .transaction(async (tx) => {
      const changes = await apply(tx);
      if (!changes || Object.keys(changes).length === 0) return;
      const active = changes["isActive"]?.[1];
      await recordAudit(tx, {
        entityType: entity.type,
        entityId: entity.id,
        action: active === false ? "deactivated" : active === true ? "reactivated" : "updated",
        actorUserId: c.get("user").id,
        occurredAt: c.get("clock")(),
        changes,
        clientEventId: entity.actionId,
      });
    })
    .catch((error: unknown) => {
      // The same action applied by a concurrent retry.
      if (isUniqueViolation(error, "audit_events_client_event_id_key")) return;
      throw error;
    });
}

const directories = {
  merchant: { records: merchants, aliases: merchantAliases, owner: merchantAliases.merchantId },
  courier: { records: couriers, aliases: courierAliases, owner: courierAliases.courierId },
} as const;

/**
 * Checks names and aliases within one directory (FR-027): an alias identifies exactly one
 * record and never equals another record's name, and a name never equals another record's
 * name or alias. Merchant and courier directories are separate.
 */
export async function checkNames(
  tx: Executor,
  directory: keyof typeof directories,
  recordId: string,
  names: { name?: string | undefined; aliases?: string[] | undefined },
): Promise<void> {
  const { records, aliases, owner } = directories[directory];
  const aliasTexts = (names.aliases ?? []).map(normalizeText);
  if (new Set(aliasTexts).size !== aliasTexts.length) {
    throw new AppError("invalid_request", { fields: { aliases: "Hay alias repetidos." } });
  }
  const name = names.name === undefined ? null : normalizeText(names.name);
  if (name !== null && directory === "merchant") {
    const [taken] = await tx
      .select({ id: merchants.id })
      .from(merchants)
      .where(and(eq(merchants.nameNormalized, name), ne(merchants.id, recordId)));
    if (taken) {
      throw new AppError("invalid_request", {
        fields: { name: "Ya existe un cliente con ese nombre." },
      });
    }
  }
  const candidates = [...aliasTexts, ...(name === null ? [] : [name])];
  if (candidates.length === 0) return;
  const aliasOwners = await tx
    .select({ owner })
    .from(aliases)
    .where(and(inArray(aliases.aliasNormalized, candidates), ne(owner, recordId)));
  const otherRecords = await tx.select({ id: records.id, name: records.name }).from(records);
  const nameClash = otherRecords.some(
    (record) => record.id !== recordId && aliasTexts.includes(normalizeText(record.name)),
  );
  if (aliasOwners.length > 0 || nameClash) {
    throw new AppError("duplicate_alias", {
      message:
        directory === "merchant"
          ? "Ese nombre o alias ya identifica a otro cliente."
          : "Ese nombre o alias ya identifica a otro mensajero.",
    });
  }
}

/** Replaces a record's aliases with the given ones. */
export async function replaceAliases(
  tx: Executor,
  directory: keyof typeof directories,
  recordId: string,
  list: string[],
): Promise<void> {
  const rows = list.map((alias) => ({
    id: crypto.randomUUID(),
    alias,
    aliasNormalized: normalizeText(alias),
  }));
  if (directory === "merchant") {
    await tx.delete(merchantAliases).where(eq(merchantAliases.merchantId, recordId));
    if (rows.length > 0) {
      await tx
        .insert(merchantAliases)
        .values(rows.map((row) => ({ ...row, merchantId: recordId })));
    }
  } else {
    await tx.delete(courierAliases).where(eq(courierAliases.courierId, recordId));
    if (rows.length > 0) {
      await tx.insert(courierAliases).values(rows.map((row) => ({ ...row, courierId: recordId })));
    }
  }
}

/** New neighborhoods and rates use an active rate zone (FR-029). */
export async function requireActiveZone(db: Executor, rateZoneId: string): Promise<void> {
  const [zone] = await db
    .select({ isActive: rateZones.isActive })
    .from(rateZones)
    .where(eq(rateZones.id, rateZoneId));
  if (!zone?.isActive) {
    throw new AppError("invalid_request", {
      fields: { rateZoneId: "Elige una zona tarifaria activa." },
    });
  }
}
