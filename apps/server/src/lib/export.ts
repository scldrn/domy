import {
  bogotaLocalTime,
  bogotaToday,
  exceptionReasonLabels,
  formatTrackingNumber,
  packageSizeLabels,
  paymentModeLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  shipmentStatusLabels,
} from "@domy/domain";
import { and, asc, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import writeXlsxFile from "write-excel-file/node";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  couriers,
  courierRecords,
  merchants,
  municipalities,
  neighborhoods,
  rateZones,
  routes,
  shipmentEvents,
  shipments,
  users,
} from "../db/schema/index.ts";

/** Export columns in order (contracts/bulk-template.md §Export columns, FR-025, 003 FR-042). */
export const exportColumns = [
  "Guía",
  "Fecha",
  "Estado",
  "Tipo",
  "Cliente",
  "Referencia",
  "Destinatario",
  "Teléfono",
  "Dirección",
  "Barrio",
  "Municipio",
  "Zona",
  "Transportadora",
  "Municipio destino",
  "Diligencia",
  "Modalidad",
  "Valor a recaudar",
  "Tarifa calculada",
  "Tarifa",
  "Motivo tarifa",
  "Nivel",
  "Franja desde",
  "Franja hasta",
  "Tamaño",
  "Unidades",
  "Indicaciones",
  "Registrado por",
  "Registrado el",
  "Fecha de estado",
  "Mensajero",
  "Recibido por",
  "Efectivo",
  "Transferencia a la empresa",
  "Transferencia al cliente",
  "Pagos por cuenta del cliente",
  "Intentos",
  "Motivo de la última novedad",
  "Notificado",
] as const;

type Cell = string | number | null;

const routeCouriers = alias(couriers, "route_couriers");

export async function findExportRecords(
  db: Executor,
  where: SQL | undefined,
  order: (SQL | PgColumn)[],
) {
  const rows = await db
    .select({
      shipment: shipments,
      merchant: merchants.name,
      neighborhood: neighborhoods.name,
      municipality: municipalities.name,
      rateZone: rateZones.name,
      carrier: carriers.name,
      registeredBy: users.name,
      custodyCourier: couriers.name,
      routeCourier: routeCouriers.name,
    })
    .from(shipments)
    .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
    .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
    .leftJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
    .leftJoin(rateZones, eq(rateZones.id, shipments.rateZoneId))
    .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
    .innerJoin(users, eq(users.id, shipments.registeredBy))
    .leftJoin(couriers, eq(couriers.id, shipments.custodyCourierId))
    .leftJoin(routes, eq(routes.id, shipments.routeId))
    .leftJoin(routeCouriers, eq(routeCouriers.id, routes.courierId))
    .where(where)
    .orderBy(...order);

  if (rows.length === 0) return [];

  const shipmentIds = rows.map((r) => r.shipment.id);

  const [appliedRecords, events] = await Promise.all([
    db
      .select({
        record: courierRecords,
        courierName: couriers.name,
      })
      .from(courierRecords)
      .innerJoin(couriers, eq(couriers.id, courierRecords.courierId))
      .where(
        and(
          inArray(courierRecords.shipmentId, shipmentIds),
          eq(courierRecords.outcome, "applied"),
          isNull(courierRecords.revertedAt),
        ),
      )
      .orderBy(asc(courierRecords.occurredAt), asc(courierRecords.recordedAt)),
    db
      .select({
        shipmentId: shipmentEvents.shipmentId,
        toStatus: shipmentEvents.toStatus,
        occurredAt: shipmentEvents.occurredAt,
      })
      .from(shipmentEvents)
      .where(inArray(shipmentEvents.shipmentId, shipmentIds))
      .orderBy(desc(shipmentEvents.occurredAt), desc(shipmentEvents.recordedAt)),
  ]);

  return rows.map((row) => {
    const records = appliedRecords.filter((r) => r.record.shipmentId === row.shipment.id);
    const delivery = records.findLast((r) => r.record.kind === "delivery");
    const returnRecord = records.findLast((r) => r.record.kind === "return");
    const lastException = records.findLast((r) => r.record.kind === "exception");
    const disbursements = records.filter((r) => r.record.kind === "disbursement");
    const attempts = records.filter(
      (r) => r.record.kind === "delivery" || r.record.kind === "exception",
    );

    const statusAt =
      delivery && row.shipment.status === "delivered"
        ? delivery.record.occurredAt
        : returnRecord && row.shipment.status === "returned"
          ? returnRecord.record.occurredAt
          : lastException && row.shipment.status === "exception"
            ? lastException.record.occurredAt
            : (events.find(
                (e) => e.shipmentId === row.shipment.id && e.toStatus === row.shipment.status,
              )?.occurredAt ?? row.shipment.registeredAt);

    const courier =
      delivery?.courierName ??
      returnRecord?.courierName ??
      row.custodyCourier ??
      row.routeCourier ??
      lastException?.courierName ??
      null;

    const receivedBy =
      delivery?.record.receivedByName ?? returnRecord?.record.receivedByName ?? null;

    const cash = delivery ? delivery.record.cashAmount : null;
    const companyTransfer = delivery ? delivery.record.companyTransferAmount : null;
    const merchantTransfer = delivery ? delivery.record.merchantTransferAmount : null;
    const disbursementTotal =
      disbursements.length > 0
        ? disbursements.reduce((sum, d) => sum + (d.record.disbursementAmount ?? 0), 0)
        : null;

    const exceptionReason = lastException?.record.exceptionReason
      ? exceptionReasonLabels[lastException.record.exceptionReason]
      : null;

    return {
      ...row,
      deliveryInfo: {
        statusAt,
        courier,
        receivedBy,
        cash,
        companyTransfer,
        merchantTransfer,
        disbursementTotal,
        attemptCount: attempts.length,
        exceptionReason,
      },
    };
  });
}

/** "01/10/2026" from a calendar day. */
export const day = (date: string) => date.split("-").reverse().join("/");
/** "01/10/2026 17:00" in Bogotá from an instant. */
export const instant = (value: Date | null) =>
  value && `${day(bogotaToday(value))} ${bogotaLocalTime(value)}`;

/** One row per shipment; money as whole numbers, dates and times in Bogotá. */
export function exportTable(records: Awaited<ReturnType<typeof findExportRecords>>): Cell[][] {
  return [
    [...exportColumns],
    ...records.map(({ shipment: s, deliveryInfo: d, ...names }) => [
      formatTrackingNumber(s.trackingNumber),
      day(s.serviceDate),
      shipmentStatusLabels[s.status],
      shipmentKindLabels[s.kind],
      names.merchant,
      s.merchantReference,
      s.recipientName,
      s.recipientPhone,
      s.recipientAddress,
      names.neighborhood,
      names.municipality,
      names.rateZone,
      names.carrier,
      s.destinationTown,
      s.errandDescription,
      paymentModeLabels[s.paymentMode],
      s.codAmount,
      s.calculatedFee,
      s.fee,
      s.feeOverrideReason,
      serviceLevelLabels[s.serviceLevel],
      instant(s.windowStart),
      instant(s.windowEnd),
      s.packageSize && packageSizeLabels[s.packageSize],
      s.packageCount,
      s.instructions,
      names.registeredBy,
      instant(s.registeredAt),
      instant(d.statusAt),
      d.courier,
      d.receivedBy,
      d.cash,
      d.companyTransfer,
      d.merchantTransfer,
      d.disbursementTotal,
      d.attemptCount,
      d.exceptionReason,
      instant(s.notifiedAt),
    ]),
  ];
}

/** CSV that Excel opens in UTF-8 (byte order mark) with quoted fields where needed and neutralized formula triggers (IV-01). */
export function toCsv(table: Cell[][]): string {
  const field = (value: Cell) => {
    if (value === null) return "";
    if (typeof value === "number") return String(value);
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return `\uFEFF${table.map((row) => row.map(field).join(",")).join("\r\n")}\r\n`;
}

export async function toXlsx(table: Cell[][]): Promise<Buffer> {
  const [header = [], ...rows] = table;
  return writeXlsxFile(
    [
      header.map((value) => ({ value: String(value), fontWeight: "bold" as const })),
      ...rows.map((row) => row.map((value) => (value === null ? null : { value }))),
    ],
    { stickyRowsCount: 1 },
  ).toBuffer();
}
