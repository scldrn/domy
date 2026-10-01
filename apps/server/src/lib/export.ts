import {
  bogotaLocalTime,
  bogotaToday,
  formatTrackingNumber,
  packageSizeLabels,
  paymentModeLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  shipmentStatusLabels,
} from "@domy/domain";
import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import writeXlsxFile from "write-excel-file/node";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  merchants,
  municipalities,
  neighborhoods,
  rateZones,
  shipments,
  users,
} from "../db/schema/index.ts";

/** Export columns in order (contracts/bulk-template.md §Export columns, FR-025). */
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
] as const;

type Cell = string | number | null;

export async function findExportRecords(
  db: Executor,
  where: SQL | undefined,
  order: (SQL | PgColumn)[],
) {
  return db
    .select({
      shipment: shipments,
      merchant: merchants.name,
      neighborhood: neighborhoods.name,
      municipality: municipalities.name,
      rateZone: rateZones.name,
      carrier: carriers.name,
      registeredBy: users.name,
    })
    .from(shipments)
    .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
    .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
    .leftJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
    .leftJoin(rateZones, eq(rateZones.id, shipments.rateZoneId))
    .leftJoin(carriers, eq(carriers.id, shipments.carrierId))
    .innerJoin(users, eq(users.id, shipments.registeredBy))
    .where(where)
    .orderBy(...order);
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
    ...records.map(({ shipment: s, ...names }) => [
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
    ]),
  ];
}

/** CSV that Excel opens in UTF-8 (byte order mark) with quoted fields where needed. */
export function toCsv(table: Cell[][]): string {
  const field = (value: Cell) => {
    const text = value === null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
