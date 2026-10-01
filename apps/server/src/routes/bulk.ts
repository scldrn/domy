import {
  bogotaToday,
  bulkConfirmInput,
  bulkPreviewInput,
  calculateFee,
  codAmountError,
  normalizeText,
  parseBulkRow,
  readBulkTable,
  shipmentCreateInput,
  type BulkConfirmation,
  type BulkConfirmResult,
  type BulkPreviewRow,
  type ShipmentCreateInput,
  type WindowPreset,
  windowFromPreset,
  windowWarnings,
} from "@domy/domain";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import {
  bulkBatches,
  carriers,
  municipalities,
  neighborhoods,
  pickupPoints,
  shipments,
} from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  codConfirmationThreshold,
  feeConfirmationThreshold,
  insertShipments,
  prepareShipment,
  pricingPlace,
  rateEntriesFor,
  type NewShipment,
} from "../lib/registration.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";
import { searchNeighborhoods } from "./neighborhoods.ts";

/** The merchant's default active pickup point, used for the whole batch (bulk template). */
async function defaultPickupPoint(db: Executor, merchantId: string): Promise<string> {
  const [point] = await db
    .select({ id: pickupPoints.id })
    .from(pickupPoints)
    .where(and(eq(pickupPoints.merchantId, merchantId), eq(pickupPoints.isActive, true)))
    .orderBy(desc(pickupPoints.isDefault), pickupPoints.label)
    .limit(1);
  if (!point) {
    throw new AppError("invalid_request", {
      message:
        "El cliente no tiene puntos de recogida activos; agrega uno antes de cargar la lista.",
    });
  }
  return point.id;
}

/** The dispatcher's chosen neighborhood, or the best catalog match of the typed name. */
async function placeFor(db: Executor, name: string, chosenId: string | undefined) {
  if (!chosenId) {
    const [best] = await searchNeighborhoods(db, { q: name }, 1);
    return best ?? null;
  }
  const [chosen] = await db
    .select({
      id: neighborhoods.id,
      name: neighborhoods.name,
      municipality: { name: municipalities.name },
    })
    .from(neighborhoods)
    .innerJoin(municipalities, eq(municipalities.id, neighborhoods.municipalityId))
    .where(and(eq(neighborhoods.id, chosenId), eq(neighborhoods.isActive, true)));
  return chosen ? { ...chosen, similarity: 1 } : null;
}

async function carrierFor(db: Executor, name: string) {
  const [carrier] = await db
    .select({ id: carriers.id })
    .from(carriers)
    .where(and(eq(carriers.nameNormalized, normalizeText(name)), eq(carriers.isActive, true)));
  return carrier?.id;
}

/** Tracking numbers of the merchant's shipments that day with the same reference or phone. */
async function duplicatesOf(db: Executor, input: Omit<ShipmentCreateInput, "id">, today: string) {
  const reference = input.merchantReference;
  const phone = (input as { recipientPhone?: string }).recipientPhone;
  if (!reference && !phone) return [];
  const rows = await db
    .select({ trackingNumber: shipments.trackingNumber })
    .from(shipments)
    .where(
      and(
        eq(shipments.merchantId, input.merchantId),
        eq(shipments.serviceDate, input.serviceDate ?? today),
        ne(shipments.status, "voided"),
        reference
          ? eq(shipments.merchantReference, reference)
          : eq(shipments.recipientPhone, phone ?? ""),
      ),
    );
  return rows.map((row) => row.trackingNumber);
}

/** The non-blocking warnings of FR-010: a Sunday service date or a window already past. */
function rowWarnings(serviceDate: string, preset: WindowPreset | null, now: Date): string[] {
  let window = null;
  try {
    window = preset ? windowFromPreset(serviceDate, preset) : null;
  } catch {
    // An invalid window is already an error of the row.
  }
  const { sunday, past } = windowWarnings(serviceDate, window, now);
  return [
    ...(sunday ? ["La fecha del servicio es un domingo."] : []),
    ...(past ? ["La franja de entrega ya pasó."] : []),
  ];
}

export const bulkRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  // Row-by-row preview with parsed values, fee, neighborhood match, and errors (FR-019, FR-020).
  .post("/preview", validate("json", bulkPreviewInput), async (c) => {
    const { merchantId, pickupPointId, rows } = c.req.valid("json");
    const db = c.get("db");
    const table = readBulkTable(rows.map((row) => row.cells));
    if ("error" in table) throw new AppError("invalid_request", { message: table.error });
    // A detected header shifts the rows; the dispatcher's choices follow their row.
    const offset = rows.length - table.rows.length;
    const chosen = rows.slice(offset).map((row) => row.neighborhoodId);

    const registeredAt = c.get("clock")();
    const today = bogotaToday(registeredAt);
    const entries = await rateEntriesFor(db, merchantId);
    const pickup = pickupPointId ?? (await defaultPickupPoint(db, merchantId));

    const preview: BulkPreviewRow[] = [];
    for (const [index, cells] of table.rows.entries()) {
      const { row, errors } = parseBulkRow(cells);
      const { neighborhood, carrier, ...fields } = row;
      const confirmations: BulkConfirmation[] = [];

      let match: BulkPreviewRow["neighborhoodMatch"] = null;
      if (row.kind !== "errand" && (neighborhood || chosen[index])) {
        const place = await placeFor(db, neighborhood ?? "", chosen[index]);
        if (place) {
          match = {
            id: place.id,
            name: place.name,
            municipality: place.municipality.name,
            similarity: place.similarity,
          };
          if (place.similarity < 1) confirmations.push("neighborhood");
        } else {
          errors["recipientNeighborhoodId"] =
            `No encontramos «${neighborhood ?? ""}» en el catálogo; elige el barrio.`;
        }
      }
      let carrierId: string | undefined;
      if (row.kind === "carrier_handoff" && carrier) {
        carrierId = await carrierFor(db, carrier);
        if (!carrierId) errors["carrierId"] = `No encontramos la transportadora «${carrier}».`;
      }

      // Without "Tarifa", the fee is the rate card's (FR-006); errands always need one.
      let calculatedFee: number | null = null;
      try {
        const place = await pricingPlace(db, row.kind, match?.id ?? null);
        calculatedFee = calculateFee({
          kind: row.kind,
          merchantId,
          rateZoneId: place?.rateZone.id ?? null,
          serviceLevel: row.serviceLevel,
          registeredAt,
          entries,
        }).calculatedFee;
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        Object.assign(errors, error.fields);
      }
      if (
        fields.fee === undefined &&
        calculatedFee === null &&
        !errors["recipientNeighborhoodId"]
      ) {
        errors["fee"] =
          row.kind === "errand"
            ? "Escribe la Tarifa y el Motivo tarifa de la diligencia."
            : "Este destino no tiene tarifa: escribe la Tarifa y el Motivo tarifa.";
      }

      const input = {
        ...fields,
        merchantId,
        pickupPointId: pickup,
        fee: fields.fee ?? calculatedFee ?? 0,
        ...(match && { recipientNeighborhoodId: match.id }),
        ...(carrierId && { carrierId }),
      } as Omit<ShipmentCreateInput, "id">;

      const parsed = shipmentCreateInput.safeParse({
        ...input,
        id: crypto.randomUUID(),
        confirmed: true,
      });
      const codError = codAmountError(row.paymentMode, row.codAmount ?? null);
      if (codError) errors["codAmount"] ??= codError;
      // A missing fee is already explained by the destination or by the fee error above.
      const feeUnknown = fields.fee === undefined && calculatedFee === null;
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path.join(".") || "_";
          if (!(field === "fee" && feeUnknown)) errors[field] ??= issue.message;
        }
      } else if (Object.keys(errors).length === 0) {
        try {
          const values = await prepareShipment(db, parsed.data, {
            userId: c.get("user").id,
            registeredAt,
            entries,
          });
          if (
            values.fee > feeConfirmationThreshold ||
            (values.codAmount ?? 0) > codConfirmationThreshold
          ) {
            confirmations.push("amount");
          }
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          Object.assign(errors, error.fields);
        }
      }

      const duplicateOf = await duplicatesOf(db, input, today);
      if (duplicateOf.length > 0) confirmations.push("duplicate");
      preview.push({
        input,
        warnings: rowWarnings(input.serviceDate ?? today, input.window ?? null, registeredAt),
        neighborhoodMatch: match,
        calculatedFee,
        duplicateOf,
        errors,
        confirmations,
        status:
          Object.keys(errors).length > 0
            ? "invalid"
            : confirmations.length > 0
              ? "needs_confirmation"
              : "ready",
      });
    }
    return c.json({ rows: preview });
  })
  // All confirmed rows are created together or none (FR-020); the batch is exactly-once.
  .post("/confirm", validate("json", bulkConfirmInput), async (c) => {
    const { batchId, merchantId, rows } = c.req.valid("json");
    const db = c.get("db");
    const user = c.get("user");

    const result = async (): Promise<BulkConfirmResult> => {
      const stored = await db
        .select({ id: shipments.id, trackingNumber: shipments.trackingNumber })
        .from(shipments)
        .where(
          or(
            eq(shipments.bulkBatchId, batchId),
            inArray(
              shipments.id,
              rows.map((row) => row.id),
            ),
          ),
        );
      const byId = new Map(stored.map((row) => [row.id, row.trackingNumber]));
      return {
        batchId,
        created: rows.flatMap((row, index) => {
          const trackingNumber = byId.get(row.id);
          return trackingNumber ? [{ row: index, id: row.id, trackingNumber }] : [];
        }),
      };
    };
    const [existing] = await db
      .select({ id: bulkBatches.id })
      .from(bulkBatches)
      .where(eq(bulkBatches.id, batchId));
    if (existing) return c.json(await result(), 200);

    const registeredAt = c.get("clock")();
    const entries = await rateEntriesFor(db, merchantId);
    const fields: Record<string, string> = {};
    const values: NewShipment[] = [];
    for (const [index, row] of rows.entries()) {
      if (row.merchantId !== merchantId) {
        fields[`rows.${String(index)}.merchantId`] = "Todas las filas son del mismo cliente.";
        continue;
      }
      try {
        const prepared = await prepareShipment(db, row, {
          userId: user.id,
          registeredAt,
          entries,
        });
        values.push({ ...prepared, bulkBatchId: batchId });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        const problems = error.fields ?? { confirmed: error.message };
        for (const [field, message] of Object.entries(problems)) {
          fields[`rows.${String(index)}.${field}`] = message;
        }
      }
    }
    if (Object.keys(fields).length > 0) {
      throw new AppError("invalid_request", {
        message: "Algunas filas tienen errores; no se creó ningún envío.",
        fields,
      });
    }

    try {
      await insertShipments(db, values, async (tx) => {
        await tx.insert(bulkBatches).values({
          id: batchId,
          merchantId,
          createdBy: user.id,
          rowCount: rows.length,
          createdCount: rows.length,
        });
      });
    } catch (error) {
      // The same batch confirmed at the same time by a retry.
      if (!isUniqueViolation(error, "bulk_batches_pkey")) throw error;
      return c.json(await result(), 200);
    }
    return c.json(await result(), 201);
  });
