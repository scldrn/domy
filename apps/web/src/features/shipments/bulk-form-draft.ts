import { bulkConfirmInput, type BulkConfirmInput } from "@domy/domain";
import { z } from "zod";
import type { MerchantOption } from "./api";

const merchantDraftOption = z.looseObject({
  id: z.uuid(),
  name: z.string(),
  aliases: z.array(z.string()),
});

function stableJson(value: unknown): string {
  const sortKeys = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sortKeys);
    if (typeof entry !== "object" || entry === null) return entry;
    return Object.fromEntries(
      Object.entries(entry)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortKeys(nested)]),
    );
  };
  return JSON.stringify(sortKeys(value));
}

const bulkFormSchema = z.strictObject({
  merchant: merchantDraftOption.nullable(),
  pickupPointId: z.string().nullable(),
  text: z.string(),
});

const pendingBulkSchema = z
  .unknown()
  .nullable()
  .transform((value, context) => {
    if (value === null) return null;
    const parsed = z
      .strictObject({ input: bulkConfirmInput, remainingText: z.string() })
      .safeParse(value);
    if (!parsed.success || stableJson(parsed.data) !== stableJson(value)) {
      context.addIssue({ code: "custom", message: "El lote pendiente no es válido." });
      return z.NEVER;
    }
    return parsed.data;
  });

export type BulkForm = {
  merchant: MerchantOption | null;
  pickupPointId: string | null;
  text: string;
};

export type BulkPending = Exclude<z.output<typeof pendingBulkSchema>, null>;

export type BulkDraft = {
  form: BulkForm;
  pending: BulkPending | null;
  needsIntentAcknowledgement: boolean;
};

export const bulkDraftSchema = z.union([
  z
    .strictObject({
      form: bulkFormSchema,
      pending: pendingBulkSchema,
      needsIntentAcknowledgement: z.boolean(),
    })
    .superRefine(({ form, pending }, context) => {
      if (pending && !bulkInputMatchesDraftMerchant(form.merchant?.id, pending.input)) {
        context.addIssue({
          code: "custom",
          path: ["pending", "input"],
          message: "El lote pendiente no coincide con el cliente guardado.",
        });
      }
    }),
  bulkFormSchema.transform((form) => ({
    form,
    pending: null,
    needsIntentAcknowledgement: true,
  })),
]);

export function emptyBulkDraft(): BulkDraft {
  return {
    form: { merchant: null, pickupPointId: null, text: "" },
    pending: null,
    needsIntentAcknowledgement: false,
  };
}

export function bulkInputMatchesDraftMerchant(
  merchantId: string | null | undefined,
  input: BulkConfirmInput,
): boolean {
  return (
    merchantId === input.merchantId &&
    input.rows.every((row) => row.merchantId === input.merchantId)
  );
}
