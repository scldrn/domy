import type { WindowPreset } from "./delivery-windows.ts";
import { parseCop } from "./money.ts";
import {
  packageSizeLabels,
  paymentModeLabels,
  serviceLevelLabels,
  shipmentKindLabels,
  type PackageSize,
  type PaymentMode,
  type ServiceLevel,
  type ShipmentKind,
} from "./schemas/enums.ts";
import { normalizeText } from "./text-normalization.ts";

/** The published bulk template (contracts/bulk-template.md), in column order. */
export const bulkColumns = [
  "Tipo",
  "Fecha",
  "Destinatario",
  "Teléfono",
  "Dirección",
  "Barrio",
  "Transportadora",
  "Municipio destino",
  "Diligencia",
  "Modalidad",
  "Valor a recaudar",
  "Franja",
  "Nivel",
  "Tamaño",
  "Unidades",
  "Referencia",
  "Indicaciones",
  "Tarifa",
  "Motivo tarifa",
] as const;

export const maxBulkRows = 200;

/** A template row read into shipment fields; places and carriers are still names. */
export type BulkRow = {
  kind: ShipmentKind;
  serviceDate?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  neighborhood?: string;
  carrier?: string;
  destinationTown?: string;
  errandDescription?: string;
  paymentMode: PaymentMode;
  codAmount?: number;
  window?: WindowPreset;
  serviceLevel: ServiceLevel;
  packageSize?: PackageSize;
  packageCount?: number;
  merchantReference?: string;
  instructions?: string;
  fee?: number;
  feeOverrideReason?: string;
};

/** The template column that holds each field, to point errors at the right cell. */
export const bulkColumnOf: Record<string, (typeof bulkColumns)[number]> = {
  kind: "Tipo",
  serviceDate: "Fecha",
  recipientName: "Destinatario",
  recipientPhone: "Teléfono",
  recipientAddress: "Dirección",
  recipientNeighborhoodId: "Barrio",
  neighborhood: "Barrio",
  carrierId: "Transportadora",
  carrier: "Transportadora",
  destinationTown: "Municipio destino",
  errandDescription: "Diligencia",
  paymentMode: "Modalidad",
  codAmount: "Valor a recaudar",
  window: "Franja",
  serviceLevel: "Nivel",
  packageSize: "Tamaño",
  packageCount: "Unidades",
  merchantReference: "Referencia",
  instructions: "Indicaciones",
  fee: "Tarifa",
  feeOverrideReason: "Motivo tarifa",
};

const normalizedColumns = bulkColumns.map(normalizeText);

/**
 * Checks a pasted or uploaded table before the preview (FR-019): drops blank rows, skips the
 * header when the first row has it, and rejects unknown columns and lists over 200 rows.
 */
export function readBulkTable(table: string[][]): { rows: string[][] } | { error: string } {
  let rows = table
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
  const [first] = rows;
  if (first?.some((cell) => normalizedColumns.includes(normalizeText(cell)))) {
    for (const [index, cell] of first.entries()) {
      if (cell !== "" && normalizeText(cell) !== normalizedColumns[index]) {
        return {
          error: `La columna «${cell}» no es de la plantilla o está en otro orden. Usa las columnas de la plantilla: ${bulkColumns.join(", ")}.`,
        };
      }
    }
    rows = rows.slice(1);
  }
  const wide = rows.findIndex((row) => row.slice(bulkColumns.length).some((cell) => cell !== ""));
  if (wide >= 0) {
    return {
      error: `La fila ${String(wide + 1)} tiene más de ${String(bulkColumns.length)} columnas; la plantilla no tiene columnas adicionales.`,
    };
  }
  if (rows.length > maxBulkRows) {
    return {
      error: `La lista tiene ${String(rows.length)} filas; el máximo es ${String(maxBulkRows)}. Divídela en varias listas.`,
    };
  }
  if (rows.length === 0) return { error: "La lista no tiene filas." };
  return { rows };
}

function fromLabels<T extends string>(labels: Record<T, string>): Map<string, T> {
  return new Map(
    (Object.entries(labels) as [T, string][]).map(([value, label]) => [
      normalizeText(label),
      value,
    ]),
  );
}
const kinds = fromLabels(shipmentKindLabels);
const paymentModes = fromLabels(paymentModeLabels);
const serviceLevels = fromLabels(serviceLevelLabels);
const packageSizes = fromLabels(packageSizeLabels);

/**
 * A time as people write it: "5pm", "5 p. m.", "17:00", "2:30pm". Without "am" or "pm",
 * hours before 8 are afternoon hours, since service runs from 8:00 to 20:00.
 */
function parseTime(text: string, meridiem?: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const suffix = match[3] ?? meridiem;
  if (hour > 23 || Number(minute) > 59) return null;
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (!suffix && hour < 8) hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/** "antes de las 5pm", "después de las 2pm", "de 1 a 5pm", "en la mañana", "en la tarde". */
export function parseWindowPhrase(phrase: string): WindowPreset | null {
  // Lowercase without accents, keeping ":" in times; "5 p. m." becomes "5pm".
  const text = phrase
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(\d)\s*([ap])\.?\s*m\.?/g, "$1$2m")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(en la )?manana$/.test(text)) return { preset: "morning" };
  if (/^(en la )?tarde$/.test(text)) return { preset: "afternoon" };
  const before = /^antes de (?:las |la )?(.+)$/.exec(text);
  if (before?.[1]) {
    const end = parseTime(before[1]);
    return end ? { preset: "before", end } : null;
  }
  const after = /^despues de (?:las |la )?(.+)$/.exec(text);
  if (after?.[1]) {
    const start = parseTime(after[1]);
    return start ? { preset: "after", start } : null;
  }
  const between = /^(?:de |entre )?(?:las |la )?(.+?) (?:a|y) (?:las |la )?(.+)$/.exec(text);
  if (between?.[1] && between[2]) {
    const meridiem = /(am|pm)$/.exec(between[2])?.[1];
    const start = parseTime(between[1], meridiem);
    const end = parseTime(between[2]);
    return start && end ? { preset: "between", start, end } : null;
  }
  return null;
}

/** "DD/MM/AAAA" (also D/M/AAAA or with hyphens) as an ISO calendar date. */
function parseDate(text: string): string | null {
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (!match) return null;
  const [, day = "", month = "", year = ""] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

/** Reads one template row; each unreadable cell becomes an error on its field. */
export function parseBulkRow(cells: string[]): { row: BulkRow; errors: Record<string, string> } {
  const cell = (column: (typeof bulkColumns)[number]) =>
    (cells[bulkColumns.indexOf(column)] ?? "").trim();
  const errors: Record<string, string> = {};
  const choice = <T>(column: (typeof bulkColumns)[number], field: string, map: Map<string, T>) => {
    const text = cell(column);
    if (!text) return undefined;
    const value = map.get(normalizeText(text));
    if (value === undefined) {
      const options = [...map.keys()].join(", ");
      errors[field] = `«${text}» no es un valor de ${column}. Usa: ${options}.`;
    }
    return value;
  };
  const text = (column: (typeof bulkColumns)[number]) => cell(column) || undefined;
  const amount = (column: (typeof bulkColumns)[number], field: string) => {
    const value = cell(column);
    if (!value) return undefined;
    const parsed = parseCop(value);
    if (parsed === null) errors[field] = `«${value}» no es un valor en pesos enteros.`;
    return parsed ?? undefined;
  };

  const kind = choice("Tipo", "kind", kinds) ?? "delivery";
  const paymentMode = choice("Modalidad", "paymentMode", paymentModes) ?? "merchant_account";
  const serviceLevel = choice("Nivel", "serviceLevel", serviceLevels) ?? "standard";
  const packageSize = choice("Tamaño", "packageSize", packageSizes);

  let serviceDate: string | undefined;
  if (cell("Fecha")) {
    serviceDate = parseDate(cell("Fecha")) ?? undefined;
    if (!serviceDate) errors["serviceDate"] = "Escribe la fecha como DD/MM/AAAA.";
  }
  let window: WindowPreset | undefined;
  if (cell("Franja")) {
    window = parseWindowPhrase(cell("Franja")) ?? undefined;
    if (!window) {
      errors["window"] =
        "Escribe la franja como «antes de las 5pm», «después de las 2pm», «de 1 a 5pm», «en la mañana» o «en la tarde».";
    }
  }
  let packageCount: number | undefined;
  if (cell("Unidades")) {
    packageCount = Number(cell("Unidades"));
    if (!Number.isInteger(packageCount) || packageCount < 1) {
      errors["packageCount"] = "Las unidades son un número entero mayor que cero.";
      packageCount = undefined;
    }
  }
  const phone = cell("Teléfono").replace(/[\s-]/g, "");
  const optional = {
    serviceDate,
    recipientName: text("Destinatario"),
    recipientPhone: phone || undefined,
    recipientAddress: text("Dirección"),
    neighborhood: text("Barrio"),
    carrier: text("Transportadora"),
    destinationTown: text("Municipio destino"),
    errandDescription: text("Diligencia"),
    codAmount: amount("Valor a recaudar", "codAmount"),
    window,
    packageSize,
    packageCount,
    merchantReference: text("Referencia"),
    instructions: text("Indicaciones"),
    fee: amount("Tarifa", "fee"),
    feeOverrideReason: text("Motivo tarifa"),
  };
  const row = {
    kind,
    paymentMode,
    serviceLevel,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  } as BulkRow;
  return { row, errors };
}
