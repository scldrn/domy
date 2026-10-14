import { userRoleLabels, userRoles, type Courier, type UserRole } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
import { Field, FieldDescription } from "@/components/ui/field";
import { linkCourierAccount, listCouriers } from "@/features/master-data/api";
import { FormDialog } from "@/features/master-data/form-dialog";
import { TextField } from "@/features/master-data/text-field";
import { ApiError } from "@/lib/api-client";
import { createAccount, setRole, updateAccount, type Account } from "./api";

const roleOptions = userRoles.map((value) => ({ value, label: userRoleLabels[value] }));
const unlinked = "sin-vincular";

/** The couriers and their accounts, to link a courier account (feature 003, FR-002). */
export const courierAccountsQuery = {
  queryKey: ["couriers", "accounts"],
  queryFn: () => listCouriers("", "true"),
};

export const linkedCourier = (couriers: Courier[] | undefined, accountId: string) =>
  couriers?.find((courier) => courier.account?.id === accountId) ?? null;

/**
 * Creates an account, or edits its name, email, and role (FR-032). An account with the
 * courier role is linked to the courier it works as, which decides the route it sees
 * (feature 003, FR-002).
 */
export function AccountDialog({ account }: { account?: Account }) {
  const queryClient = useQueryClient();
  const couriers = useQuery(courierAccountsQuery);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<UserRole>("dispatcher");
  const [password, setPassword] = useState("");
  const [courierId, setCourierId] = useState<string>(unlinked);

  const current = account ? linkedCourier(couriers.data, account.id) : null;
  // Couriers without an account, and the one this account already works as.
  const courierOptions = [
    { value: unlinked, label: "Sin vincular" },
    ...(couriers.data ?? [])
      .filter((courier) => !courier.account || courier.account.id === account?.id)
      .map((courier) => ({ value: courier.id, label: courier.name })),
  ];
  const chosen = courierId === unlinked ? null : courierId;

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
        setCourierId(current?.id ?? unlinked);
      }}
      onSubmit={async () => {
        if (account) {
          if (name !== account.name || email !== account.email) {
            await updateAccount(account.id, { name: name.trim(), email: email.trim() });
          }
          const wanted = role === "courier" ? chosen : null;
          const relink = (current?.id ?? null) !== wanted;
          // Only a courier account is linked: it becomes one before linking, and is unlinked
          // before it stops being one.
          if (role !== account.role && role === "courier") await setRole(account.id, role);
          if (relink) await linkCourierAccount(account.id, wanted);
          if (role !== account.role && role !== "courier") await setRole(account.id, role);
        } else {
          const { user } = await createAccount({
            name: name.trim(),
            email: email.trim(),
            role,
            password,
          });
          if (role === "courier" && chosen) {
            try {
              await linkCourierAccount(user.id, chosen);
            } catch (error) {
              // The account exists: say so, and let the owner link it by editing it.
              toast.error(
                `La cuenta se creó, pero no se pudo vincular al mensajero: ${
                  error instanceof ApiError ? error.message : "intenta de nuevo editándola."
                }`,
              );
            }
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        await queryClient.invalidateQueries({ queryKey: ["couriers"] });
        toast.success(account ? "Cuenta actualizada" : `Cuenta de ${name} creada`);
      }}
    >
      <TextField label="Nombre" value={name} onChange={setName} autoFocus />
      <TextField label="Correo" type="email" value={email} onChange={setEmail} />
      <Field>
        <OptionSelect label="Rol" value={role} onChange={setRoleValue} options={roleOptions} />
      </Field>
      {role === "courier" && (
        <Field>
          <OptionSelect
            label="Mensajero vinculado"
            value={courierId}
            onChange={setCourierId}
            options={courierOptions}
          />
          <FieldDescription>
            La app del mensajero muestra la ruta del mensajero que elijas aquí.
          </FieldDescription>
        </Field>
      )}
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
