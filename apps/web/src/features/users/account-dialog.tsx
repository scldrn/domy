import { userRoleLabels, userRoles, type Courier, type UserRole } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/option-select";
import { Field, FieldDescription } from "@/components/ui/field";
import { listCouriers } from "@/features/master-data/api";
import { FormDialog } from "@/features/master-data/form-dialog";
import { TextField } from "@/features/master-data/text-field";
import { ApiError } from "@/lib/api-client";
import type { Account } from "./api";
import { readAccountWorkflow, runAccountWorkflow } from "./account-workflow";

const roleOptions = userRoles.map((value) => ({ value, label: userRoleLabels[value] }));
const unlinked = "sin-vincular";
type CourierSelection = string | null | undefined;
type CourierReadiness = "loading" | "ready" | "error";

/** The couriers and their accounts, to link a courier account (feature 003, FR-002). */
export const courierAccountsQuery = {
  queryKey: ["couriers", "accounts"],
  queryFn: () => listCouriers(""),
};

export function linkedCourier(
  couriers: Courier[] | undefined,
  accountId: string,
): Courier | null | undefined {
  if (couriers === undefined) return undefined;
  return couriers.find((courier) => courier.account?.id === accountId) ?? null;
}

/**
 * Creates an account, or edits its name, email, and role (FR-032). An account with the
 * courier role is linked to the courier it works as, which decides the route it sees
 * (feature 003, FR-002).
 */
export function AccountDialog({ account, actorId }: { account?: Account; actorId: string }) {
  const queryClient = useQueryClient();
  const couriers = useQuery(courierAccountsQuery);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<UserRole>("dispatcher");
  const [password, setPassword] = useState("");
  const [courierId, setCourierId] = useState<CourierSelection>(undefined);
  const [courierReadiness, setCourierReadiness] = useState<CourierReadiness>("loading");
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);

  const targetId = account?.id ?? createdUserId;
  const current = targetId ? linkedCourier(couriers.data, targetId) : null;
  const needsCourierReadiness = account?.role === "courier" || role === "courier";
  const courierLoadFailed =
    courierReadiness === "error" ||
    (courierReadiness !== "loading" && (couriers.isRefetchError || couriers.isError));
  const courierSelectionReady =
    courierReadiness === "ready" && !couriers.isFetching && !courierLoadFailed;
  // Active couriers may receive a new link. Keep only this account's inactive relationship
  // visible so an ordinary edit can preserve it without treating it as an eligible target.
  const courierOptions = [
    { value: unlinked, label: "Sin vincular" },
    ...(couriers.data ?? [])
      .filter((courier) =>
        courier.isActive
          ? !courier.account || courier.account.id === targetId
          : courier.account?.id === targetId,
      )
      .map((courier) => ({
        value: courier.id,
        label: `${courier.name}${courier.isActive ? "" : " (inactivo)"}`,
      })),
  ];

  function retryCouriers() {
    setCourierReadiness("loading");
    void couriers
      .refetch()
      .then((result) => {
        if (!result.isSuccess) {
          setCourierReadiness("error");
          return;
        }
        const linked = targetId ? linkedCourier(result.data, targetId) : null;
        setCourierId((selected) => (selected === undefined ? (linked?.id ?? null) : selected));
        setCourierReadiness("ready");
      })
      .catch(() => {
        setCourierReadiness("error");
      });
  }

  const courierStatus = courierLoadFailed ? (
    <div role="alert" className="flex flex-col items-start gap-3 text-body-m text-error">
      <p>
        No pudimos confirmar el mensajero vinculado. Revisa tu conexión e inténtalo de nuevo; no
        guardaremos este cambio hasta verificarlo.
      </p>
      <Button type="button" variant="outline" className="min-h-12" onClick={retryCouriers}>
        Reintentar
      </Button>
    </div>
  ) : !courierSelectionReady ? (
    <p role="status" aria-busy="true" className="text-body-s text-on-surface-variant">
      Confirmando el mensajero vinculado…
    </p>
  ) : (
    <FieldDescription>
      La app del mensajero muestra la ruta del mensajero que elijas aquí.
    </FieldDescription>
  );

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
      submitDisabled={storageError || (needsCourierReadiness && !courierSelectionReady)}
      onOpen={() => {
        setStorageError(true);
        setCourierReadiness("loading");
        setName(account?.name ?? "");
        setEmail(account?.email ?? "");
        setRoleValue(account?.role ?? "dispatcher");
        setPassword("");
        setCreatedUserId(null);
        setCourierId(undefined);
        void Promise.all([couriers.refetch(), readAccountWorkflow(actorId, account?.id ?? null)])
          .then(([result, pending]) => {
            if (pending) {
              setName(pending.input.name);
              setEmail(pending.input.email);
              setRoleValue(pending.input.role);
              setCourierId(pending.input.courierId);
              setCreatedUserId(pending.createdUserId);
            } else if (result.isSuccess) {
              const target = account?.id ?? null;
              const linked = target ? linkedCourier(result.data, target) : null;
              setCourierId(linked?.id ?? null);
            }
            setCourierReadiness(result.isSuccess ? "ready" : "error");
            setStorageError(false);
          })
          .catch((error: unknown) => {
            toast.error(
              error instanceof ApiError
                ? error.message
                : "No pudimos recuperar el cambio pendiente. Permite el almacenamiento del sitio e intenta de nuevo.",
            );
          });
      }}
      onSubmit={async () => {
        if (needsCourierReadiness && (!courierSelectionReady || courierId === undefined))
          throw new ApiError(409, {
            code: "courier_readiness_required",
            message:
              "No pudimos confirmar el mensajero vinculado. Reintenta la consulta antes de guardar.",
          });
        try {
          await runAccountWorkflow(
            actorId,
            account
              ? {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  role: account.role,
                  courierId: current?.id ?? null,
                }
              : null,
            {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              role,
              courierId: role === "courier" ? (courierId ?? null) : null,
            },
            password,
          );
        } catch (error) {
          const pending = await readAccountWorkflow(actorId, account?.id ?? null).catch(() => null);
          if (pending?.createdUserId) {
            setCreatedUserId(pending.createdUserId);
            setPassword("");
          }
          throw error;
        } finally {
          await queryClient.invalidateQueries({ queryKey: ["account-intents", actorId] });
        }
        setPassword("");
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
      {needsCourierReadiness && role !== "courier" && courierStatus}
      {role === "courier" && (
        <Field>
          <OptionSelect
            label="Mensajero vinculado"
            value={courierId === undefined ? "" : (courierId ?? unlinked)}
            onChange={(selected) => {
              setCourierId(selected === unlinked ? null : selected);
            }}
            {...(!courierSelectionReady && {
              placeholder: courierLoadFailed ? "Vínculo no confirmado" : "Consultando vínculo…",
            })}
            disabled={!courierSelectionReady}
            options={courierOptions}
          />
          {courierStatus}
        </Field>
      )}
      {!account && !createdUserId && (
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
