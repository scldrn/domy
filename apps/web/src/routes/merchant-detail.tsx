import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
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
import BlockIcon from "@material-symbols/svg-400/rounded/block.svg?react";
import HistoryIcon from "@material-symbols/svg-400/rounded/history.svg?react";
import PinIcon from "@material-symbols/svg-400/rounded/location_on.svg?react";
import { Icon } from "@/components/icon";
import { ActiveMark } from "@/components/active-mark";
import { SummarySentence } from "@/components/summary-sentence";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getMerchant, updateMerchant, updatePickupPoint } from "@/features/master-data/api";
import { MerchantDialog } from "@/features/master-data/merchants/merchant-dialog";
import { MerchantLinkControls } from "@/features/master-data/merchants/merchant-link-controls";
import { PickupPointDialog } from "@/features/master-data/merchants/pickup-point-dialog";
import { DetailSheet } from "@/features/master-data/master-page";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_panel/clientes/$merchantId")({
  head: () => ({ meta: [{ title: "Cliente · Domy" }] }),
  component: MerchantDetailPage,
});

const plural = (count: number) =>
  count === 1 ? "1 envío abierto" : `${String(count)} envíos abiertos`;
const points = (count: number) =>
  count === 1 ? "1 punto de recogida" : `${String(count)} puntos de recogida`;
const panelRoute = getRouteApi("/_panel");

/**
 * A merchant with its aliases and pickup points (FR-026, FR-029), as approved in feature 006
 * (US5): the open shipments and points in one sentence, «Ver sus envíos», its data and pickup
 * points beside its link. The proposal's list of open shipments is reached through «Ver sus
 * envíos» instead, which shows them with every filter of «Historial».
 */
function MerchantDetailPage() {
  const { merchantId } = Route.useParams();
  const { user } = panelRoute.useRouteContext();
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
    <div className="flex flex-col gap-6">
      <Link
        to="/clientes"
        className="-mb-3 flex w-fit items-center gap-1 text-label-l font-semibold text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-current"
      >
        <Icon symbol={ArrowBackIcon} size={20} />
        Clientes
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <h1 className="text-headline-l text-on-surface">{data.name}</h1>
            <ActiveMark active={data.isActive} />
          </div>
          <SummarySentence
            parts={[
              { text: plural(data.openShipments), strong: true },
              {
                text: ` y ${points(data.pickupPoints.filter((point) => point.isActive).length)}.`,
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/historial"
            search={{ merchantId: data.id }}
            className={buttonVariants({ variant: "outline" })}
          >
            <Icon symbol={HistoryIcon} size={20} />
            Ver sus envíos
          </Link>
          <MerchantDialog merchant={data} />
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <DetailSheet id="cliente-datos" title="Datos">
            <dl className="text-body-l">
              {[
                ["WhatsApp", data.whatsappPhone ?? "Sin WhatsApp"],
                ["Alias para buscarlo", data.aliases.join(" · ") || "Sin alias"],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5",
                    index > 0 && "border-t border-outline-variant",
                  )}
                >
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="text-right font-semibold wrap-anywhere text-on-surface tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </DetailSheet>
          <DetailSheet
            id="cliente-puntos"
            title="Puntos de recogida"
            action={<PickupPointDialog merchantId={data.id} />}
          >
            {data.pickupPoints.length === 0 ? (
              <p className="text-body-m text-on-surface-variant">
                Agrega el lugar donde se recogen sus paquetes.
              </p>
            ) : (
              <ul aria-label="Puntos de recogida" className="flex flex-col">
                {data.pickupPoints.map((point, index) => (
                  <li
                    key={point.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 py-3",
                      index > 0 && "border-t border-outline-variant",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-secondary-container text-on-secondary-container">
                      <Icon symbol={PinIcon} size={20} />
                    </span>
                    <div className="flex min-w-0 flex-[1_1_12rem] flex-col">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-on-surface">
                        {point.label}
                        {point.isDefault && <Badge variant="secondary">Predeterminado</Badge>}
                        {!point.isActive && <ActiveMark active={false} />}
                      </span>
                      <span className="text-body-m text-on-surface-variant">
                        {point.address} · {point.neighborhood.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
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
                  </li>
                ))}
              </ul>
            )}
          </DetailSheet>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <MerchantLinkControls
            actorId={user.id}
            isActive={data.isActive}
            linkCode={data.linkCode}
            merchantId={data.id}
            merchantName={data.name}
            whatsappPhone={data.whatsappPhone}
          />
          {data.isActive ? (
            <Button
              variant="ghost"
              className="self-start text-error hover:text-error"
              onClick={() => {
                setConfirming(true);
              }}
            >
              <Icon symbol={BlockIcon} size={20} />
              Desactivar cliente
            </Button>
          ) : (
            <Button variant="outline" className="self-start" onClick={() => void setActive(true)}>
              Reactivar cliente
            </Button>
          )}
        </div>
      </div>

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
