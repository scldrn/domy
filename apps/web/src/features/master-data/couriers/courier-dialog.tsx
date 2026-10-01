import type { Courier } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createCourier, updateCourier } from "../api";
import { FormDialog, splitList } from "../form-dialog";
import { TextField } from "../text-field";

/** Creates a courier or edits its name, phone, and aliases (FR-026, FR-027). */
export function CourierDialog({ courier }: { courier?: Courier }) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [aliases, setAliases] = useState("");

  return (
    <FormDialog
      triggerLabel={courier ? "Editar" : "Nuevo mensajero"}
      triggerVariant={courier ? "ghost" : "default"}
      title={courier ? "Editar mensajero" : "Nuevo mensajero"}
      submitLabel={courier ? "Guardar cambios" : "Crear mensajero"}
      onOpen={() => {
        setKey(crypto.randomUUID());
        setName(courier?.name ?? "");
        setPhone(courier?.phone ?? "");
        setAliases(courier?.aliases.join(", ") ?? "");
      }}
      onSubmit={async () => {
        const values = { name, phone: phone.replace(/\D/g, ""), aliases: splitList(aliases) };
        if (courier) await updateCourier(courier.id, { actionId: key, ...values });
        else await createCourier({ id: key, ...values });
        await queryClient.invalidateQueries({ queryKey: ["master", "couriers"] });
        toast.success(courier ? "Mensajero actualizado" : `Mensajero ${name} creado`);
      }}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus />
      <TextField label="Teléfono" value={phone} onChange={setPhone} inputMode="tel" />
      <TextField
        label="Alias"
        value={aliases}
        onChange={setAliases}
        description="Otros nombres con que lo conocen, separados por comas."
      />
    </FormDialog>
  );
}
