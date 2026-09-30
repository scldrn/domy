import { formatTrackingNumber, isEditable } from "@domy/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getShipmentByTrackingNumber } from "@/features/shipments/api";
import { ShipmentForm } from "@/features/shipments/shipment-form";

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

function ShipmentEditPage() {
  const { trackingNumber } = Route.useParams();
  const { data: shipment } = useSuspenseQuery(shipmentQuery(trackingNumber));
  const title = `Editar envío ${formatTrackingNumber(shipment.trackingNumber)}`;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-s text-on-surface">{title}</h1>
      {isEditable(shipment.status) ? (
        <ShipmentForm key={shipment.version} shipment={shipment} />
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
