import ArrowBackIcon from "@material-symbols/svg-400/rounded/arrow_back.svg?react";
import CloseIcon from "@material-symbols/svg-400/rounded/close.svg?react";
import OpenInNewIcon from "@material-symbols/svg-400/rounded/open_in_new.svg?react";
import { useQuery } from "@tanstack/react-query";
import { bogotaToday, formatTrackingNumber } from "@domy/domain";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Button } from "@/components/ui/button";
import { publicMerchantPhotoUrl, publicMerchantShipmentQuery } from "@/features/public/api";
import { contactLink } from "@/features/public/public-layout";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatDateTime, formatTime, formatWindow } from "@/lib/format";

type MerchantShipmentDetailProps = {
  code: string;
  shipmentId: string;
  onBack: () => void;
  className?: string;
};

type FailedPhotoState = { shipmentId: string; ids: ReadonlySet<string> };

function errorText(error: Error): string {
  if (error instanceof ApiError && error.status === 404) return "Este enlace no es válido";
  if (error instanceof ApiError && error.status === 429) return error.message;
  if (error instanceof ApiError && error.status === 0) return error.message;
  return "No pudimos cargar el detalle del envío. Intenta de nuevo.";
}

function AttemptKind({ kind }: { kind: "delivery" | "exception" }) {
  return <>{kind === "delivery" ? "Entrega" : "Novedad"}</>;
}

/** Since when, today's by its time alone. */
function since(instant: string): string {
  return bogotaToday(new Date(instant)) === bogotaToday(now())
    ? `desde las ${formatTime(instant)}`
    : `desde el ${formatDateTime(instant)}`;
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-outline-variant py-3 first:border-t-0">
      <dt className="text-body-m text-on-surface-variant">{term}</dt>
      <dd className="min-w-0 text-right text-body-l font-[650] wrap-anywhere">{children}</dd>
    </div>
  );
}

/**
 * One shipment of the merchant's day, as approved in feature 006 (US4): beside the list on
 * desktop, its own page on phones; the status and when, the facts, the money collected, the
 * proof, and any exception with its attempts.
 */
export function MerchantShipmentDetail({
  code,
  shipmentId,
  onBack,
  className,
}: MerchantShipmentDetailProps) {
  const query = useQuery({
    ...publicMerchantShipmentQuery(code, shipmentId),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const [failedPhotoState, setFailedPhotoState] = useState<FailedPhotoState | null>(null);
  const shipment = query.isError ? undefined : query.data;
  const failedPhotoIds =
    failedPhotoState?.shipmentId === shipmentId ? failedPhotoState.ids : new Set<string>();

  function markPhotoUnavailable(photoId: string) {
    setFailedPhotoState((current) => {
      const ids = current?.shipmentId === shipmentId ? new Set(current.ids) : new Set<string>();
      ids.add(photoId);
      return { shipmentId, ids };
    });
  }

  return (
    <section
      aria-label="Detalle del envío"
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border border-outline-variant bg-sheet p-4.5",
        className,
      )}
    >
      {/* One «Volver a los envíos» at a time: a back link on phones, a close button beside
          the list on desktop. */}
      <Button variant="ghost" className="-ml-2 w-fit lg:hidden" onClick={onBack}>
        <Icon symbol={ArrowBackIcon} />
        Volver a los envíos
      </Button>

      {query.isPending ? (
        <p className="text-body-l text-on-surface-variant" role="status" aria-live="polite">
          Cargando el detalle del envío…
        </p>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <h2 className="text-title-l">{errorText(query.error)}</h2>
          {query.error instanceof ApiError && query.error.status === 404 ? (
            <p className="text-body-m text-on-surface-variant">
              Vuelve a los envíos del cliente para consultar un enlace vigente.
            </p>
          ) : (
            <Button variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          )}
        </div>
      ) : shipment ? (
        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex min-w-0 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <p className="guia text-label-l text-on-surface-variant">
                  {formatTrackingNumber(shipment.trackingNumber)}
                </p>
                <h2 className="text-headline-s wrap-anywhere">
                  {shipment.recipientName ?? "Detalle del envío"}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Volver a los envíos"
                className="-mt-1 -mr-2 hidden lg:inline-flex"
                onClick={onBack}
              >
                <Icon symbol={CloseIcon} />
              </Button>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-body-m text-on-surface-variant">
              <ShipmentStatusMark status={shipment.status} />
              {shipment.statusAt ? since(shipment.statusAt) : "Hora no disponible"}
            </p>
          </header>

          <dl className="border-y border-outline-variant">
            {shipment.receivedByName && <Fact term="Recibido por">{shipment.receivedByName}</Fact>}
            <Fact term="Fecha programada">{formatDate(shipment.serviceDate)}</Fact>
            {shipment.neighborhood && <Fact term="Barrio">{shipment.neighborhood}</Fact>}
            {shipment.window && (
              <Fact term="Franja de entrega">
                {formatWindow(shipment.window.start, shipment.window.end)}
              </Fact>
            )}
            {shipment.merchantReference && (
              <Fact term="Referencia del cliente">{shipment.merchantReference}</Fact>
            )}
            <Fact term="Tarifa">
              {shipment.feeToConfirm || shipment.fee === null
                ? "Por confirmar"
                : formatCop(shipment.fee)}
            </Fact>
            <Fact term="Valor a recaudar">{formatCop(shipment.codAmount)}</Fact>
          </dl>

          <section
            className="flex min-w-0 flex-col gap-1"
            aria-labelledby="merchant-collection-heading"
          >
            <h3 id="merchant-collection-heading" className="text-title-m">
              Recaudo recibido
            </h3>
            <dl className="flex flex-col text-body-m">
              {(
                [
                  ["Efectivo", shipment.collected.cash],
                  ["Transferencia a la empresa", shipment.collected.companyTransfer],
                  ["Transferencia al cliente", shipment.collected.merchantTransfer],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="font-[650] tabular-nums">{formatCop(amount)}</dd>
                </div>
              ))}
              <div className="mt-1 flex justify-between gap-3 border-t border-outline-variant pt-2.5">
                <dt className="text-title-s">Total recaudado</dt>
                <dd className="text-title-s tabular-nums">{formatCop(shipment.collected.total)}</dd>
              </div>
            </dl>
          </section>

          <section
            className="flex min-w-0 flex-col gap-2.5"
            aria-labelledby="merchant-photos-heading"
          >
            <h3 id="merchant-photos-heading" className="text-title-m">
              Prueba de entrega
            </h3>
            {shipment.photos.length === 0 ? (
              <p className="text-body-m text-on-surface-variant">No hay fotos de prueba.</p>
            ) : (
              <ul className="grid min-w-0 gap-2.5">
                {shipment.photos.map((photo) => {
                  const isUnavailable =
                    photo.status === "unavailable" || failedPhotoIds.has(photo.id);
                  return (
                    <li key={photo.id} className="min-w-0">
                      {photo.status === "pending" ? (
                        <p className="rounded-md bg-warning-container p-4 text-body-m text-on-warning-container">
                          Foto pendiente
                        </p>
                      ) : isUnavailable ? (
                        <p className="rounded-md bg-sheet-alt p-4 text-body-m text-on-surface-variant">
                          Foto no disponible
                        </p>
                      ) : (
                        <img
                          src={publicMerchantPhotoUrl(code, photo.id)}
                          alt="Prueba de entrega"
                          onError={() => {
                            markPhotoUnavailable(photo.id);
                          }}
                          className="h-auto max-h-96 w-full rounded-md border border-outline-variant object-contain"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {shipment.exception && (
            <section
              className="flex min-w-0 flex-col gap-3"
              aria-labelledby="merchant-exception-heading"
            >
              <h3 id="merchant-exception-heading" className="text-title-m">
                Detalle de la novedad
              </h3>
              {(shipment.exception.reason ?? shipment.exception.note) && (
                <div className="flex min-w-0 flex-col gap-2 rounded-md bg-error-container p-3.5 text-on-error-container">
                  {shipment.exception.reason && (
                    <p className="text-title-s">{shipment.exception.reason}</p>
                  )}
                  {shipment.exception.note && (
                    <p className="text-body-m">{shipment.exception.note}</p>
                  )}
                </div>
              )}
              {shipment.exception.attempts.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2">
                  <h4 className="text-title-s">Intentos registrados</h4>
                  <ul className="flex min-w-0 flex-col gap-2">
                    {shipment.exception.attempts.map((attempt, index) => (
                      <li
                        key={`${attempt.kind}-${attempt.occurredAt}-${String(index)}`}
                        className="flex min-w-0 flex-col gap-0.5 rounded-md border border-outline-variant px-3.5 py-3"
                      >
                        <p className="text-title-s">
                          <AttemptKind kind={attempt.kind} />
                        </p>
                        <p className="text-body-m text-on-surface-variant">
                          {formatDateTime(attempt.occurredAt)}
                        </p>
                        {attempt.reason && <p className="text-body-m">{attempt.reason}</p>}
                        {attempt.note && <p className="text-body-m">{attempt.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <a href={shipment.trackingLink} className={contactLink}>
            <Icon symbol={OpenInNewIcon} size={20} />
            Abrir seguimiento
          </a>
        </div>
      ) : null}
    </section>
  );
}
