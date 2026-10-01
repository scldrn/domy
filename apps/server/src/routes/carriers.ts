import { carrierCreateInput, carrierUpdateInput, normalizeText, type Carrier } from "@domy/domain";
import { and, eq, ilike, ne } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { carriers } from "../db/schema/index.ts";
import type { Executor } from "../db/client.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { auditedChange, auditedCreate, diffValues } from "../lib/master-data.ts";
import { validate } from "../lib/validate.ts";

const listQuery = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const idParam = z.object({ id: z.uuid() });

async function loadCarrier(db: Executor, id: string): Promise<Carrier> {
  const [carrier] = await db
    .select({ id: carriers.id, name: carriers.name, isActive: carriers.isActive })
    .from(carriers)
    .where(eq(carriers.id, id));
  if (!carrier) throw new AppError("not_found", { message: "No encontramos esa transportadora." });
  return carrier;
}

async function checkName(db: Executor, id: string, name: string) {
  const [taken] = await db
    .select({ id: carriers.id })
    .from(carriers)
    .where(and(eq(carriers.nameNormalized, normalizeText(name)), ne(carriers.id, id)));
  if (taken) {
    throw new AppError("invalid_request", {
      fields: { name: "Ya existe una transportadora con ese nombre." },
    });
  }
}

/** Carriers for handoffs (FR-026). */
export const carrierRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", validate("query", listQuery), async (c) => {
    const { q, active } = c.req.valid("query");
    const rows = await c
      .get("db")
      .select({ id: carriers.id, name: carriers.name, isActive: carriers.isActive })
      .from(carriers)
      .where(
        and(
          active ? eq(carriers.isActive, active === "true") : undefined,
          q ? ilike(carriers.nameNormalized, `%${normalizeText(q)}%`) : undefined,
        ),
      )
      .orderBy(carriers.nameNormalized);
    return c.json({ items: rows });
  })
  .post("/", validate("json", carrierCreateInput), async (c) => {
    const { id, name } = c.req.valid("json");
    const created = await auditedCreate(c, { type: "carrier", id }, async (tx) => {
      const [existing] = await tx
        .select({ id: carriers.id })
        .from(carriers)
        .where(eq(carriers.id, id));
      if (existing) return false;
      await checkName(tx, id, name);
      await tx.insert(carriers).values({ id, name, nameNormalized: normalizeText(name) });
      return { name };
    });
    return c.json(await loadCarrier(c.get("db"), id), created ? 201 : 200);
  })
  .patch("/:id", validate("param", idParam), validate("json", carrierUpdateInput), async (c) => {
    const { id } = c.req.valid("param");
    const { actionId, ...input } = c.req.valid("json");
    await auditedChange(c, { type: "carrier", id, actionId }, async (tx) => {
      const current = await loadCarrier(tx, id);
      if (input.name) await checkName(tx, id, input.name);
      const changes = diffValues(current, input);
      if (Object.keys(changes).length === 0) return null;
      await tx
        .update(carriers)
        .set({
          ...input,
          ...(input.name && { nameNormalized: normalizeText(input.name) }),
          updatedAt: c.get("clock")(),
        })
        .where(eq(carriers.id, id));
      return changes;
    });
    return c.json(await loadCarrier(c.get("db"), id));
  });
