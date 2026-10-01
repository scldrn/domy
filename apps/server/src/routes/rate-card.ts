import {
  bogotaLocalTimeToInstant,
  bogotaToday,
  entryInForce,
  rateCardEntryInput,
  type RateCard,
  type RateCardEntry,
} from "@domy/domain";
import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { merchants, rateCardEntries, rateZones, users } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { auditedCreate, requireActiveZone } from "../lib/master-data.ts";
import { validate } from "../lib/validate.ts";

const merchantQuery = z.object({ merchantId: z.uuid().optional() });

/** Rate card entries with names, newest effective date first, ties by latest added. */
async function findEntries(db: Executor, where: SQL | undefined) {
  const rows = await db
    .select({
      entry: rateCardEntries,
      merchant: { id: merchants.id, name: merchants.name },
      rateZone: { id: rateZones.id, name: rateZones.name },
      createdBy: { id: users.id, name: users.name },
    })
    .from(rateCardEntries)
    .leftJoin(merchants, eq(merchants.id, rateCardEntries.merchantId))
    .leftJoin(rateZones, eq(rateZones.id, rateCardEntries.rateZoneId))
    .innerJoin(users, eq(users.id, rateCardEntries.createdBy))
    .where(where)
    .orderBy(desc(rateCardEntries.effectiveFrom), desc(rateCardEntries.createdAt));
  return rows.map(({ entry, ...names }) => ({
    raw: entry,
    view: {
      id: entry.id,
      kind: entry.kind,
      merchant: entry.merchantId ? names.merchant : null,
      rateZone: entry.rateZoneId ? names.rateZone : null,
      amount: entry.amount,
      effectiveFrom: bogotaToday(entry.effectiveFrom),
      createdAt: entry.createdAt.toISOString(),
      createdBy: names.createdBy,
    },
  }));
}

/** The standard entries, plus one merchant's overrides when given. */
const standardAnd = (merchantId: string | undefined) =>
  merchantId
    ? or(isNull(rateCardEntries.merchantId), eq(rateCardEntries.merchantId, merchantId))
    : isNull(rateCardEntries.merchantId);

/** The append-only rate card (FR-028): read by the office, changed by the owner. */
export const rateCardRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requireRole("owner", "dispatcher"),
    validate("query", merchantQuery.extend({ at: z.iso.datetime({ offset: true }).optional() })),
    async (c) => {
      const { merchantId, at: requested } = c.req.valid("query");
      const at = requested ? new Date(requested) : c.get("clock")();
      const db = c.get("db");
      const entries = await findEntries(db, standardAnd(merchantId));
      const pick = (
        kind: RateCardEntry["kind"],
        zoneId: string | null,
        merchant: string | null,
      ) => {
        const candidates = entries.filter(
          ({ raw }) =>
            raw.kind === kind &&
            raw.merchantId === merchant &&
            (zoneId === null || raw.rateZoneId === zoneId),
        );
        const chosen = entryInForce(
          candidates.map(({ raw }) => raw),
          at,
        );
        return candidates.find(({ raw }) => raw === chosen)?.view ?? null;
      };
      const zones = await db
        .select({ id: rateZones.id, name: rateZones.name })
        .from(rateZones)
        .where(eq(rateZones.isActive, true))
        .orderBy(rateZones.name);
      return c.json({
        at: at.toISOString(),
        zones: zones.map((rateZone) => ({
          rateZone,
          standard: pick("zone_rate", rateZone.id, null),
          merchant: merchantId ? pick("zone_rate", rateZone.id, merchantId) : null,
        })),
        expressSurcharge: {
          standard: pick("express_surcharge", null, null),
          merchant: merchantId ? pick("express_surcharge", null, merchantId) : null,
        },
        scheduled: entries
          .filter(({ raw }) => raw.effectiveFrom.getTime() > at.getTime())
          .map(({ view }) => view)
          .reverse(),
      } satisfies RateCard);
    },
  )
  .get("/history", requireRole("owner"), validate("query", merchantQuery), async (c) => {
    const { merchantId } = c.req.valid("query");
    const entries = await findEntries(
      c.get("db"),
      merchantId ? eq(rateCardEntries.merchantId, merchantId) : undefined,
    );
    return c.json({ items: entries.map(({ view }) => view) });
  })
  // A new entry from 00:00 in Bogotá of its day, today or later; nothing is edited or removed.
  .post("/entries", requireRole("owner"), validate("json", rateCardEntryInput), async (c) => {
    const { id, effectiveFrom, ...input } = c.req.valid("json");
    const now = c.get("clock")();
    if (effectiveFrom < bogotaToday(now)) {
      throw new AppError("invalid_request", {
        fields: { effectiveFrom: "La vigencia empieza hoy o en una fecha futura." },
      });
    }
    if (input.rateZoneId) await requireActiveZone(c.get("db"), input.rateZoneId);
    const created = await auditedCreate(c, { type: "rate_card_entry", id }, async (tx) => {
      const values = {
        ...input,
        effectiveFrom: bogotaLocalTimeToInstant(effectiveFrom, "00:00"),
        createdBy: c.get("user").id,
      };
      const inserted = await tx
        .insert(rateCardEntries)
        .values({ id, ...values })
        .onConflictDoNothing({ target: rateCardEntries.id })
        .returning({ id: rateCardEntries.id });
      return inserted.length > 0 && { ...input, effectiveFrom };
    }).catch((error: unknown) => {
      const cause = error instanceof Error && "cause" in error ? error.cause : error;
      if (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === "23503"
      ) {
        throw new AppError("invalid_request", { message: "La zona o el cliente no existen." });
      }
      throw error;
    });
    const [entry] = await findEntries(c.get("db"), and(eq(rateCardEntries.id, id)));
    return c.json(entry?.view, created ? 201 : 200);
  });
