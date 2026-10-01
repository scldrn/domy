import type { Carrier } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createCarrier, updateCarrier } from "../api";
import { FormDialog } from "../form-dialog";
import { TextField } from "../text-field";

/** Creates or renames a carrier (FR-026). */
export function CarrierDialog({ carrier }: { carrier?: Carrier }) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");

  return (
    <FormDialog
      triggerLabel={carrier ? "Editar" : "Nueva transportadora"}
      triggerVariant={carrier ? "ghost" : "default"}
      title={carrier ? "Editar transportadora" : "Nueva transportadora"}
      submitLabel={carrier ? "Guardar cambios" : "Crear transportadora"}
      onOpen={() => {
        setKey(crypto.randomUUID());
        setName(carrier?.name ?? "");
      }}
      onSubmit={async () => {
        if (carrier) await updateCarrier(carrier.id, { actionId: key, name });
        else await createCarrier({ id: key, name });
        await queryClient.invalidateQueries({ queryKey: ["master", "carriers"] });
        toast.success(carrier ? "Transportadora actualizada" : `Transportadora ${name} creada`);
      }}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus />
    </FormDialog>
  );
}
