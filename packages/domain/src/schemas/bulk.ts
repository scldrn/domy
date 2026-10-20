import { z } from "zod";
import { maxBulkRows } from "../bulk-rows.ts";
import { shipmentCreateInput, type ShipmentCreateInput } from "./shipment.ts";

/**
 * Input of `POST /api/bulk/preview`: the raw template rows (FR-019), each optionally with the
 * neighborhood the dispatcher chose for it in the preview (FR-020).
 */
export const bulkPreviewInput = z.object({
  merchantId: z.uuid("Elige un cliente."),
  pickupPointId: z.uuid().optional(),
  rows: z
    .array(z.object({ cells: z.array(z.string()), neighborhoodId: z.uuid().optional() }))
    .min(1, "La lista no tiene filas."),
});
export type BulkPreviewInput = z.input<typeof bulkPreviewInput>;

/** What a row still needs from the dispatcher before it can be created. */
export type BulkConfirmation = "neighborhood" | "duplicate" | "amount";

export type BulkPreviewRow = {
  /** The registration the row becomes, without its identifier; incomplete when invalid. */
  input: Omit<ShipmentCreateInput, "id">;
  neighborhoodMatch: { id: string; name: string; municipality: string; similarity: number } | null;
  calculatedFee: number | null;
  duplicateOf: string[];
  errors: Record<string, string>;
  /** Non-blocking warnings (FR-010): a Sunday service date or a window already past. */
  warnings: string[];
  confirmations: BulkConfirmation[];
  status: "ready" | "needs_confirmation" | "invalid";
};

/** Input of `POST /api/bulk/confirm`: the rows the dispatcher confirmed, created together. */
export const bulkConfirmInput = z
  .object({
    batchId: z.uuid(),
    merchantId: z.uuid(),
    rows: z.array(shipmentCreateInput).min(1).max(maxBulkRows),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [index, row] of data.rows.entries()) {
      if (seen.has(row.id)) {
        ctx.addIssue({
          code: "custom",
          message: "El identificador del envío está repetido en la lista.",
          path: ["rows", index, "id"],
        });
      } else {
        seen.add(row.id);
      }
    }
  });
export type BulkConfirmInput = z.input<typeof bulkConfirmInput>;

export type BulkConfirmResult = {
  batchId: string;
  created: { row: number; id: string; trackingNumber: string }[];
};
