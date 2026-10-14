import {
  courierRecordKindLabels,
  exceptionReasonLabels,
  formatCop,
  paymentMethodLabels,
  photoKindLabels,
  type CourierRecord,
} from "@domy/domain";
import { useId, useState } from "react";
import { OnBehalfMark } from "@/components/on-behalf-mark";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

/** A record received more than a minute after it happened shows both times (FR-039). */
const lateMs = 60_000;

/**
 * The courier's records of a shipment (feature 003, FR-036, FR-039): proof of delivery with
 * its photos, the collection by payment method, disbursements, exceptions, and the records
 * that could not be applied.
 */
export function ShipmentRecords({ records }: { records: CourierRecord[] }) {
  const headingId = useId();
  if (records.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-title-m text-on-surface">
        Registros del mensajero
      </h2>
      <ol className="flex flex-col gap-3">
        {records.map((record) => (
          <RecordItem key={record.id} record={record} />
        ))}
      </ol>
    </section>
  );
}

function RecordItem({ record }: { record: CourierRecord }) {
  const amounts = [
    [paymentMethodLabels.cash, record.cashAmount],
    [paymentMethodLabels.companyTransfer, record.companyTransferAmount],
    [paymentMethodLabels.merchantTransfer, record.merchantTransferAmount],
  ] as const;
  const collected = amounts.filter(([, amount]) => amount > 0);
  const late = Date.parse(record.recordedAt) - Date.parse(record.occurredAt) > lateMs;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-outline-variant bg-sheet p-4">
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
      <dl className="flex flex-col gap-1 text-body-l text-on-surface">
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
    </li>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4">
      <dt className="text-body-m text-on-surface-variant">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A photo from the private bucket, or why it cannot be shown (FR-023, FR-036). */
function Photo({ id, label, uploaded }: { id: string; label: string; uploaded: boolean }) {
  const [gone, setGone] = useState(false);
  const placeholder = (text: string) => (
    <figure className="flex size-32 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-outline p-2 text-center">
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
          className="size-32 rounded-sm border border-outline-variant object-cover"
          onError={() => {
            setGone(true);
          }}
        />
      </a>
      <figcaption className="text-body-s text-on-surface-variant">{label}</figcaption>
    </figure>
  );
}
