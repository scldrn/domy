import { useQuery } from "@tanstack/react-query";
import { formatTrackingNumber, shipmentStatusLabels } from "@domy/domain";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { publicMerchantPhotoUrl, publicMerchantShipmentQuery } from "@/features/public/api";
import { ApiError } from "@/lib/api-client";
import { formatCop, formatDate, formatDateTime, formatWindow } from "@/lib/format";

type MerchantShipmentDetailProps = {
  code: string;
  shipmentId: string;
  onBack: () => void;
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

export function MerchantShipmentDetail({ code, shipmentId, onBack }: MerchantShipmentDetailProps) {
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
    <section className="flex min-w-0 flex-col gap-5">
      <Button variant="outline" className="w-fit" onClick={onBack}>
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
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex min-w-0 flex-col gap-2">
            <p className="guia break-all text-label-l text-on-surface-variant">
              {formatTrackingNumber(shipment.trackingNumber)}
            </p>
            <h2 className="text-headline-m">{shipment.recipientName ?? "Detalle del envío"}</h2>
            <p className="text-title-m">{shipmentStatusLabels[shipment.status]}</p>
          </header>

          <dl className="grid min-w-0 gap-3 rounded-md border border-outline-variant bg-sheet p-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-body-m text-on-surface-variant">Estado desde</dt>
              <dd className="wrap-anywhere text-body-l">
                {shipment.statusAt ? formatDateTime(shipment.statusAt) : "Hora no disponible"}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-body-m text-on-surface-variant">Fecha programada</dt>
              <dd className="text-body-l">{formatDate(shipment.serviceDate)}</dd>
            </div>
            {shipment.receivedByName && (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-body-m text-on-surface-variant">Recibido por</dt>
                <dd className="wrap-anywhere text-body-l">{shipment.receivedByName}</dd>
              </div>
            )}
            {shipment.merchantReference && (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-body-m text-on-surface-variant">Referencia del cliente</dt>
                <dd className="wrap-anywhere text-body-l">{shipment.merchantReference}</dd>
              </div>
            )}
            {shipment.neighborhood && (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-body-m text-on-surface-variant">Barrio</dt>
                <dd className="wrap-anywhere text-body-l">{shipment.neighborhood}</dd>
              </div>
            )}
            {shipment.window && (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-body-m text-on-surface-variant">Franja de entrega</dt>
                <dd className="text-body-l">
                  {formatWindow(shipment.window.start, shipment.window.end)}
                </dd>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-body-m text-on-surface-variant">Tarifa</dt>
              <dd className="text-body-l">
                {shipment.feeToConfirm || shipment.fee === null
                  ? "Por confirmar"
                  : formatCop(shipment.fee)}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-body-m text-on-surface-variant">Valor a recaudar</dt>
              <dd className="text-body-l">{formatCop(shipment.codAmount)}</dd>
            </div>
          </dl>

          <section
            className="flex min-w-0 flex-col gap-3"
            aria-labelledby="merchant-collection-heading"
          >
            <h3 id="merchant-collection-heading" className="text-title-l">
              Recaudo recibido
            </h3>
            <dl className="grid min-w-0 gap-3 rounded-md border border-outline-variant bg-sheet p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-body-m text-on-surface-variant">Efectivo</dt>
                <dd className="text-body-l tabular-nums">{formatCop(shipment.collected.cash)}</dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-body-m text-on-surface-variant">Transferencia a la empresa</dt>
                <dd className="text-body-l tabular-nums">
                  {formatCop(shipment.collected.companyTransfer)}
                </dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <dt className="text-body-m text-on-surface-variant">Transferencia al cliente</dt>
                <dd className="text-body-l tabular-nums">
                  {formatCop(shipment.collected.merchantTransfer)}
                </dd>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3 border-t border-outline-variant pt-3">
                <dt className="text-title-m">Total recaudado</dt>
                <dd className="text-title-m tabular-nums">{formatCop(shipment.collected.total)}</dd>
              </div>
            </dl>
          </section>

          <section
            className="flex min-w-0 flex-col gap-3"
            aria-labelledby="merchant-photos-heading"
          >
            <h3 id="merchant-photos-heading" className="text-title-l">
              Prueba de entrega
            </h3>
            {shipment.photos.length === 0 ? (
              <p className="text-body-m text-on-surface-variant">No hay fotos de prueba.</p>
            ) : (
              <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
                {shipment.photos.map((photo) => {
                  const isUnavailable =
                    photo.status === "unavailable" || failedPhotoIds.has(photo.id);
                  return (
                    <li key={photo.id} className="min-w-0">
                      {photo.status === "pending" ? (
                        <p className="rounded-sm bg-warning-container p-4 text-body-m text-on-warning-container">
                          Foto pendiente
                        </p>
                      ) : isUnavailable ? (
                        <p className="rounded-sm bg-surface-container-low p-4 text-body-m text-on-surface-variant">
                          Foto no disponible
                        </p>
                      ) : (
                        <img
                          src={publicMerchantPhotoUrl(code, photo.id)}
                          alt="Prueba de entrega"
                          onError={() => {
                            markPhotoUnavailable(photo.id);
                          }}
                          className="h-auto max-h-96 w-full rounded-sm border border-outline-variant object-contain"
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
              className="flex min-w-0 flex-col gap-4"
              aria-labelledby="merchant-exception-heading"
            >
              <h3 id="merchant-exception-heading" className="text-title-l">
                Detalle de la novedad
              </h3>
              <div className="flex min-w-0 flex-col gap-3 rounded-md border border-error-container bg-error-container p-4 text-on-error-container">
                {shipment.exception.reason && (
                  <p className="text-body-l">{shipment.exception.reason}</p>
                )}
                {shipment.exception.note && (
                  <p className="text-body-m">{shipment.exception.note}</p>
                )}
              </div>
              {shipment.exception.attempts.length > 0 && (
                <div className="flex min-w-0 flex-col gap-3">
                  <h4 className="text-title-m">Intentos registrados</h4>
                  <ul className="flex min-w-0 flex-col gap-3">
                    {shipment.exception.attempts.map((attempt, index) => (
                      <li
                        key={`${attempt.kind}-${attempt.occurredAt}-${String(index)}`}
                        className="flex min-w-0 flex-col gap-2 rounded-md border border-outline-variant bg-sheet p-4"
                      >
                        <p className="text-title-m">
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
        </div>
      ) : null}
    </section>
  );
}
