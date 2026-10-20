import {
  merchantCreateInput,
  merchantUpdateInput,
  normalizeText,
  pickupPointCreateInput,
  pickupPointUpdateInput,
  type Merchant,
  type MerchantDetail,
  type PickupPoint,
} from "@domy/domain";
import { and, asc, count, desc, eq, ilike, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import {
  merchantAliases,
  merchants,
  neighborhoods,
  pickupPoints,
  shipments,
} from "../db/schema/index.ts";
import type { Executor } from "../db/client.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  auditedChange,
  auditedCreate,
  checkNames,
  diffValues,
  lockEntity,
  replaceAliases,
} from "../lib/master-data.ts";
import { validate } from "../lib/validate.ts";

const listQuery = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const idParam = z.object({ id: z.uuid() });

async function loadMerchant(db: Executor, id: string): Promise<Merchant> {
  const [merchant] = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      whatsappPhone: merchants.whatsappPhone,
      isActive: merchants.isActive,
    })
    .from(merchants)
    .where(eq(merchants.id, id));
  if (!merchant) throw new AppError("not_found", { message: "No encontramos ese cliente." });
  const aliases = await db
    .select({ alias: merchantAliases.alias })
    .from(merchantAliases)
    .where(eq(merchantAliases.merchantId, id))
    .orderBy(merchantAliases.alias);
  return { ...merchant, aliases: aliases.map((row) => row.alias) };
}

const pointSelection = {
  id: pickupPoints.id,
  label: pickupPoints.label,
  address: pickupPoints.address,
  instructions: pickupPoints.instructions,
  isDefault: pickupPoints.isDefault,
  isActive: pickupPoints.isActive,
  neighborhood: { id: neighborhoods.id, name: neighborhoods.name },
};

async function loadPickupPoints(db: Executor, merchantId: string, onlyActive: boolean) {
  return db
    .select(pointSelection)
    .from(pickupPoints)
    .innerJoin(neighborhoods, eq(neighborhoods.id, pickupPoints.neighborhoodId))
    .where(
      and(
        eq(pickupPoints.merchantId, merchantId),
        onlyActive ? eq(pickupPoints.isActive, true) : undefined,
      ),
    )
    .orderBy(desc(pickupPoints.isActive), desc(pickupPoints.isDefault), pickupPoints.label);
}

async function loadPickupPoint(db: Executor, id: string): Promise<PickupPoint> {
  const [point] = await db
    .select(pointSelection)
    .from(pickupPoints)
    .innerJoin(neighborhoods, eq(neighborhoods.id, pickupPoints.neighborhoodId))
    .where(eq(pickupPoints.id, id));
  if (!point) throw new AppError("not_found", { message: "No encontramos ese punto de recogida." });
  return point;
}

/** Shipments not yet delivered, returned, or voided (FR-029 deactivation warning). */
async function openShipments(db: Executor, merchantId: string): Promise<number> {
  const [row] = await db
    .select({ open: count() })
    .from(shipments)
    .where(
      and(
        eq(shipments.merchantId, merchantId),
        notInArray(shipments.status, ["delivered", "returned", "voided"]),
      ),
    );
  return row?.open ?? 0;
}

/**
 * A merchant with active pickup points has exactly one default (FR-029): `chosen` becomes
 * it, or else the oldest active point when none is.
 */
async function settleDefault(tx: Executor, merchantId: string, chosen?: string) {
  await lockEntity(tx, "merchant", merchantId);
  if (chosen) {
    await tx
      .update(pickupPoints)
      .set({ isDefault: false })
      .where(and(eq(pickupPoints.merchantId, merchantId), ne(pickupPoints.id, chosen)));
    await tx.update(pickupPoints).set({ isDefault: true }).where(eq(pickupPoints.id, chosen));
    return;
  }
  const [current] = await tx
    .select({ id: pickupPoints.id })
    .from(pickupPoints)
    .where(
      and(
        eq(pickupPoints.merchantId, merchantId),
        eq(pickupPoints.isActive, true),
        eq(pickupPoints.isDefault, true),
      ),
    );
  if (current) return;
  const [oldest] = await tx
    .select({ id: pickupPoints.id })
    .from(pickupPoints)
    .where(and(eq(pickupPoints.merchantId, merchantId), eq(pickupPoints.isActive, true)))
    .orderBy(asc(pickupPoints.createdAt), asc(pickupPoints.id))
    .limit(1);
  if (oldest) await settleDefault(tx, merchantId, oldest.id);
}

export const merchantRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  // Merchants by any registered name or alias (FR-003).
  .get("/", validate("query", listQuery), async (c) => {
    const { q, active } = c.req.valid("query");
    const db = c.get("db");
    const term = q ? `%${normalizeText(q)}%` : null;
    const rows = await db
      .select({
        id: merchants.id,
        name: merchants.name,
        whatsappPhone: merchants.whatsappPhone,
        isActive: merchants.isActive,
      })
      .from(merchants)
      .where(
        and(
          active ? eq(merchants.isActive, active === "true") : undefined,
          term
            ? or(
                ilike(merchants.nameNormalized, term),
                inArray(
                  merchants.id,
                  db
                    .select({ id: merchantAliases.merchantId })
                    .from(merchantAliases)
                    .where(ilike(merchantAliases.aliasNormalized, term)),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(merchants.nameNormalized)
      .limit(50);
    const aliases =
      rows.length > 0
        ? await db
            .select({ merchantId: merchantAliases.merchantId, alias: merchantAliases.alias })
            .from(merchantAliases)
            .where(
              inArray(
                merchantAliases.merchantId,
                rows.map((row) => row.id),
              ),
            )
        : [];
    return c.json({
      items: rows.map((row) => ({
        ...row,
        aliases: aliases.filter((alias) => alias.merchantId === row.id).map((alias) => alias.alias),
      })),
    });
  })
  .post("/", validate("json", merchantCreateInput), async (c) => {
    const { id, aliases, ...input } = c.req.valid("json");
    const created = await auditedCreate(c, { type: "merchant", id }, async (tx) => {
      const [existing] = await tx
        .select({ id: merchants.id })
        .from(merchants)
        .where(eq(merchants.id, id));
      if (existing) return false;
      await checkNames(tx, "merchant", id, { name: input.name, aliases });
      const values = { ...input, whatsappPhone: input.whatsappPhone ?? null };
      const inserted = await tx
        .insert(merchants)
        .values({ id, ...values, nameNormalized: normalizeText(input.name) })
        .onConflictDoNothing({ target: merchants.id })
        .returning({ id: merchants.id });
      if (inserted.length === 0) return false;
      await replaceAliases(tx, "merchant", id, aliases);
      return { ...values, aliases };
    });
    return c.json(await loadMerchant(c.get("db"), id), created ? 201 : 200);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    return c.json({
      ...(await loadMerchant(db, id)),
      pickupPoints: await loadPickupPoints(db, id, false),
      openShipments: await openShipments(db, id),
    } satisfies MerchantDetail);
  })
  // Edit or deactivate; deactivation answers with the open shipments, which keep working.
  .patch("/:id", validate("param", idParam), validate("json", merchantUpdateInput), async (c) => {
    const { id } = c.req.valid("param");
    const { actionId, ...input } = c.req.valid("json");
    const db = c.get("db");
    await auditedChange(c, { type: "merchant", id, actionId }, async (tx) => {
      const current = await loadMerchant(tx, id);
      await checkNames(tx, "merchant", id, { name: input.name, aliases: input.aliases });
      const changes = diffValues(current, input);
      if (Object.keys(changes).length === 0) return null;
      const { aliases, ...fields } = input;
      await tx
        .update(merchants)
        .set({
          ...fields,
          ...(fields.name && { nameNormalized: normalizeText(fields.name) }),
          updatedAt: c.get("clock")(),
        })
        .where(eq(merchants.id, id));
      if (aliases) await replaceAliases(tx, "merchant", id, aliases);
      return changes;
    });
    return c.json({ ...(await loadMerchant(db, id)), openShipments: await openShipments(db, id) });
  })
  .get("/:id/pickup-points", validate("param", idParam), async (c) => {
    return c.json({ items: await loadPickupPoints(c.get("db"), c.req.valid("param").id, true) });
  })
  .post(
    "/:id/pickup-points",
    validate("param", idParam),
    validate("json", pickupPointCreateInput),
    async (c) => {
      const { id: merchantId } = c.req.valid("param");
      const { id, isDefault, ...input } = c.req.valid("json");
      const created = await auditedCreate(c, { type: "pickup_point", id }, async (tx) => {
        const [existing] = await tx
          .select({ id: pickupPoints.id })
          .from(pickupPoints)
          .where(eq(pickupPoints.id, id));
        if (existing) return false;
        await loadMerchant(tx, merchantId);
        const values = { merchantId, ...input, instructions: input.instructions ?? null };
        const inserted = await tx
          .insert(pickupPoints)
          .values({ id, ...values })
          .onConflictDoNothing({ target: pickupPoints.id })
          .returning({ id: pickupPoints.id });
        if (inserted.length === 0) return false;
        await settleDefault(tx, merchantId, isDefault ? id : undefined);
        return values;
      });
      return c.json(await loadPickupPoint(c.get("db"), id), created ? 201 : 200);
    },
  )
  // Recipients of the merchant's own past shipments, identified by phone (FR-004).
  .get(
    "/:id/recipients",
    validate("param", idParam),
    validate("query", z.object({ q: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { q } = c.req.valid("query");
      const digits = q?.replace(/\D/g, "") ?? "";
      const text = q ? normalizeText(q) : "";
      const rows = await c
        .get("db")
        .selectDistinctOn([shipments.recipientPhone], {
          recipientName: shipments.recipientName,
          recipientPhone: shipments.recipientPhone,
          recipientAddress: shipments.recipientAddress,
          recipientNeighborhood: { id: neighborhoods.id, name: neighborhoods.name },
        })
        .from(shipments)
        .innerJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
        .where(
          and(
            eq(shipments.merchantId, id),
            sql`${shipments.recipientPhone} is not null`,
            q
              ? or(
                  text ? ilike(shipments.recipientNameNormalized, `%${text}%`) : undefined,
                  digits ? ilike(shipments.recipientPhone, `${digits}%`) : undefined,
                )
              : undefined,
          ),
        )
        .orderBy(shipments.recipientPhone, desc(shipments.registeredAt))
        .limit(10);
      return c.json({ items: rows });
    },
  );

/** Pickup point changes (FR-026, FR-029): edit, choose as default, deactivate. */
export const pickupPointRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .patch(
    "/:id",
    validate("param", idParam),
    validate("json", pickupPointUpdateInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const { actionId, isDefault, ...input } = c.req.valid("json");
      await auditedChange(c, { type: "pickup_point", id, actionId }, async (tx) => {
        const [current] = await tx.select().from(pickupPoints).where(eq(pickupPoints.id, id));
        if (!current)
          throw new AppError("not_found", { message: "No encontramos ese punto de recogida." });
        if (isDefault && !(input.isActive ?? current.isActive)) {
          throw new AppError("invalid_request", {
            fields: { isDefault: "Un punto inactivo no puede ser el predeterminado." },
          });
        }
        const changes = diffValues(current, { ...input, ...(isDefault && { isDefault }) });
        if (Object.keys(changes).length === 0) return null;
        await tx
          .update(pickupPoints)
          .set({
            ...input,
            ...(input.isActive === false && { isDefault: false }),
            updatedAt: c.get("clock")(),
          })
          .where(eq(pickupPoints.id, id));
        await settleDefault(tx, current.merchantId, isDefault ? id : undefined);
        return changes;
      });
      return c.json(await loadPickupPoint(c.get("db"), id));
    },
  );
