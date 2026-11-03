import { shipmentKindLabels } from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorAlert } from "@/components/query-state";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { SidePanel } from "@/components/side-panel";
import { TrackingNumber } from "@/components/tracking-number";
import { Skeleton } from "@/components/ui/skeleton";
import { getShipmentByTrackingNumber } from "@/features/shipments/api";
import { ShipmentDetail } from "@/features/shipments/shipment-detail";

export type OpenShipment = { trackingNumber: string; action?: "reassign" };

/**
 * A shipment opened from the board (FR-019): its detail and every action it has today, in the
 * side panel, without leaving the board. It shares the shipment page's query, so what one
 * changes the other shows.
 */
export function ShipmentPanel({
  open,
  onClose,
}: {
  open: OpenShipment | null;
  onClose: () => void;
}) {
  const trackingNumber = open?.trackingNumber ?? "";
  const shipment = useQuery({
    queryKey: ["shipment", trackingNumber],
    queryFn: () => getShipmentByTrackingNumber(trackingNumber),
    enabled: open !== null,
  });
  const data = shipment.data;
  return (
    <SidePanel
      open={open !== null}
      onClose={onClose}
      title={<TrackingNumber value={trackingNumber} className="text-headline-s" />}
      description={
        data ? `${data.merchant.name} · ${shipmentKindLabels[data.kind]}` : "Cargando el envío…"
      }
      marks={data && <ShipmentStatusMark status={data.status} />}
    >
      {data ? (
        <ShipmentDetail
          key={`${trackingNumber}-${open?.action ?? ""}`}
          shipment={data}
          variant="panel"
          {...(open?.action && { initialAction: open.action })}
        />
      ) : shipment.isError ? (
        <QueryErrorAlert
          message={shipment.error.message}
          onRetry={() => {
            void shipment.refetch();
          }}
        />
      ) : (
        <div role="status" aria-label="Cargando el envío" className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      )}
    </SidePanel>
  );
}
