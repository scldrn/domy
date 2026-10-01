import { userRoleLabels, userRoles, type UserRole } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
import { Field } from "@/components/ui/field";
import { FormDialog } from "@/features/master-data/form-dialog";
import { TextField } from "@/features/master-data/text-field";
import { createAccount, setRole, updateAccount, type Account } from "./api";

const roleOptions = userRoles.map((value) => ({ value, label: userRoleLabels[value] }));

/** Creates an account, or edits its name, email, and role (FR-032). */
export function AccountDialog({ account }: { account?: Account }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<UserRole>("dispatcher");
  const [password, setPassword] = useState("");

  return (
    <FormDialog
      triggerLabel={account ? "Editar" : "Nueva cuenta"}
      triggerVariant={account ? "ghost" : "default"}
      title={account ? `Editar ${account.name}` : "Nueva cuenta"}
      description={
        account
          ? undefined
          : "Comparte la contraseña inicial en persona; la persona puede cambiarla en Mi cuenta."
      }
      submitLabel={account ? "Guardar cambios" : "Crear cuenta"}
      onOpen={() => {
        setName(account?.name ?? "");
        setEmail(account?.email ?? "");
        setRoleValue(account?.role ?? "dispatcher");
        setPassword("");
      }}
      onSubmit={async () => {
        if (account) {
          if (name !== account.name || email !== account.email) {
            await updateAccount(account.id, { name: name.trim(), email: email.trim() });
          }
          if (role !== account.role) await setRole(account.id, role);
        } else {
          await createAccount({ name: name.trim(), email: email.trim(), role, password });
        }
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        toast.success(account ? "Cuenta actualizada" : `Cuenta de ${name} creada`);
      }}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus />
      <TextField label="Correo" type="email" value={email} onChange={setEmail} />
      <Field>
        <OptionSelect label="Rol" value={role} onChange={setRoleValue} options={roleOptions} />
      </Field>
      {!account && (
        <TextField
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          description="Entre 8 y 128 caracteres."
        />
      )}
    </FormDialog>
  );
}
