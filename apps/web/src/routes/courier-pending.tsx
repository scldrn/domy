import { createFileRoute } from "@tanstack/react-router";
import CloudUploadIcon from "@material-symbols/svg-400/rounded/cloud_upload.svg?react";
import {
  courierRecordKindLabels,
  formatCop,
  formatTrackingNumber,
  photoKindLabels,
} from "@domy/domain";
import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { synchronizeNow, useCourierState } from "@/features/courier/courier-store";
import { formatDateTime } from "@/lib/format";
import type { StoredPhoto } from "@/lib/offline/db";

/** The records still to synchronize, oldest first (feature 003, US2, FR-020). */
export const Route = createFileRoute("/_courier/mensajero/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes · Domy" }] }),
  component: CourierPending,
});

function CourierPending() {
  const { user } = Route.useRouteContext();
  const { loaded, pending, photos, meta, syncing } = useCourierState();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-s text-on-surface">Pendientes por sincronizar</h1>
      {!loaded ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          {pending.length === 0 ? (
            <EmptyState
              className="[&_p]:text-body-l"
              icon={CloudUploadIcon}
              title="No tienes registros pendientes"
              description={
                photos.length > 0
                  ? "Solo quedan las fotos de abajo por enviar."
                  : "Tus registros y fotos están sincronizados."
              }
            />
          ) : (
            <ul
              aria-label="Registros pendientes"
              className="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant bg-sheet"
            >
              {pending.map((item, index) => {
                const record = item.type === "record" ? item.record : null;
                const occurredAt =
                  record?.occurredAt ?? (item.type === "acknowledgment" ? item.occurredAt : "");
                const key =
                  record?.id ?? (item.type === "acknowledgment" ? item.actionId : String(index));
                return (
                  <li
                    key={`${key}-${String(index)}`}
                    className="flex flex-col gap-1 p-4 text-body-l text-on-surface"
                  >
                    <span className="text-title-m">
                      {record ? courierRecordKindLabels[record.kind] : "Cambio de ruta leído"}
                      {item.type === "record" &&
                        item.trackingNumber &&
                        ` · Guía ${formatTrackingNumber(item.trackingNumber)}`}
                    </span>
                    <span className="text-on-surface-variant">
                      {formatDateTime(
                        new Date(Date.parse(occurredAt) + (meta?.clockOffsetMs ?? 0)),
                      )}
                    </span>
                    {record?.kind === "delivery" && (
                      <span>
                        Recaudo:{" "}
                        {formatCop(
                          record.cashAmount +
                            record.companyTransferAmount +
                            record.merchantTransferAmount,
                        )}
                        {record.receivedByName && ` · Recibió: ${record.receivedByName}`}
                      </span>
                    )}
                    {record?.kind === "disbursement" && (
                      <span>
                        {formatCop(record.amount)} · {record.payee}
                      </span>
                    )}
                    <span className="text-on-surface-variant">
                      Guardado en el teléfono; pendiente por sincronizar
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {photos.length > 0 && (
            <section aria-labelledby="fotos-pendientes">
              <h2 id="fotos-pendientes" className="mb-2 text-title-m text-on-surface">
                Fotos pendientes
              </h2>
              <ul
                aria-label="Fotos pendientes"
                className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-sheet"
              >
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="flex items-center gap-4 p-4 text-body-l text-on-surface"
                  >
                    <PhotoPreview photo={photo} />
                    <span>
                      {photoKindLabels[photo.kind]}
                      <span className="block text-on-surface-variant">
                        Guardada en el teléfono; pendiente por enviar
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {user && (
            <Button size="lg" disabled={syncing} onClick={() => void synchronizeNow(user.id)}>
              {syncing ? "Sincronizando…" : "Reintentar sincronización"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PhotoPreview({ photo }: { photo: StoredPhoto }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(photo.image);
    if (image.current) image.current.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo.image]);
  return (
    <img
      ref={image}
      alt={photoKindLabels[photo.kind]}
      width={80}
      height={80}
      className="size-20 rounded-sm object-cover"
    />
  );
}
