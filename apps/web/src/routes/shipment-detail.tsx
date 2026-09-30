import { formatTrackingNumber } from "@domy/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getShipmentByTrackingNumber } from "@/features/shipments/api";
import { ShipmentDetail } from "@/features/shipments/shipment-detail";

const shipmentQuery = (trackingNumber: string) => ({
  queryKey: ["shipment", trackingNumber],
  queryFn: () => getShipmentByTrackingNumber(trackingNumber),
});

export const Route = createFileRoute("/_panel/envios/$trackingNumber")({
  loader: ({ context, params }) => context.queryClient.query(shipmentQuery(params.trackingNumber)),
  head: ({ params }) => ({
    meta: [{ title: `${formatTrackingNumber(params.trackingNumber)} · Domy` }],
  }),
  errorComponent: ({ error }) => (
    <p className="text-body-l text-error">
      {error instanceof Error ? error.message : "No pudimos cargar el envío."}
    </p>
  ),
  component: ShipmentDetailPage,
});

function ShipmentDetailPage() {
  const { trackingNumber } = Route.useParams();
  const { data } = useSuspenseQuery(shipmentQuery(trackingNumber));
  return <ShipmentDetail shipment={data} />;
}
