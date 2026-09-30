import { Controller, useFormContext } from "react-hook-form";
import { SearchCombobox } from "@/components/search-combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { searchMerchants, type MerchantOption } from "./api";
import type { ShipmentFormValues } from "./form-values";

/** The merchant, found by any registered name or alias (FR-003). */
export function MerchantCombobox({ autoFocus }: { autoFocus?: boolean }) {
  const { control, setValue } = useFormContext<ShipmentFormValues>();
  return (
    <Controller
      control={control}
      name="merchant"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="merchant">Cliente</FieldLabel>
          <SearchCombobox<MerchantOption>
            id="merchant"
            label="Cliente"
            queryKey={["merchants"]}
            search={searchMerchants}
            value={field.value as MerchantOption | null}
            onChange={(merchant) => {
              field.onChange(merchant);
              setValue("pickupPointId", null);
            }}
            itemKey={(merchant) => merchant.id}
            itemLabel={(merchant) => merchant.name}
            renderItem={(merchant) => (
              <span className="flex flex-col">
                <span>{merchant.name}</span>
                {merchant.aliases.length > 0 && (
                  <span className="text-body-s text-on-surface-variant">
                    {merchant.aliases.join(", ")}
                  </span>
                )}
              </span>
            )}
            placeholder="Nombre o alias del cliente"
            emptyText="No hay clientes con ese nombre"
            invalid={fieldState.invalid}
            {...(autoFocus && { autoFocus })}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
