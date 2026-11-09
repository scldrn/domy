import {
  neighborhoodKind,
  neighborhoodUpdateInput,
  normalizeText,
  type NeighborhoodDetail,
} from "@domy/domain";
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
import { auditedChange, auditedCreate, diffValues, requireActiveZone } from "../lib/master-data.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const searchQuery = z.object({
  q: z.string().optional(),
  /** Active places by default; the catalog screen also asks for inactive ones. */
  active: z.enum(["true", "false", "all"]).optional(),
  municipalityId: z.uuid().optional(),
  kind: neighborhoodKind.optional(),
  needsReview: z.enum(["true", "false"]).optional(),
});

const idParam = z.object({ id: z.uuid() });

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
  isActive: neighborhoods.isActive,
  municipality: { id: municipalities.id, name: municipalities.name },
  rateZone: { id: rateZones.id, name: rateZones.name },
};

/**
 * Neighborhoods by name or spelling variant, best match first, with the trigram similarity
 * of the best name or variant (1 when it matches exactly once normalized).
 */
export async function searchNeighborhoods(
  db: Executor,
  { q, municipalityId, kind, needsReview, active = "true" }: z.infer<typeof searchQuery>,
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
        active === "all" ? undefined : eq(neighborhoods.isActive, active === "true"),
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
  // The catalog's counts for the sentence of «Barrios» (feature 006, US5): active places, the
  // municipalities they cover, and the additions waiting for the owner's review.
  .get("/summary", async (c) => {
    const [summary] = await c
      .get("db")
      .select({
        active: sql<number>`count(*) filter (where ${neighborhoods.isActive})`.mapWith(Number),
        municipalities:
          sql<number>`count(distinct ${neighborhoods.municipalityId}) filter (where ${neighborhoods.isActive})`.mapWith(
            Number,
          ),
        toReview:
          sql<number>`count(*) filter (where ${neighborhoods.isActive} and ${neighborhoods.needsReview})`.mapWith(
            Number,
          ),
      })
      .from(neighborhoods);
    return c.json(summary ?? { active: 0, municipalities: 0, toReview: 0 });
  })
  // Dispatchers add neighborhoods with an existing rate zone, for the owner's review (FR-036).
  .post("/", validate("json", createInput), async (c) => {
    const input = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");

    // Accepted creation replay before rate-zone active guard (Finding IV-18 / 001/T142)
    const [existing] = await db
      .select(selection)
      .from(neighborhoods)
      .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
      .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
      .where(eq(neighborhoods.id, input.id));
    if (existing) {
      return c.json(existing, 200);
    }

    await requireActiveZone(db, input.rateZoneId);
    const created = await auditedCreate(c, { type: "neighborhood", id: input.id }, async (tx) => {
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
      return { name: input.name, rateZoneId: input.rateZoneId };
    }).catch((error: unknown) => {
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
  })
  .get("/:id", validate("param", idParam), async (c) => {
    return c.json(await loadNeighborhood(c.get("db"), c.req.valid("param").id));
  })
  // Names and variants for everyone; zone, review, and deactivation for the owner (FR-026).
  .patch(
    "/:id",
    validate("param", idParam),
    validate("json", neighborhoodUpdateInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, variants, ...input } = c.req.valid("json");
      const ownerOnly =
        input.rateZoneId !== undefined ||
        input.kind !== undefined ||
        input.needsReview !== undefined ||
        input.isActive !== undefined;
      if (ownerOnly && c.get("user").role !== "owner") {
        throw new AppError("forbidden", {
          message:
            "Solo el propietario cambia la zona tarifaria o el tipo de un barrio, lo confirma o lo desactiva.",
        });
      }
      if (input.rateZoneId) await requireActiveZone(c.get("db"), input.rateZoneId);
      await auditedChange(c, { type: "neighborhood", id, actionId }, async (tx) => {
        const current = await loadNeighborhood(tx, id);
        const normalizedVariants = variants && [...new Set(variants.map(normalizeText))];
        const changes = diffValues(
          { ...current, rateZoneId: current.rateZone.id },
          { ...input, variants: normalizedVariants },
        );
        if (Object.keys(changes).length === 0) return null;
        if (Object.keys(input).length > 0) {
          await tx
            .update(neighborhoods)
            .set({ ...input, ...(input.name && { nameNormalized: normalizeText(input.name) }) })
            .where(eq(neighborhoods.id, id));
        }
        if (normalizedVariants) {
          await tx.delete(neighborhoodVariants).where(eq(neighborhoodVariants.neighborhoodId, id));
          if (normalizedVariants.length > 0) {
            await tx.insert(neighborhoodVariants).values(
              normalizedVariants.map((variant) => ({
                id: crypto.randomUUID(),
                neighborhoodId: id,
                variantNormalized: variant,
              })),
            );
          }
        }
        return changes;
      }).catch((error: unknown) => {
        if (isUniqueViolation(error, "neighborhood_variants_variant_normalized_key")) {
          throw new AppError("invalid_request", {
            fields: { variants: "Una de las variantes ya pertenece a otro barrio." },
          });
        }
        if (isUniqueViolation(error, "neighborhoods_name_municipality_key")) {
          throw new AppError("invalid_request", {
            fields: { name: "Ese barrio ya existe en el municipio." },
          });
        }
        throw error;
      });
      return c.json(await loadNeighborhood(c.get("db"), id));
    },
  );

async function loadNeighborhood(db: Executor, id: string): Promise<NeighborhoodDetail> {
  const [place] = await db
    .select(selection)
    .from(neighborhoods)
    .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
    .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
    .where(eq(neighborhoods.id, id));
  if (!place) throw new AppError("not_found", { message: "No encontramos ese barrio." });
  const variants = await db
    .select({ variant: neighborhoodVariants.variantNormalized })
    .from(neighborhoodVariants)
    .where(eq(neighborhoodVariants.neighborhoodId, id))
    .orderBy(neighborhoodVariants.variantNormalized);
  return { ...place, variants: variants.map((row) => row.variant) };
}

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
