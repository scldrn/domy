import {
  formatCop,
  resolveCodAmount,
  serviceLevelLabels,
  shipmentKindLabels,
  type DeliveryWindow,
} from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { formatLongDate, formatWindow } from "@/lib/format";
import { listPickupPoints } from "./api";
import type { ShipmentFormValues } from "./form-values";

/** A field the dispatcher changed while editing: its name, what it was, what it is now. */
export type FormChange = { label: string; from: string; to: string };

function pickupOf(values: ShipmentFormValues, points: { id: string; label: string }[]): string {
  if (!values.merchant) return "Sin elegir";
  if (values.pickupPointId === null) return values.pickupAddress || "Otra dirección";
  return points.find((point) => point.id === values.pickupPointId)?.label ?? "Sin elegir";
}

function destinationOf(values: ShipmentFormValues, carrier: string | null): [string, string] {
  if (values.kind === "errand") return ["Diligencia", values.errandDescription || "Sin describir"];
  if (values.kind === "carrier_handoff")
    return ["Lleva a", carrier ?? values.handoffPlace?.name ?? "Sin transportadora"];
  const who = values.recipientName || "Sin nombre";
  const place = values.recipientNeighborhood?.name;
  return [
    values.kind === "reverse_pickup" ? "Recoge a" : "Entrega a",
    place ? `${who}, ${place}` : who,
  ];
}

/**
 * What the dispatcher is about to register, or what they changed (feature 006, approved
 * "Nuevo envío" and "Editar envío"): the shipment in a few lines, its fee and COD amount, and
 * what the courier collects, which the payment mode decides (`resolveCodAmount`, FR-009).
 */
export function ShipmentSummary({
  values,
  window,
  today,
  carrier,
  changes,
}: {
  values: ShipmentFormValues;
  window: DeliveryWindow | null;
  today: string;
  carrier: string | null;
  /** Only while editing. */
  changes?: FormChange[];
}) {
  const points = useQuery({
    queryKey: ["pickup-points", values.merchant?.id],
    queryFn: () => listPickupPoints(values.merchant?.id ?? ""),
    enabled: Boolean(values.merchant) && !changes,
  });
  const fee = values.fee ?? 0;
  const cod = values.paymentMode === "cash_on_delivery" ? (values.codAmount ?? 0) : 0;
  const collects = resolveCodAmount(values.paymentMode, fee, values.codAmount ?? 0);
  const [toLabel, to] = destinationOf(values, carrier);
  const windowText =
    formatWindow(
      window?.windowStart?.toISOString() ?? null,
      window?.windowEnd?.toISOString() ?? null,
    ) ?? "Sin franja";
  const date = values.serviceDate
    ? values.serviceDate === today
      ? `Hoy, ${formatLongDate(values.serviceDate, today).toLowerCase()}`
      : formatLongDate(values.serviceDate, today)
    : "Sin fecha";
  return (
    <section
      aria-labelledby="resumen-envio"
      className="rounded-lg border border-outline-variant bg-sheet px-5 py-4"
    >
      <h2 id="resumen-envio" className="text-title-l text-on-surface">
        {changes ? "Cambios" : "Resumen"}
      </h2>
      {changes ? (
        changes.length === 0 ? (
          <p className="mt-2 text-body-m text-on-surface-variant">
            Todavía no cambias nada. Lo que cambies queda en el historial del envío con tu nombre.
          </p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-2 text-body-m">
            {changes.map((change) => (
              <li key={change.label} className="grid gap-0.5">
                <span className="font-semibold text-on-surface">{change.label}</span>
                <span className="text-on-surface-variant line-through decoration-1">
                  {change.from}
                </span>
                <span className="text-on-surface">{change.to}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <dl className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-body-m">
          <dt className="text-on-surface-variant">Tipo</dt>
          <dd className="font-medium break-words text-on-surface">
            {shipmentKindLabels[values.kind]}
            {values.serviceLevel === "express" && ` · ${serviceLevelLabels.express}`}
          </dd>
          <dt className="text-on-surface-variant">Cliente</dt>
          <dd className="font-medium break-words text-on-surface">
            {values.merchant?.name ?? "Sin elegir"}
          </dd>
          <dt className="text-on-surface-variant">Recoge en</dt>
          <dd className="font-medium break-words text-on-surface">
            {pickupOf(values, points.data ?? [])}
          </dd>
          <dt className="text-on-surface-variant">{toLabel}</dt>
          <dd className="font-medium break-words text-on-surface">{to}</dd>
          <dt className="text-on-surface-variant">Fecha</dt>
          <dd className="font-medium break-words text-on-surface">{date}</dd>
          <dt className="text-on-surface-variant">Franja</dt>
          <dd className="font-medium break-words text-on-surface">{windowText}</dd>
        </dl>
      )}
      <dl className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t border-outline-variant pt-3.5 text-body-m">
        <dt className="text-on-surface-variant">Tarifa</dt>
        <dd className="text-right font-semibold tabular-nums">{fee ? formatCop(fee) : "—"}</dd>
        <dt className="text-on-surface-variant">Valor a recaudar</dt>
        <dd className="text-right font-semibold tabular-nums">{cod ? formatCop(cod) : "—"}</dd>
        <dt className="text-body-l font-bold text-on-surface">El mensajero cobra</dt>
        <dd className="text-right text-body-l font-bold tabular-nums">{formatCop(collects)}</dd>
      </dl>
    </section>
  );
}

/** "El mensajero cobra" alone, for the phone's sticky bar. */
export function collectsOf(values: ShipmentFormValues): number {
  return resolveCodAmount(values.paymentMode, values.fee ?? 0, values.codAmount ?? 0);
}
