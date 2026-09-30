import { neighborhoodKind, normalizeText } from "@domy/domain";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  municipalities,
  neighborhoods,
  neighborhoodVariants,
  rateZones,
} from "../db/schema/index.ts";
import { recordAudit } from "../lib/audit.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const searchQuery = z.object({
  q: z.string().optional(),
  municipalityId: z.uuid().optional(),
  kind: neighborhoodKind.optional(),
  needsReview: z.enum(["true", "false"]).optional(),
});

const createInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, "Escribe el nombre del barrio."),
  municipalityId: z.uuid("Elige el municipio."),
  rateZoneId: z.uuid("Elige la zona tarifaria."),
  kind: neighborhoodKind.default("neighborhood"),
});

const selection = {
  id: neighborhoods.id,
  name: neighborhoods.name,
  kind: neighborhoods.kind,
  needsReview: neighborhoods.needsReview,
  municipality: { id: municipalities.id, name: municipalities.name },
  rateZone: { id: rateZones.id, name: rateZones.name },
};

/**
 * Neighborhoods by name or spelling variant, best match first, with the trigram similarity
 * of the best name or variant (1 when it matches exactly once normalized).
 */
export async function searchNeighborhoods(
  db: Executor,
  { q, municipalityId, kind, needsReview }: z.infer<typeof searchQuery>,
  limit: number,
) {
  const term = q ? normalizeText(q) : "";
  const variantScore = sql`coalesce((
    select max(similarity(${neighborhoodVariants.variantNormalized}, ${term}))
    from ${neighborhoodVariants}
    where ${neighborhoodVariants.neighborhoodId} = ${neighborhoods.id}
  ), 0)`;
  const score = sql<number>`greatest(similarity(${neighborhoods.nameNormalized}, ${term}), ${variantScore})`;
  return db
    .select({ ...selection, similarity: score })
    .from(neighborhoods)
    .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
    .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
    .where(
      and(
        eq(neighborhoods.isActive, true),
        municipalityId ? eq(neighborhoods.municipalityId, municipalityId) : undefined,
        kind ? eq(neighborhoods.kind, kind) : undefined,
        needsReview ? eq(neighborhoods.needsReview, needsReview === "true") : undefined,
        term
          ? sql`(${neighborhoods.nameNormalized} like ${`%${term}%`} or ${score} > 0.3)`
          : undefined,
      ),
    )
    .orderBy(
      term
        ? sql`(${neighborhoods.nameNormalized} = ${term}) desc, ${score} desc`
        : neighborhoods.nameNormalized,
      neighborhoods.nameNormalized,
    )
    .limit(limit);
}

export const neighborhoodRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  // Catalog search tolerant to accents, case, variants, and typos (FR-005, research R7).
  .get("/", validate("query", searchQuery), async (c) => {
    return c.json({ items: await searchNeighborhoods(c.get("db"), c.req.valid("query"), 20) });
  })
  // Dispatchers add neighborhoods with an existing rate zone, for the owner's review (FR-036).
  .post("/", validate("json", createInput), async (c) => {
    const input = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const created = await db
      .transaction(async (tx) => {
        const [row] = await tx
          .insert(neighborhoods)
          .values({
            ...input,
            nameNormalized: normalizeText(input.name),
            needsReview: user.role !== "owner",
            createdBy: user.id,
          })
          .onConflictDoNothing({ target: neighborhoods.id })
          .returning({ id: neighborhoods.id });
        if (!row) return false;
        await recordAudit(tx, {
          entityType: "neighborhood",
          entityId: row.id,
          action: "created",
          actorUserId: user.id,
          occurredAt: c.get("clock")(),
          changes: { name: [null, input.name], rateZoneId: [null, input.rateZoneId] },
        });
        return true;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error, "neighborhoods_name_municipality_key")) {
          throw new AppError("invalid_request", {
            fields: { name: "Ese barrio ya existe en el municipio." },
          });
        }
        throw error;
      });
    const [row] = await db
      .select(selection)
      .from(neighborhoods)
      .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
      .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
      .where(eq(neighborhoods.id, input.id));
    return c.json(row, created ? 201 : 200);
  });

export const municipalityRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select({ id: municipalities.id, name: municipalities.name })
      .from(municipalities)
      .orderBy(municipalities.name);
    return c.json({ items: rows });
  });
