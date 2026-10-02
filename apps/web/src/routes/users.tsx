import { userRoleLabels } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
import { AccountDialog } from "@/features/users/account-dialog";
import {
  deactivateAccount,
  endSessions,
  listAccounts,
  reactivateAccount,
  type Account,
} from "@/features/users/api";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";

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
          {(accounts.data ?? []).map((account) => (
            <TableRow key={account.id}>
              <TableCell>{account.name}</TableCell>
              <TableCell>{account.email}</TableCell>
              <TableCell>{userRoleLabels[account.role]}</TableCell>
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
