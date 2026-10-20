import {
  bogotaToday,
  courierRecordKindLabels,
  exceptionReasonLabels,
  formatTrackingNumber,
  handoverStatusLabels,
  neighborhoodKindLabels,
  notAppliedReasonLabels,
  rateEntryKindLabels,
  routeStatusLabels,
  stopKindLabels,
  taskStatusLabels,
} from "@domy/domain";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  courierAliases,
  courierRecords,
  couriers,
  handovers,
  merchantAliases,
  merchants,
  municipalities,
  neighborhoods,
  neighborhoodVariants,
  pickupPoints,
  rateCardEntries,
  rateZones,
  routes,
  routeStops,
  routeTasks,
  shipments,
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

/** Each master and operational data set as a table with Spanish headers (FR-025, 003 FR-042, Constitution IX). */
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
  async "courier-records"(db) {
    const authors = alias(users, "authors");
    const reverters = alias(users, "reverters");
    const outcomeLabels: Record<string, string> = {
      applied: "Aplicado",
      duplicate: "Duplicado",
      not_applied: "No aplicado",
    };
    const rows = await db
      .select({
        record: courierRecords,
        shipment: shipments,
        courier: couriers,
        author: authors,
        reverter: reverters,
      })
      .from(courierRecords)
      .innerJoin(shipments, eq(shipments.id, courierRecords.shipmentId))
      .innerJoin(couriers, eq(couriers.id, courierRecords.courierId))
      .innerJoin(authors, eq(authors.id, courierRecords.authorUserId))
      .leftJoin(reverters, eq(reverters.id, courierRecords.revertedBy))
      .orderBy(desc(courierRecords.occurredAt), desc(courierRecords.recordedAt));
    return [
      [
        "ID",
        "Guía",
        "Tipo",
        "Resultado",
        "Motivo no aplicado",
        "Mensajero",
        "Registrado por",
        "En representación",
        "Fecha ocurrencia",
        "Fecha registro",
        "Recibido por",
        "Efectivo",
        "Transferencia a la empresa",
        "Transferencia al cliente",
        "Motivo novedad",
        "Nota",
        "Valor pago por cuenta",
        "Beneficiario",
        "Anulado el",
        "Anulado por",
        "Motivo anulación",
      ],
      ...rows.map(({ record: r, shipment: s, courier: c, author: a, reverter: rev }) => [
        r.id,
        formatTrackingNumber(s.trackingNumber),
        courierRecordKindLabels[r.kind],
        outcomeLabels[r.outcome] ?? r.outcome,
        r.notAppliedReason ? notAppliedReasonLabels[r.notAppliedReason] : null,
        c.name,
        a.name,
        yesNo(r.onBehalf),
        instant(r.occurredAt),
        instant(r.recordedAt),
        r.receivedByName,
        r.cashAmount,
        r.companyTransferAmount,
        r.merchantTransferAmount,
        r.exceptionReason ? exceptionReasonLabels[r.exceptionReason] : null,
        r.note,
        r.disbursementAmount,
        r.payee,
        instant(r.revertedAt),
        rev?.name ?? null,
        r.revertReason,
      ]),
    ];
  },
  async routes(db) {
    const routeCouriers = alias(couriers, "route_couriers");
    const taskCouriers = alias(couriers, "task_couriers");
    const rows = await db
      .select({
        route: routes,
        stop: routeStops,
        task: routeTasks,
        shipment: shipments,
        routeCourier: routeCouriers.name,
        taskCourier: taskCouriers.name,
        neighborhood: neighborhoods.name,
      })
      .from(routeTasks)
      .innerJoin(routeStops, eq(routeStops.id, routeTasks.stopId))
      .innerJoin(routes, eq(routes.id, routeStops.routeId))
      .innerJoin(shipments, eq(shipments.id, routeTasks.shipmentId))
      .leftJoin(routeCouriers, eq(routeCouriers.id, routes.courierId))
      .leftJoin(taskCouriers, eq(taskCouriers.id, routeTasks.completedByCourierId))
      .leftJoin(neighborhoods, eq(neighborhoods.id, routeStops.neighborhoodId))
      .orderBy(
        desc(routes.serviceDate),
        asc(routes.number),
        asc(routeStops.position),
        asc(routeTasks.id),
      );
    return [
      [
        "Fecha",
        "Ruta",
        "Estado ruta",
        "Mensajero",
        "Parada",
        "Tipo de parada",
        "Dirección",
        "Barrio",
        "Guía",
        "Tipo tarea",
        "Estado tarea",
        "Problema de recogida",
        "Completada el",
        "Completada por",
        "Despachada el",
        "Finalizada el",
      ],
      ...rows.map(
        ({ route: r, stop, task, shipment: s, routeCourier, taskCourier, neighborhood }) => [
          day(r.serviceDate),
          r.number,
          routeStatusLabels[r.status],
          routeCourier,
          stop.position,
          stopKindLabels[stop.kind],
          stop.address,
          neighborhood,
          formatTrackingNumber(s.trackingNumber),
          stopKindLabels[task.kind],
          taskStatusLabels[task.status],
          task.problemNote,
          instant(task.completedAt),
          taskCourier,
          instant(r.dispatchedAt),
          instant(r.finishedAt),
        ],
      ),
    ];
  },
  async handovers(db) {
    const fromCouriers = alias(couriers, "from_couriers");
    const toCouriers = alias(couriers, "to_couriers");
    const fromRoutes = alias(routes, "from_routes");
    const toRoutes = alias(routes, "to_routes");
    const requesters = alias(users, "requesters");
    const resolvers = alias(users, "resolvers");
    const rows = await db
      .select({
        handover: handovers,
        shipment: shipments,
        fromCourier: fromCouriers.name,
        toCourier: toCouriers.name,
        fromRoute: fromRoutes.number,
        toRoute: toRoutes.number,
        requester: requesters.name,
        resolver: resolvers.name,
      })
      .from(handovers)
      .innerJoin(shipments, eq(shipments.id, handovers.shipmentId))
      .innerJoin(fromCouriers, eq(fromCouriers.id, handovers.fromCourierId))
      .innerJoin(toCouriers, eq(toCouriers.id, handovers.toCourierId))
      .leftJoin(fromRoutes, eq(fromRoutes.id, handovers.fromRouteId))
      .innerJoin(toRoutes, eq(toRoutes.id, handovers.toRouteId))
      .innerJoin(requesters, eq(requesters.id, handovers.requestedBy))
      .leftJoin(resolvers, eq(resolvers.id, handovers.resolvedBy))
      .orderBy(desc(handovers.requestedAt));
    return [
      [
        "ID",
        "Guía",
        "Mensajero origen",
        "Mensajero destino",
        "Ruta origen",
        "Ruta destino",
        "Estado",
        "Motivo",
        "Solicitado por",
        "Solicitado el",
        "Resuelto por",
        "Resuelto el",
        "En representación",
      ],
      ...rows.map(
        ({
          handover: h,
          shipment: s,
          fromCourier,
          toCourier,
          fromRoute,
          toRoute,
          requester,
          resolver,
        }) => [
          h.id,
          formatTrackingNumber(s.trackingNumber),
          fromCourier,
          toCourier,
          fromRoute ?? null,
          toRoute,
          handoverStatusLabels[h.status],
          h.reason,
          requester,
          instant(h.requestedAt),
          resolver ?? null,
          instant(h.resolvedAt),
          yesNo(h.resolvedOnBehalf),
        ],
      ),
    ];
  },
};

const params = z.object({
  dataset: z.enum([
    "merchants",
    "couriers",
    "carriers",
    "neighborhoods",
    "rate-card",
    "courier-records",
    "routes",
    "handovers",
  ]),
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
