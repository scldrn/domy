import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import ArrowBackIcon from "@material-symbols/svg-400/rounded/arrow_back.svg?react";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
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
import { getMerchant, updateMerchant, updatePickupPoint } from "@/features/master-data/api";
import { MerchantDialog } from "@/features/master-data/merchants/merchant-dialog";
import { PickupPointDialog } from "@/features/master-data/merchants/pickup-point-dialog";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_panel/clientes/$merchantId")({
  head: () => ({ meta: [{ title: "Cliente · Domy" }] }),
  component: MerchantDetailPage,
});

const plural = (count: number) =>
  count === 1 ? "1 envío abierto" : `${String(count)} envíos abiertos`;

/** A merchant with its aliases and pickup points (FR-026, FR-029). */
function MerchantDetailPage() {
  const { merchantId } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["master", "merchant", merchantId];
  const merchant = useQuery({ queryKey, queryFn: () => getMerchant(merchantId) });
  const [confirming, setConfirming] = useState(false);

  async function change(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["master"] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
    }
  }

  if (merchant.isPending) return <p className="text-body-l">Cargando…</p>;
  if (merchant.isError) {
    return <p className="text-body-l text-error">{merchant.error.message}</p>;
  }
  const data = merchant.data;
  const setActive = (isActive: boolean) =>
    change(
      () => updateMerchant(data.id, { actionId: crypto.randomUUID(), isActive }),
      isActive ? "Cliente reactivado" : "Cliente desactivado",
    );

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link
        to="/clientes"
        className="-mb-3 flex w-fit items-center gap-1 text-label-l text-primary underline-offset-4 hover:underline"
      >
        <Icon symbol={ArrowBackIcon} size={20} />
        Clientes
      </Link>
      <PageHeader
        title={data.name}
        actions={
          <>
            <MerchantDialog merchant={data} />
            {data.isActive ? (
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                Desactivar cliente
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void setActive(true)}>
                Reactivar cliente
              </Button>
            )}
          </>
        }
      >
        {data.isActive ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="outline">Inactivo</Badge>
        )}
      </PageHeader>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-3 rounded-md border border-outline-variant bg-sheet p-6 text-body-l">
        <dt className="text-on-surface-variant">Alias</dt>
        <dd>{data.aliases.join(", ") || "—"}</dd>
        <dt className="text-on-surface-variant">WhatsApp</dt>
        <dd className="tabular-nums">{data.whatsappPhone ?? "—"}</dd>
        <dt className="text-on-surface-variant">Envíos abiertos</dt>
        <dd>{data.openShipments}</dd>
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-title-m text-on-surface">Puntos de recogida</h2>
          <PickupPointDialog merchantId={data.id} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Punto</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Barrio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.pickupPoints.map((point) => (
              <TableRow key={point.id}>
                <TableCell>{point.label}</TableCell>
                <TableCell>{point.address}</TableCell>
                <TableCell>{point.neighborhood.name}</TableCell>
                <TableCell className="flex gap-1">
                  {point.isDefault && <Badge variant="secondary">Predeterminado</Badge>}
                  {!point.isActive && <Badge variant="outline">Inactivo</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <PickupPointDialog merchantId={data.id} point={point} />
                    {point.isActive && !point.isDefault && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void change(
                            () =>
                              updatePickupPoint(point.id, {
                                actionId: crypto.randomUUID(),
                                isDefault: true,
                              }),
                            "Punto predeterminado actualizado",
                          )
                        }
                      >
                        Hacer predeterminado
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void change(
                          () =>
                            updatePickupPoint(point.id, {
                              actionId: crypto.randomUUID(),
                              isActive: !point.isActive,
                            }),
                          point.isActive ? "Punto desactivado" : "Punto reactivado",
                        )
                      }
                    >
                      {point.isActive ? "Desactivar" : "Reactivar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar a {data.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {data.openShipments > 0
                ? `Tiene ${plural(data.openShipments)}; seguirán su curso normal. `
                : ""}
              No se podrá elegir para envíos nuevos y seguirá en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                void setActive(false);
              }}
            >
              Desactivar cliente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
