import type { PickupPoint } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SearchCombobox } from "@/components/search-combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { searchNeighborhoods, type NeighborhoodOption } from "@/features/shipments/api";
import { createPickupPoint, updatePickupPoint } from "../api";
import { FormDialog } from "../form-dialog";
import { TextField } from "../text-field";

/** Adds a pickup point to a merchant or edits one (FR-026). */
export function PickupPointDialog({
  merchantId,
  point,
}: {
  merchantId: string;
  point?: PickupPoint;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [place, setPlace] = useState<{ id: string; name: string } | null>(null);

  return (
    <FormDialog
      triggerLabel={point ? "Editar" : "Agregar punto"}
      triggerVariant={point ? "ghost" : "outline"}
      title={point ? "Editar punto de recogida" : "Nuevo punto de recogida"}
      submitLabel={point ? "Guardar cambios" : "Agregar punto"}
      onOpen={() => {
        setKey(crypto.randomUUID());
        setLabel(point?.label ?? "");
        setAddress(point?.address ?? "");
        setInstructions(point?.instructions ?? "");
        setPlace(point?.neighborhood ?? null);
      }}
      onSubmit={async () => {
        const values = {
          label,
          address,
          neighborhoodId: place?.id ?? "",
          instructions: instructions.trim() || null,
        };
        if (point) await updatePickupPoint(point.id, { actionId: key, ...values });
        else await createPickupPoint(merchantId, { id: key, ...values });
        await queryClient.invalidateQueries({ queryKey: ["master", "merchant", merchantId] });
        toast.success(point ? "Punto actualizado" : "Punto agregado");
      }}
    >
      <TextField label="Nombre del punto" value={label} onChange={setLabel} autoFocus />
      <TextField label="Dirección" value={address} onChange={setAddress} />
      <Field>
        <FieldLabel htmlFor={`point-place-${key}`}>Barrio</FieldLabel>
        <SearchCombobox<NeighborhoodOption | { id: string; name: string }>
          id={`point-place-${key}`}
          label="Barrio"
          queryKey={["neighborhoods"]}
          search={searchNeighborhoods}
          value={place}
          onChange={setPlace}
          itemKey={(option) => option.id}
          itemLabel={(option) => option.name}
          placeholder="Busca el barrio"
        />
      </Field>
      <TextField label="Indicaciones (opcional)" value={instructions} onChange={setInstructions} />
    </FormDialog>
  );
}
