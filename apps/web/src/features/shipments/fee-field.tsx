import { Controller, useFormContext, useWatch } from "react-hook-form";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatCop } from "@/lib/format";
import { ChangedMark } from "./changed-mark";
import type { ShipmentFormValues } from "./form-values";

/**
 * The fee: calculated from the rate card, or entered by hand with a reason (FR-006, FR-007,
 * FR-007a, FR-035).
 */
export function FeeField({
  calculatedFee,
  needsManualFee,
  quoting,
}: {
  calculatedFee: number | null;
  needsManualFee: boolean;
  quoting: boolean;
}) {
  const { control, setValue } = useFormContext<ShipmentFormValues>();
  const [overridden, kind] = useWatch({ control, name: ["feeOverridden", "kind"] });
  const manual = needsManualFee || overridden;
  const manualReasonLabel =
    kind === "errand"
      ? "Motivo de la tarifa (la diligencia y la distancia)"
      : needsManualFee
        ? "Motivo de la tarifa manual"
        : "Motivo del cambio de tarifa";

  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="fee"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="fee">
              Tarifa
              <ChangedMark name="fee" />
            </FieldLabel>
            {manual ? (
              <MoneyInput
                id="fee"
                value={field.value}
                onChange={field.onChange}
                aria-invalid={fieldState.invalid}
              />
            ) : (
              <p className="flex h-14 items-center text-title-l tabular-nums">
                {quoting || calculatedFee === null ? "—" : formatCop(calculatedFee)}
              </p>
            )}
            {needsManualFee && kind !== "errand" && (
              <FieldDescription>
                La zona no tiene tarifa: el envío quedará como «Tarifa por revisar».
              </FieldDescription>
            )}
            {!needsManualFee && calculatedFee !== null && overridden && (
              <FieldDescription>Tarifa calculada: {formatCop(calculatedFee)}</FieldDescription>
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {!needsManualFee && calculatedFee !== null && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setValue("feeOverridden", !overridden);
            setValue("fee", calculatedFee);
            setValue("feeOverrideReason", "");
          }}
        >
          {overridden ? "Usar la tarifa calculada" : "Cambiar tarifa"}
        </Button>
      )}
      {manual && (
        <Controller
          control={control}
          name="feeOverrideReason"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="feeOverrideReason">{manualReasonLabel}</FieldLabel>
              <Textarea
                id="feeOverrideReason"
                maxLength={200}
                aria-invalid={fieldState.invalid}
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      )}
    </div>
  );
}
