import { userRoleLabels } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
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
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
  const couriers = useQuery(courierAccountsQuery);
  const [deactivating, setDeactivating] = useState<Account | null>(null);

  async function act(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        actions={
          <>
            <AccountDialog />
          </>
        }
      />
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
                    <AccountDialog account={account} />
                    <Button
                      variant="ghost"
                      onClick={() => void act(() => endSessions(account.id), "Sesiones cerradas")}
                    >
                      Cerrar sesiones
                    </Button>
                    {account.banned ? (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void act(() => reactivateAccount(account.id), "Cuenta reactivada")
                        }
                      >
                        Reactivar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
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
                if (account) void act(() => deactivateAccount(account.id), "Cuenta desactivada");
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
