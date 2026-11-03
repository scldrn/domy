import { paymentModeLabels, paymentModes, resolveCodAmount } from "@domy/domain";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { MoneyInput } from "@/components/money-input";
import { SegmentedControl } from "@/components/segmented-control";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { formatCop } from "@/lib/format";
import { ChangedMark } from "./changed-mark";
import type { ShipmentFormValues } from "./form-values";

/** Payment mode and the COD amount it implies (FR-009). */
export function PaymentModeFields() {
  const { control } = useFormContext<ShipmentFormValues>();
  const [mode, fee] = useWatch({ control, name: ["paymentMode", "fee"] });
  return (
    <>
      <Controller
        control={control}
        name="paymentMode"
        render={({ field }) => (
          <Field className="sm:col-span-2">
            <FieldLabel>Modalidad de pago</FieldLabel>
            <SegmentedControl
              label="Modalidad de pago"
              value={field.value}
              onChange={field.onChange}
              options={paymentModes.map((value) => ({ value, label: paymentModeLabels[value] }))}
            />
          </Field>
        )}
      />
      {mode === "cash_on_delivery" ? (
        <Controller
          control={control}
          name="codAmount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="codAmount">
                Valor a recaudar
                <ChangedMark name="codAmount" />
              </FieldLabel>
              <MoneyInput
                id="codAmount"
                value={field.value}
                onChange={field.onChange}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      ) : (
        <p className="text-body-m text-on-surface-variant">
          Valor a recaudar:{" "}
          <span className="tabular-nums text-on-surface">
            {formatCop(resolveCodAmount(mode, fee ?? 0, 0))}
          </span>
        </p>
      )}
    </>
  );
}
