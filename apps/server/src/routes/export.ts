import { bogotaToday, neighborhoodKindLabels, rateEntryKindLabels } from "@domy/domain";
import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  courierAliases,
  couriers,
  merchantAliases,
  merchants,
  municipalities,
  neighborhoods,
  neighborhoodVariants,
  pickupPoints,
  rateCardEntries,
  rateZones,
  users,
} from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { day, instant, toCsv } from "../lib/export.ts";
import { validate } from "../lib/validate.ts";

type Cell = string | number | null;
const yesNo = (value: boolean) => (value ? "Sí" : "No");

/** Values of a one-to-many relation joined in one cell. */
function grouped<T>(rows: T[], key: (row: T) => string, value: (row: T) => string) {
  const groups = new Map<string, string[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), value(row)]);
  return (id: string) => (groups.get(id) ?? []).join("; ");
}

/** Each master data set as a table with Spanish headers (FR-025, Constitution IX). */
const datasets: Record<string, (db: Executor) => Promise<Cell[][]>> = {
  async merchants(db) {
    const rows = await db
      .select({ merchant: merchants, point: pickupPoints, neighborhood: neighborhoods.name })
      .from(merchants)
      .leftJoin(pickupPoints, eq(pickupPoints.merchantId, merchants.id))
      .leftJoin(neighborhoods, eq(neighborhoods.id, pickupPoints.neighborhoodId))
      .orderBy(asc(merchants.name), desc(pickupPoints.isDefault), asc(pickupPoints.label));
    const aliases = grouped(
      await db.select().from(merchantAliases).orderBy(merchantAliases.alias),
      (row) => row.merchantId,
      (row) => row.alias,
    );
    return [
      [
        "Cliente",
        "Alias",
        "WhatsApp",
        "Activo",
        "Punto de recogida",
        "Dirección",
        "Barrio",
        "Predeterminado",
        "Punto activo",
      ],
      ...rows.map(({ merchant, point, neighborhood }) => [
        merchant.name,
        aliases(merchant.id),
        merchant.whatsappPhone,
        yesNo(merchant.isActive),
        point?.label ?? null,
        point?.address ?? null,
        neighborhood,
        point ? yesNo(point.isDefault) : null,
        point ? yesNo(point.isActive) : null,
      ]),
    ];
  },
  async couriers(db) {
    const rows = await db.select().from(couriers).orderBy(couriers.name);
    const aliases = grouped(
      await db.select().from(courierAliases).orderBy(courierAliases.alias),
      (row) => row.courierId,
      (row) => row.alias,
    );
    return [
      ["Mensajero", "Alias", "Teléfono", "Activo"],
      ...rows.map((row) => [row.name, aliases(row.id), row.phone, yesNo(row.isActive)]),
    ];
  },
  async carriers(db) {
    const rows = await db.select().from(carriers).orderBy(carriers.name);
    return [["Transportadora", "Activa"], ...rows.map((row) => [row.name, yesNo(row.isActive)])];
  },
  async neighborhoods(db) {
    const rows = await db
      .select({ place: neighborhoods, municipality: municipalities.name, zone: rateZones.name })
      .from(neighborhoods)
      .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
      .innerJoin(rateZones, eq(rateZones.id, neighborhoods.rateZoneId))
      .orderBy(municipalities.name, neighborhoods.name);
    const variants = grouped(
      await db.select().from(neighborhoodVariants).orderBy(neighborhoodVariants.variantNormalized),
      (row) => row.neighborhoodId,
      (row) => row.variantNormalized,
    );
    return [
      ["Barrio", "Tipo", "Municipio", "Zona", "Variantes", "Por revisar", "Activo"],
      ...rows.map(({ place, municipality, zone }) => [
        place.name,
        neighborhoodKindLabels[place.kind],
        municipality,
        zone,
        variants(place.id),
        yesNo(place.needsReview),
        yesNo(place.isActive),
      ]),
    ];
  },
  async "rate-card"(db) {
    const rows = await db
      .select({
        entry: rateCardEntries,
        merchant: merchants.name,
        zone: rateZones.name,
        author: users.name,
      })
      .from(rateCardEntries)
      .leftJoin(merchants, eq(merchants.id, rateCardEntries.merchantId))
      .leftJoin(rateZones, eq(rateZones.id, rateCardEntries.rateZoneId))
      .innerJoin(users, eq(users.id, rateCardEntries.createdBy))
      .orderBy(desc(rateCardEntries.effectiveFrom), desc(rateCardEntries.createdAt));
    return [
      ["Tipo", "Cliente", "Zona", "Valor", "Vigente desde", "Registrado por", "Registrado el"],
      ...rows.map(({ entry, merchant, zone, author }) => [
        rateEntryKindLabels[entry.kind],
        merchant,
        zone,
        entry.amount,
        day(bogotaToday(entry.effectiveFrom)),
        author,
        instant(entry.createdAt),
      ]),
    ];
  },
};

const params = z.object({
  dataset: z.enum(["merchants", "couriers", "carriers", "neighborhoods", "rate-card"]),
});

export const exportRoutes = new Hono<AppEnv>()
  .use(requireRole("owner"))
  .get(
    "/:dataset",
    validate("param", params),
    validate("query", z.object({ format: z.literal("csv") })),
    async (c) => {
      const { dataset } = c.req.valid("param");
      const table = await datasets[dataset]?.(c.get("db"));
      const name = `${dataset}-${bogotaToday(c.get("clock")())}.csv`;
      c.header("Content-Disposition", `attachment; filename="${name}"`);
      c.header("Content-Type", "text/csv; charset=utf-8");
      return c.body(toCsv(table ?? []));
    },
  );
