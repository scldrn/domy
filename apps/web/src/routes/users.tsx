import { userRoleLabels } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AccountDialog,
  courierAccountsQuery,
  linkedCourier,
} from "@/features/users/account-dialog";
import {
  deactivateAccount,
  endSessions,
  listAccounts,
  reactivateAccount,
  type Account,
} from "@/features/users/api";
import { readAccountWorkflow } from "@/features/users/account-workflow";
import { readPendingAccountIntent } from "@/features/users/account-intents";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_panel/usuarios")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "owner") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Usuarios · Domy" }] }),
  component: UsersPage,
});

/** Accounts and roles, managed by the owner (FR-032, FR-033a). */
function UsersPage() {
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
  const couriers = useQuery(courierAccountsQuery);
  const [deactivating, setDeactivating] = useState<Account | null>(null);
  const pendingAccounts = useQuery({
    queryKey: ["account-intents", user.id, accounts.data?.map((account) => account.id).join(",")],
    enabled: accounts.isSuccess,
    queryFn: async () => ({
      intents: new Map(
        await Promise.all(
          (accounts.data ?? []).map(
            async (account) =>
              [account.id, await readPendingAccountIntent(user.id, account.id)] as const,
          ),
        ),
      ),
      creatingUserId: (await readAccountWorkflow(user.id, null))?.createdUserId ?? null,
    }),
  });
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        event.key?.startsWith(`domy:account-intent:${user.id}:`) ||
        event.key?.startsWith(`domy:account-workflow:${user.id}:`)
      )
        void queryClient.invalidateQueries({ queryKey: ["account-intents", user.id] });
    };
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("storage", changed);
    };
  }, [queryClient, user.id]);

  async function act(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["account-intents", user.id] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        actions={
          <>
            <AccountDialog actorId={user.id} />
          </>
        }
      />
      {pendingAccounts.isError && (
        <p role="alert" className="text-body-m text-error">
          No pudimos verificar los cambios pendientes. Permite el almacenamiento del sitio y
          recarga; no borres sus datos.
        </p>
      )}
      {accounts.isPending ? (
        <TableSkeleton columns={5} rows={5} label="Cargando usuarios…" />
      ) : accounts.isError ? (
        <QueryErrorAlert
          title="No pudimos cargar los usuarios"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void accounts.refetch()}
        />
      ) : accounts.data.length === 0 ? (
        <DirectoryEmptyState
          title="Todavía no hay usuarios"
          description="Crea la primera cuenta de usuario para comenzar."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.data.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.name}</TableCell>
                <TableCell>{account.email}</TableCell>
                <TableCell>
                  {userRoleLabels[account.role]}
                  {account.role === "courier" && (
                    <span className="block text-body-s text-on-surface-variant">
                      {linkedCourier(couriers.data, account.id)?.name ?? "Sin vincular"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {account.banned ? (
                    <Badge variant="outline">Inactiva</Badge>
                  ) : (
                    <Badge variant="success">Activa</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <AccountDialog account={account} actorId={user.id} />
                    {(() => {
                      const pending = pendingAccounts.data?.intents.get(account.id);
                      if (!pending) return null;
                      const context = { actorId: user.id, intentId: pending.id };
                      const retry =
                        pending.operation === "ban"
                          ? () => deactivateAccount(account.id, context)
                          : pending.operation === "unban"
                            ? () => reactivateAccount(account.id, context)
                            : pending.operation === "revoke"
                              ? () => endSessions(account.id, context)
                              : null;
                      return retry ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-body-s">
                            Pendiente:{" "}
                            {pending.operation === "ban"
                              ? "desactivar cuenta"
                              : pending.operation === "unban"
                                ? "reactivar cuenta"
                                : "cerrar sesiones"}
                            .
                          </span>
                          <Button
                            variant="outline"
                            onClick={() => void act(retry, "Cambio pendiente confirmado")}
                          >
                            Reintentar cambio pendiente
                          </Button>
                        </div>
                      ) : (
                        <span className="text-body-s">
                          {pendingAccounts.data?.creatingUserId === account.id
                            ? "Hay una creación pendiente. Reabre Nueva cuenta para continuarla."
                            : "Hay un cambio pendiente. Reabre Editar para continuarlo."}
                        </span>
                      );
                    })()}
                    <Button
                      variant="ghost"
                      disabled={
                        pendingAccounts.isPending ||
                        pendingAccounts.isError ||
                        Boolean(pendingAccounts.data.intents.get(account.id))
                      }
                      onClick={() =>
                        void act(
                          () => endSessions(account.id, { actorId: user.id }),
                          "Sesiones cerradas",
                        )
                      }
                    >
                      Cerrar sesiones
                    </Button>
                    {account.banned ? (
                      <Button
                        variant="ghost"
                        disabled={
                          pendingAccounts.isPending ||
                          pendingAccounts.isError ||
                          Boolean(pendingAccounts.data.intents.get(account.id))
                        }
                        onClick={() =>
                          void act(
                            () => reactivateAccount(account.id, { actorId: user.id }),
                            "Cuenta reactivada",
                          )
                        }
                      >
                        Reactivar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={
                          pendingAccounts.isPending ||
                          pendingAccounts.isError ||
                          Boolean(pendingAccounts.data.intents.get(account.id))
                        }
                        onClick={() => {
                          setDeactivating(account);
                        }}
                      >
                        Desactivar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar la cuenta de {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sus sesiones se cierran de inmediato y no podrá ingresar hasta que la reactives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const account = deactivating;
                setDeactivating(null);
                if (account)
                  void act(
                    () => deactivateAccount(account.id, { actorId: user.id }),
                    "Cuenta desactivada",
                  );
              }}
            >
              Desactivar cuenta
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
