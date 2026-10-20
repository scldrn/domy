import { useFormContext, useWatch, type UseFormSetValue } from "react-hook-form";
import { SearchCombobox } from "@/components/search-combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { searchRecipients, type RecipientOption } from "./api";
import type { ShipmentFormValues } from "./form-values";

export type RecipientAutofillSetter = UseFormSetValue<ShipmentFormValues>;

/**
 * Applies authoritative previous-recipient data to the shipment form (FR-004, Finding IV-23, 001/T149).
 * Preserves required validation if past neighborhood is inactive/missing, without guessing replacements.
 */
export function applyRecipientAutofill(
  recipient: RecipientOption,
  setValue: RecipientAutofillSetter,
) {
  setValue("recipientName", recipient.recipientName ?? "");
  setValue("recipientPhone", recipient.recipientPhone ?? "");
  setValue("recipientAddress", recipient.recipientAddress ?? "");
  if (recipient.recipientNeighborhood && recipient.recipientNeighborhood.isActive !== false) {
    setValue("recipientNeighborhood", recipient.recipientNeighborhood);
  } else {
    setValue("recipientNeighborhood", null);
  }
}

/**
 * Recipients of the merchant's past shipments, by name or phone; choosing one fills their
 * data (FR-004).
 */
export function RecipientAutocomplete() {
  const { control, setValue } = useFormContext<ShipmentFormValues>();
  const merchant = useWatch({ control, name: "merchant" });
  if (!merchant) return null;
  return (
    <Field>
      <FieldLabel htmlFor="recipient-search">Destinatario anterior (opcional)</FieldLabel>
      <SearchCombobox<RecipientOption>
        id="recipient-search"
        label="Destinatario anterior"
        queryKey={["recipients", merchant.id]}
        search={(q) => searchRecipients(merchant.id, q)}
        value={null}
        onChange={(recipient) => {
          if (!recipient) return;
          applyRecipientAutofill(recipient, setValue);
        }}
        itemKey={(recipient) => recipient.recipientPhone ?? ""}
        itemLabel={(recipient) => recipient.recipientName ?? ""}
        renderItem={(recipient) => (
          <span className="flex w-full justify-between gap-4">
            <span>{recipient.recipientName}</span>
            <span className="text-body-s text-on-surface-variant tabular-nums">
              {recipient.recipientPhone}
            </span>
          </span>
        )}
        placeholder="Nombre o teléfono"
        emptyText="Sin destinatarios anteriores"
      />
    </Field>
  );
}
