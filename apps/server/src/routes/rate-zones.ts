import { rateZoneCreateInput, rateZoneUpdateInput, type RateZone } from "@domy/domain";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { rateZones } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { auditedChange, auditedCreate, diffValues } from "../lib/master-data.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const idParam = z.object({ id: z.uuid() });

async function loadRateZone(db: Executor, id: string): Promise<RateZone> {
  const [zone] = await db
    .select({ id: rateZones.id, name: rateZones.name, isActive: rateZones.isActive })
    .from(rateZones)
    .where(eq(rateZones.id, id));
  if (!zone) throw new AppError("not_found", { message: "No encontramos esa zona." });
  return zone;
}

function duplicateName(error: unknown): never {
  if (isUniqueViolation(error, "rate_zones_name_key")) {
    throw new AppError("invalid_request", {
      fields: { name: "Ya existe una zona con ese nombre." },
    });
  }
  throw error;
}

/** Rate zones: read by the office, managed by the owner (FR-028). */
export const rateZoneRoutes = new Hono<AppEnv>()
  .get("/", requireRole("owner", "dispatcher"), async (c) => {
    const rows = await c
      .get("db")
      .select({ id: rateZones.id, name: rateZones.name, isActive: rateZones.isActive })
      .from(rateZones)
      .orderBy(rateZones.name);
    return c.json({ items: rows });
  })
  .post("/", requireRole("owner"), validate("json", rateZoneCreateInput), async (c) => {
    const { id, name } = c.req.valid("json");
    const created = await auditedCreate(c, { type: "rate_zone", id }, async (tx) => {
      const inserted = await tx
        .insert(rateZones)
        .values({ id, name })
        .onConflictDoNothing({ target: rateZones.id })
        .returning({ id: rateZones.id });
      return inserted.length > 0 && { name };
    }).catch(duplicateName);
    return c.json(await loadRateZone(c.get("db"), id), created ? 201 : 200);
  })
  .patch(
    "/:id",
    requireRole("owner"),
    validate("param", idParam),
    validate("json", rateZoneUpdateInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, ...input } = c.req.valid("json");
      await auditedChange(c, { type: "rate_zone", id, actionId }, async (tx) => {
        const changes = diffValues(await loadRateZone(tx, id), input);
        if (Object.keys(changes).length === 0) return null;
        await tx
          .update(rateZones)
          .set({ ...input, updatedAt: c.get("clock")() })
          .where(eq(rateZones.id, id));
        return changes;
      }).catch(duplicateName);
      return c.json(await loadRateZone(c.get("db"), id));
    },
  );
