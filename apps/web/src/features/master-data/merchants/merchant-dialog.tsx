import type { Merchant } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createMerchant, updateMerchant } from "../api";
import { FormDialog, splitList } from "../form-dialog";
import { TextField } from "../text-field";

/** Creates a merchant or edits its name, WhatsApp contact, and aliases (FR-026, FR-027). */
export function MerchantDialog({ merchant }: { merchant?: Merchant }) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [aliases, setAliases] = useState("");

  return (
    <FormDialog
      triggerLabel={merchant ? "Editar" : "Nuevo cliente"}
      triggerVariant={merchant ? "outline" : "default"}
      title={merchant ? "Editar cliente" : "Nuevo cliente"}
      submitLabel={merchant ? "Guardar cambios" : "Crear cliente"}
      onOpen={() => {
        setKey(crypto.randomUUID());
        setName(merchant?.name ?? "");
        setWhatsapp(merchant?.whatsappPhone ?? "");
        setAliases(merchant?.aliases.join(", ") ?? "");
      }}
      onSubmit={async () => {
        const values = {
          name,
          whatsappPhone: whatsapp.replace(/\D/g, "") || null,
          aliases: splitList(aliases),
        };
        if (merchant) await updateMerchant(merchant.id, { actionId: key, ...values });
        else await createMerchant({ id: key, ...values });
        await queryClient.invalidateQueries({ queryKey: ["master", "merchants"] });
        toast.success(merchant ? "Cliente actualizado" : `Cliente ${name} creado`);
      }}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus />
      <TextField
        label="WhatsApp"
        value={whatsapp}
        onChange={setWhatsapp}
        inputMode="tel"
        description="Número de 10 dígitos para avisos al cliente (opcional)."
      />
      <TextField
        label="Alias"
        value={aliases}
        onChange={setAliases}
        description="Otros nombres con que lo conocen, separados por comas."
      />
    </FormDialog>
  );
}
