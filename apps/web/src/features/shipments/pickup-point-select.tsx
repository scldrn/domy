import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/option-select";
import { listPickupPoints } from "./api";
import { otherPickupAddress, type ShipmentFormValues } from "./form-values";
import { NeighborhoodCombobox } from "./neighborhood-combobox";

/**
 * The merchant's pickup point, filled with its default, or a one-off address (FR-003).
 */
export function PickupPointSelect({ freezeDefault = false }: { freezeDefault?: boolean }) {
  const { control, register, setValue, formState } = useFormContext<ShipmentFormValues>();
  const merchant = useWatch({ control, name: "merchant" });
  const pickupPointId = useWatch({ control, name: "pickupPointId" });
  const points = useQuery({
    queryKey: ["pickup-points", merchant?.id],
    queryFn: () => listPickupPoints(merchant?.id ?? ""),
    enabled: Boolean(merchant),
  });

  // A newly chosen merchant fills its default pickup point.
  useEffect(() => {
    if (freezeDefault || !points.data || pickupPointId) return;
    const fallback = points.data.find((point) => point.isDefault) ?? points.data[0];
    setValue("pickupPointId", fallback?.id ?? otherPickupAddress);
  }, [freezeDefault, points.data, pickupPointId, setValue]);

  const items = [
    ...(points.data ?? []).map((point) => ({
      value: point.id,
      label: `${point.label} · ${point.address}`,
    })),
    { value: otherPickupAddress, label: "Otra dirección" },
  ];

  return (
    <>
      <Controller
        control={control}
        name="pickupPointId"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <OptionSelect
              label="Punto de recogida"
              value={field.value}
              onChange={field.onChange}
              options={items}
              placeholder="Primero elige el cliente"
              disabled={!merchant}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {pickupPointId === otherPickupAddress && (
        <>
          <Field data-invalid={Boolean(formState.errors.pickupAddress)}>
            <FieldLabel htmlFor="pickupAddress">Dirección de recogida</FieldLabel>
            <Input id="pickupAddress" {...register("pickupAddress")} />
            <FieldError errors={[formState.errors.pickupAddress]} />
          </Field>
          <NeighborhoodCombobox name="pickupNeighborhood" label="Barrio de recogida" />
        </>
      )}
    </>
  );
}
