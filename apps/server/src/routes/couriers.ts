import {
  courierAccountInput,
  courierCreateInput,
  courierUpdateInput,
  normalizeText,
  type Courier,
} from "@domy/domain";
import { and, count, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { courierAliases, couriers, routes, users } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  auditedChange,
  auditedCreate,
  checkNames,
  diffValues,
  replaceAliases,
  type AuditChange,
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
      account: { id: users.id, email: users.email },
    })
    .from(couriers)
    .leftJoin(users, eq(users.id, couriers.userId))
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
    account: row.account?.id && row.account.email ? row.account : null,
    aliases: aliases.filter((alias) => alias.courierId === row.id).map((alias) => alias.alias),
  }));
}

async function loadCourier(db: Executor, id: string): Promise<Courier> {
  const [courier] = await loadCouriers(db, eq(couriers.id, id));
  if (!courier) throw new AppError("not_found", { message: "No encontramos ese mensajero." });
  return courier;
}

const userParam = z.object({ userId: z.uuid() });

/**
 * Links an account with the courier role to the courier it works as, or unlinks it (feature
 * 003, FR-002). An account belongs to one courier and a courier has one account, so linking
 * moves the account from its previous courier and replaces the courier's previous account, in
 * one transaction with an audit event per courier changed. Records stay with the courier.
 */
async function linkAccount(
  tx: Executor,
  input: { userId: string; courierId: string | null },
  now: Date,
): Promise<AuditChange[]> {
  // R18/T130: role changes lock this user too, before inspecting its courier link.
  const [user] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
  if (!user) throw new AppError("not_found", { message: "No encontramos esa cuenta." });
  // Couriers in a fixed order, as every action locks them, so two links never deadlock.
  const involved = await tx
    .select()
    .from(couriers)
    .where(
      or(
        eq(couriers.userId, input.userId),
        input.courierId ? eq(couriers.id, input.courierId) : undefined,
      ),
    )
    .orderBy(couriers.id)
    .for("update");
  const current = involved.find((row) => row.userId === input.userId) ?? null;
  const target = input.courierId ? involved.find((row) => row.id === input.courierId) : null;
  if (input.courierId && !target) {
    throw new AppError("not_found", { message: "No encontramos ese mensajero." });
  }
  if (target && (user.role !== "courier" || user.banned)) {
    throw new AppError("courier_account_invalid");
  }
  if (target && !target.isActive) {
    throw new AppError("courier_account_invalid", {
      message: "Ese mensajero está desactivado; reactívalo antes de vincular una cuenta.",
    });
  }
  if (current?.id === target?.id) return [];

  const events: AuditChange[] = [];
  const change = async (courierId: string, before: string | null, after: string | null) => {
    await tx
      .update(couriers)
      .set({ userId: after, updatedAt: now })
      .where(eq(couriers.id, courierId));
    events.push({
      type: "courier",
      id: courierId,
      changes: { userId: [before, after] },
    });
  };
  // The previous courier lets go first: `couriers.user_id` is unique.
  if (current) await change(current.id, input.userId, null);
  if (target) await change(target.id, target.userId, input.userId);
  return events;
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
      const inserted = await tx
        .insert(couriers)
        .values({ id, ...input })
        .onConflictDoNothing({ target: couriers.id })
        .returning({ id: couriers.id });
      if (inserted.length === 0) return false;
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
  })
  // Which routes an account sees is the owner's decision (feature 003, FR-002).
  .put(
    "/accounts/:userId",
    requireRole("owner"),
    validate("param", userParam),
    validate("json", courierAccountInput),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { actionId, courierId } = c.req.valid("json");
      const db = c.get("db");
      await auditedChange(
        c,
        { type: courierId ? "courier" : "user", id: courierId ?? userId, actionId },
        (tx) => linkAccount(tx, { userId, courierId }, c.get("clock")()),
      );
      const [linked] = await loadCouriers(db, eq(couriers.userId, userId));
      return c.json({ courier: linked ?? null });
    },
  );
