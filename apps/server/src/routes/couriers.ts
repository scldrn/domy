import { courierCreateInput, courierUpdateInput, normalizeText, type Courier } from "@domy/domain";
import { and, count, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { courierAliases, couriers, routes } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  auditedChange,
  auditedCreate,
  checkNames,
  diffValues,
  replaceAliases,
} from "../lib/master-data.ts";
import { validate } from "../lib/validate.ts";

const listQuery = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});
const idParam = z.object({ id: z.uuid() });

async function loadCouriers(db: Executor, where: SQL | undefined): Promise<Courier[]> {
  const rows = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      phone: couriers.phone,
      isActive: couriers.isActive,
    })
    .from(couriers)
    .where(where)
    .orderBy(couriers.name);
  const aliases =
    rows.length > 0
      ? await db
          .select({ courierId: courierAliases.courierId, alias: courierAliases.alias })
          .from(courierAliases)
          .where(
            inArray(
              courierAliases.courierId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(courierAliases.alias)
      : [];
  return rows.map((row) => ({
    ...row,
    aliases: aliases.filter((alias) => alias.courierId === row.id).map((alias) => alias.alias),
  }));
}

async function loadCourier(db: Executor, id: string): Promise<Courier> {
  const [courier] = await loadCouriers(db, eq(couriers.id, id));
  if (!courier) throw new AppError("not_found", { message: "No encontramos ese mensajero." });
  return courier;
}

/** The couriers directory (FR-026, FR-027): names, aliases, phone. */
export const courierRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", validate("query", listQuery), async (c) => {
    const { q, active } = c.req.valid("query");
    const db = c.get("db");
    const term = q ? `%${normalizeText(q)}%` : null;
    const items = await loadCouriers(
      db,
      and(
        active ? eq(couriers.isActive, active === "true") : undefined,
        term
          ? or(
              sql`unaccent(lower(${couriers.name})) like ${term}`,
              inArray(
                couriers.id,
                db
                  .select({ id: courierAliases.courierId })
                  .from(courierAliases)
                  .where(ilike(courierAliases.aliasNormalized, term)),
              ),
            )
          : undefined,
      ),
    );
    return c.json({ items });
  })
  .post("/", validate("json", courierCreateInput), async (c) => {
    const { id, aliases, ...input } = c.req.valid("json");
    const created = await auditedCreate(c, { type: "courier", id }, async (tx) => {
      const [existing] = await tx
        .select({ id: couriers.id })
        .from(couriers)
        .where(eq(couriers.id, id));
      if (existing) return false;
      await checkNames(tx, "courier", id, { name: input.name, aliases });
      await tx.insert(couriers).values({ id, ...input });
      await replaceAliases(tx, "courier", id, aliases);
      return { ...input, aliases };
    });
    return c.json(await loadCourier(c.get("db"), id), created ? 201 : 200);
  })
  .patch("/:id", validate("param", idParam), validate("json", courierUpdateInput), async (c) => {
    const { id } = c.req.valid("param");
    const { actionId, ...input } = c.req.valid("json");
    await auditedChange(c, { type: "courier", id, actionId }, async (tx) => {
      const current = await loadCourier(tx, id);
      await checkNames(tx, "courier", id, { name: input.name, aliases: input.aliases });
      const changes = diffValues(current, input);
      if (Object.keys(changes).length === 0) return null;
      const { aliases, ...fields } = input;
      await tx
        .update(couriers)
        .set({ ...fields, updatedAt: c.get("clock")() })
        .where(eq(couriers.id, id));
      if (aliases) await replaceAliases(tx, "courier", id, aliases);
      return changes;
    });
    // Their routes in preparation or in progress stay with them until reassigned (FR-010).
    const [open] = await c
      .get("db")
      .select({ count: count() })
      .from(routes)
      .where(and(eq(routes.courierId, id), inArray(routes.status, ["draft", "in_progress"])));
    return c.json({ ...(await loadCourier(c.get("db"), id)), openRoutes: open?.count ?? 0 });
  });
