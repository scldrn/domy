import { normalizeText } from "@domy/domain";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
import { requireRole } from "../lib/auth-guard.ts";
import { validate } from "../lib/validate.ts";

const listQuery = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

const idParam = z.object({ id: z.uuid() });

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
  .get("/:id/pickup-points", validate("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const rows = await c
      .get("db")
      .select({
        id: pickupPoints.id,
        label: pickupPoints.label,
        address: pickupPoints.address,
        instructions: pickupPoints.instructions,
        isDefault: pickupPoints.isDefault,
        neighborhood: { id: neighborhoods.id, name: neighborhoods.name },
      })
      .from(pickupPoints)
      .innerJoin(neighborhoods, eq(neighborhoods.id, pickupPoints.neighborhoodId))
      .where(and(eq(pickupPoints.merchantId, id), eq(pickupPoints.isActive, true)))
      .orderBy(desc(pickupPoints.isDefault), pickupPoints.label);
    return c.json({ items: rows });
  })
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
