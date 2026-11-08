import { createFileRoute } from "@tanstack/react-router";
import CheckIcon from "@material-symbols/svg-400/rounded/check.svg?react";
import DoneAllIcon from "@material-symbols/svg-400/rounded/done_all.svg?react";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import InventoryIcon from "@material-symbols/svg-400/rounded/inventory_2.svg?react";
import PaymentsIcon from "@material-symbols/svg-400/rounded/payments.svg?react";
import SyncIcon from "@material-symbols/svg-400/rounded/sync.svg?react";
import TaskAltIcon from "@material-symbols/svg-400/rounded/task_alt.svg?react";
import UndoIcon from "@material-symbols/svg-400/rounded/undo.svg?react";
import WarningIcon from "@material-symbols/svg-400/rounded/warning.svg?react";
import {
  bogotaToday,
  courierRecordKindLabels,
  formatCop,
  formatTrackingNumber,
  photoKindLabels,
  type CourierRecordKind,
} from "@domy/domain";
import { useEffect, useRef, type ComponentProps } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { synchronizeNow, useCourierState } from "@/features/courier/courier-store";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTime } from "@/lib/format";
import type { OutboxItem, StoredPhoto } from "@/lib/offline/db";

/**
 * The records still to synchronize, oldest first (feature 003, US2, FR-020), as approved in
 * feature 006: records and photos as lists with their time and guía, «Reintentar
 * sincronización» in lime while anything waits, and the last send once everything is sent.
 */
export const Route = createFileRoute("/_courier/mensajero/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes · Domy" }] }),
  component: CourierPending,
});

type IconSymbol = ComponentProps<typeof Icon>["symbol"];

/** Only a delivery and an exception carry a state color; the rest stay neutral (FR-015). */
const recordIcons: Record<CourierRecordKind, [IconSymbol, string?]> = {
  pickup: [InventoryIcon],
  delivery: [CheckIcon, "bg-success-container text-on-success-container"],
  exception: [ErrorIcon, "bg-error-container text-on-error-container"],
  problem: [WarningIcon],
  return: [UndoIcon],
  disbursement: [PaymentsIcon],
  handover_confirmation: [InventoryIcon],
};

function CourierPending() {
  const { user } = Route.useRouteContext();
  const { loaded, pending, photos, meta, syncing } = useCourierState();
  const waiting = pending.length + photos.length > 0;
  const trackingOf = (recordId: string) => {
    for (const item of pending)
      if (item.type === "record" && item.record.id === recordId) return item.trackingNumber;
    return undefined;
  };
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-headline-m text-on-surface">Pendientes</h1>
        {loaded && waiting && (
          <p className="text-body-l text-on-surface-variant">
            Lo que registraste y aún no llega a despacho. Sale en este orden,{" "}
            <strong className="font-[650] text-on-surface">del más antiguo al más reciente</strong>.
          </p>
        )}
        {loaded && !waiting && meta?.lastSyncedAt && (
          <p className="text-body-l text-on-surface-variant">
            Último envío a despacho: {when(meta.lastSyncedAt)}
          </p>
        )}
      </header>
      {!loaded ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-outline-variant bg-sheet px-5 py-7 text-center">
              <span className="mb-1.5 flex size-14 items-center justify-center rounded-full bg-success-container text-on-success-container">
                <Icon symbol={TaskAltIcon} className="size-8" />
              </span>
              <p className="text-title-l text-on-surface">No tienes registros pendientes</p>
              <p className="text-body-l text-on-surface-variant">
                {photos.length > 0
                  ? "Solo quedan las fotos de abajo por enviar."
                  : "Tus registros y fotos están sincronizados."}
              </p>
            </div>
          ) : (
            <section aria-labelledby="registros-pendientes" className="flex flex-col gap-2.5">
              <h2
                id="registros-pendientes"
                className="flex items-baseline gap-2 text-title-l text-on-surface"
              >
                Registros{" "}
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {pending.length}
                </span>
              </h2>
              <ol
                aria-label="Registros pendientes"
                className="overflow-hidden rounded-lg border border-outline-variant bg-sheet"
              >
                {pending.map((item, index) => (
                  <PendingRow
                    key={`${item.type === "record" ? item.record.id : item.actionId}-${String(index)}`}
                    item={item}
                    clockOffsetMs={meta?.clockOffsetMs ?? 0}
                  />
                ))}
              </ol>
            </section>
          )}
          {photos.length > 0 && (
            <section aria-labelledby="fotos-pendientes" className="flex flex-col gap-2.5">
              <h2
                id="fotos-pendientes"
                className="flex items-baseline gap-2 text-title-l text-on-surface"
              >
                Fotos{" "}
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {photos.length}
                </span>
              </h2>
              <ul
                aria-label="Fotos pendientes"
                className="overflow-hidden rounded-lg border border-outline-variant bg-sheet"
              >
                {photos.map((photo) => {
                  const tracking = trackingOf(photo.recordId);
                  return (
                    <li
                      key={photo.id}
                      className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border-t border-outline-variant p-3.5 first:border-t-0"
                    >
                      <PhotoPreview photo={photo} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-title-m text-on-surface">
                          {photoKindLabels[photo.kind]}
                        </span>
                        {tracking && (
                          <span className="text-body-m text-on-surface-variant">
                            Guía{" "}
                            <span className="guia whitespace-nowrap">
                              {formatTrackingNumber(tracking)}
                            </span>
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {user && (
            <Button
              size="lg"
              variant={waiting ? "accent" : "outline"}
              disabled={syncing}
              onClick={() => void synchronizeNow(user.id)}
            >
              <Icon symbol={SyncIcon} />
              {syncing ? "Sincronizando…" : "Reintentar sincronización"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PendingRow({ item, clockOffsetMs }: { item: OutboxItem; clockOffsetMs: number }) {
  const record = item.type === "record" ? item.record : null;
  const [symbol, tone] = record ? recordIcons[record.kind] : [DoneAllIcon];
  const occurredAt = record?.occurredAt ?? (item.type === "acknowledgment" ? item.occurredAt : "");
  const detail =
    record?.kind === "delivery"
      ? [
          `Recaudo ${formatCop(record.cashAmount + record.companyTransferAmount + record.merchantTransferAmount)}`,
          record.receivedByName && `Recibió: ${record.receivedByName}`,
        ]
      : record?.kind === "disbursement"
        ? [formatCop(record.amount), record.payee]
        : [];
  const shown = detail.filter(Boolean).join(" · ");
  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-outline-variant p-3.5 first:border-t-0">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-md",
          tone ?? "bg-secondary-container text-on-secondary-container",
        )}
      >
        <Icon symbol={symbol} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-title-m text-on-surface">
          {record ? courierRecordKindLabels[record.kind] : "Cambio de ruta leído"}
          {item.type === "record" && item.trackingNumber && (
            <>
              {" · "}
              <span className="guia whitespace-nowrap">
                {formatTrackingNumber(item.trackingNumber)}
              </span>
            </>
          )}
        </span>
        {shown && <span className="text-body-m text-on-surface-variant">{shown}</span>}
      </span>
      {occurredAt && (
        <time
          dateTime={occurredAt}
          className="self-start text-body-m whitespace-nowrap text-on-surface-variant"
        >
          {when(new Date(Date.parse(occurredAt) + clockOffsetMs), false)}
        </time>
      )}
    </li>
  );
}

/** Today's times alone ("hoy, " when asked), other days with their date. */
function when(value: Date | string, today = true): string {
  const date = new Date(value);
  if (bogotaToday(date) !== bogotaToday(now())) return formatDateTime(date);
  return today ? `hoy, ${formatTime(date)}` : formatTime(date);
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
      width={48}
      height={48}
      className="size-12 rounded-md object-cover"
    />
  );
}
