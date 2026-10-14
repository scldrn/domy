import { collectedTotal, formatCop, paymentMethodLabels } from "@domy/domain";
import { useId } from "react";
import { MoneyInput } from "@/components/money-input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

/** What was collected, by payment method (FR-010). */
export type Collection = {
  cashAmount: number;
  companyTransferAmount: number;
  merchantTransferAmount: number;
};

/** The full COD amount proposed in cash (FR-010). */
export const proposedCollection = (codAmount: number): Collection => ({
  cashAmount: codAmount,
  companyTransferAmount: 0,
  merchantTransferAmount: 0,
});

const methods = [
  ["cashAmount", paymentMethodLabels.cash],
  ["companyTransferAmount", paymentMethodLabels.companyTransfer],
  ["merchantTransferAmount", paymentMethodLabels.merchantTransfer],
] as const;

/**
 * The amount collected at a delivery, split among cash, transfer to the company, and transfer
 * to the merchant, against the COD amount (feature 003, FR-010, FR-011).
 */
export function CollectionFields({
  codAmount,
  value,
  onChange,
}: {
  codAmount: number;
  value: Collection;
  onChange: (value: Collection) => void;
}) {
  const id = useId();
  const total = collectedTotal(value);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-title-m text-on-surface">
        Recaudo · valor a recaudar {formatCop(codAmount)}
      </legend>
      {methods.map(([field, label]) => (
        <Field key={field}>
          <FieldLabel htmlFor={`${id}-${field}`}>{label}</FieldLabel>
          <MoneyInput
            id={`${id}-${field}`}
            value={value[field]}
            onChange={(amount) => {
              onChange({ ...value, [field]: amount ?? 0 });
            }}
          />
        </Field>
      ))}
      <FieldDescription
        aria-live="polite"
        className={total === codAmount ? "text-on-surface-variant" : "text-error"}
      >
        Total cobrado: <span className="tabular-nums">{formatCop(total)}</span>
        {total === codAmount ? "" : ` · distinto de ${formatCop(codAmount)}`}
      </FieldDescription>
    </fieldset>
  );
}
