import { formatTrackingNumber, isEditable } from "@domy/domain";
import BackIcon from "@material-symbols/svg-400/rounded/chevron_left.svg?react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getShipmentByTrackingNumber } from "@/features/shipments/api";
import { ShipmentForm } from "@/features/shipments/shipment-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { TrackingNumber } from "@/components/tracking-number";
import { formatDateTime } from "@/lib/format";

const shipmentQuery = (trackingNumber: string) => ({
  queryKey: ["shipment", trackingNumber],
  queryFn: () => getShipmentByTrackingNumber(trackingNumber),
});

export const Route = createFileRoute("/_panel/envios/$trackingNumber/editar")({
  loader: ({ context, params }) => context.queryClient.query(shipmentQuery(params.trackingNumber)),
  head: ({ params }) => ({
    meta: [{ title: `Editar ${formatTrackingNumber(params.trackingNumber)} · Domy` }],
  }),
  errorComponent: ({ error }) => (
    <p className="text-body-l text-error">
      {error instanceof Error ? error.message : "No pudimos cargar el envío."}
    </p>
  ),
  component: ShipmentEditPage,
});

/** "Editar envío" as the owner approved it (feature 006): who registered it, then the form. */
function ShipmentEditPage() {
  const { trackingNumber } = Route.useParams();
  const { data: shipment } = useSuspenseQuery(shipmentQuery(trackingNumber));
  const creator = shipment.events.find((event) => event.type === "created")?.actor.name;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          to="/envios/$trackingNumber"
          params={{ trackingNumber }}
          className="flex w-fit items-center gap-1 rounded-xs text-label-l text-on-surface-variant underline-offset-4 hover:underline"
        >
          <Icon symbol={BackIcon} size={20} />
          Volver al envío
        </Link>
        <PageHeader
          title={
            <>
              Editar envío <TrackingNumber value={shipment.trackingNumber} />
            </>
          }
          sentence={
            <p className="max-w-[72ch] text-pretty">
              Registrado el{" "}
              <strong className="font-semibold text-on-surface">
                {formatDateTime(shipment.registeredAt)}
              </strong>
              {creator && ` por ${creator}`}. Lo que cambies queda en el historial del envío con tu
              nombre.
            </p>
          }
        >
          <ShipmentStatusMark status={shipment.status} />
        </PageHeader>
      </div>
      {isEditable(shipment.status) ? (
        <ShipmentForm key={`${shipment.id}:${String(shipment.version)}`} shipment={shipment} />
      ) : (
        <p className="text-body-l text-on-surface-variant">
          Este envío ya fue recogido o está anulado; no se puede editar.{" "}
          <Link to="/envios/$trackingNumber" params={{ trackingNumber }} className="text-primary">
            Ver el envío
          </Link>
        </p>
      )}
    </div>
  );
}
