import {
  courierRecordKindLabels,
  exceptionReasonLabels,
  formatCop,
  paymentMethodLabels,
  photoKindLabels,
  type CourierRecord,
  type ShipmentDetail,
} from "@domy/domain";
import { useState } from "react";
import { OnBehalfMark } from "@/components/on-behalf-mark";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { RecordActions } from "./correct-record-dialog";
import { DetailCard } from "@/components/detail-card";

/** A record received more than a minute after it happened shows both times (FR-039). */
const lateMs = 60_000;

/**
 * The courier's records of a shipment (feature 003, FR-036, FR-039): proof of delivery with
 * its photos, the collection by payment method, disbursements, exceptions, and the records
 * that could not be applied, as cards of the approved "Detalle de envío" (feature 006).
 */
export function ShipmentRecords({
  records,
  attempts = [],
  shipment,
}: {
  records: CourierRecord[];
  attempts?: CourierRecord[];
  shipment?: ShipmentDetail;
}) {
  return (
    <>
      {attempts.length > 0 && (
        <DetailCard title="Intentos de entrega">
          <ol className="flex flex-col gap-2 text-body-m">
            {attempts.map((attempt, index) => (
              <li key={attempt.id} className="text-on-surface">
                <span className="font-semibold">
                  Intento {index + 1}:{" "}
                  {attempt.kind === "delivery"
                    ? "Entregado"
                    : attempt.exceptionReason
                      ? exceptionReasonLabels[attempt.exceptionReason]
                      : "Novedad"}
                </span>
                <span className="block text-on-surface-variant">
                  {attempt.courier.name} · {formatDateTime(attempt.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        </DetailCard>
      )}
      <DetailCard title="Registros del mensajero" count={records.length}>
        {records.length === 0 ? (
          <p className="text-body-m text-on-surface-variant">
            Todavía no hay registros del mensajero. Aparecen aquí cuando recoge, entrega o reporta
            una novedad.
          </p>
        ) : (
          <ol className="flex flex-col">
            {records.toReversed().map((record) => (
              <RecordItem key={record.id} record={record} shipment={shipment} />
            ))}
          </ol>
        )}
      </DetailCard>
    </>
  );
}

function RecordItem({
  record,
  shipment,
}: {
  record: CourierRecord;
  shipment: ShipmentDetail | undefined;
}) {
  const amounts = [
    [paymentMethodLabels.cash, record.cashAmount],
    [paymentMethodLabels.companyTransfer, record.companyTransferAmount],
    [paymentMethodLabels.merchantTransfer, record.merchantTransferAmount],
  ] as const;
  const collected = amounts.filter(([, amount]) => amount > 0);
  const late = Date.parse(record.recordedAt) - Date.parse(record.occurredAt) > lateMs;
  return (
    <li className="flex flex-col gap-2.5 border-t border-outline-variant py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex flex-wrap items-center gap-2 text-title-m text-on-surface">
          {courierRecordKindLabels[record.kind]}
          {record.outcome === "not_applied" && <Badge variant="warning">No aplicado</Badge>}
          {record.reverted && <Badge variant="outline">Revertido</Badge>}
          {record.onBehalf && <OnBehalfMark />}
        </p>
        <p className="text-body-m text-on-surface-variant">
          {record.courier.name} · {formatDateTime(record.occurredAt)}
          {late && ` · recibido ${formatDateTime(record.recordedAt)}`}
          {record.onBehalf && ` · registró ${record.author.name}`}
        </p>
      </div>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-m text-on-surface">
        {record.receivedByName && <Line label="Recibió">{record.receivedByName}</Line>}
        {record.exceptionReason && (
          <Line label="Motivo">{exceptionReasonLabels[record.exceptionReason]}</Line>
        )}
        {collected.map(([label, amount]) => (
          <Line key={label} label={label}>
            <span className="tabular-nums">{formatCop(amount)}</span>
          </Line>
        ))}
        {record.disbursementAmount !== null && (
          <Line label="Pago">
            <span className="tabular-nums">{formatCop(record.disbursementAmount)}</span>
            {record.payee && ` a ${record.payee}`}
          </Line>
        )}
        {record.note && <Line label="Nota">{record.note}</Line>}
        {record.location && (
          <Line label="Ubicación">
            <a
              className="text-primary underline underline-offset-4"
              href={`https://www.google.com/maps/search/?api=1&query=${String(record.location.latitude)},${String(record.location.longitude)}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en el mapa
            </a>
            <span className="text-body-m text-on-surface-variant">
              {" "}
              (± {record.location.accuracyM} m)
            </span>
          </Line>
        )}
        {record.reverted && (
          <Line label="Revertido">
            {record.reverted.by.name}: {record.reverted.reason}
          </Line>
        )}
      </dl>
      {record.photos.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Fotos">
          {record.photos.map((photo) => (
            <li key={photo.id}>
              <Photo id={photo.id} label={photoKindLabels[photo.kind]} uploaded={photo.uploaded} />
            </li>
          ))}
        </ul>
      )}
      {shipment && <RecordActions shipment={shipment} record={record} />}
    </li>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}

/** A photo from the private bucket, or why it cannot be shown (FR-023, FR-036). */
function Photo({ id, label, uploaded }: { id: string; label: string; uploaded: boolean }) {
  const [gone, setGone] = useState(false);
  const placeholder = (text: string) => (
    <figure className="flex h-24 w-33 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-outline bg-sheet-alt p-2 text-center">
      <figcaption className="text-body-s text-on-surface-variant">
        {label}
        <br />
        {text}
      </figcaption>
    </figure>
  );
  if (!uploaded) return placeholder("Foto pendiente");
  if (gone) return placeholder("Esta foto ya no está disponible");
  return (
    <figure className="flex flex-col gap-1">
      <a href={`/api/photos/${id}`} target="_blank" rel="noreferrer">
        <img
          src={`/api/photos/${id}`}
          alt={label}
          loading="lazy"
          className="h-24 w-33 rounded-md border border-outline-variant object-cover"
          onError={() => {
            setGone(true);
          }}
        />
      </a>
      <figcaption className="text-body-s text-on-surface-variant">{label}</figcaption>
    </figure>
  );
}
