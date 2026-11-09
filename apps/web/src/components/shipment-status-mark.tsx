import { shipmentStatusLabels, type ShipmentStatus } from "@domy/domain";
import { cn } from "@/lib/cn";

/**
 * Shipment state mark (design-system.md §8): a dot and the label in the state's color,
 * identical on every surface. The label carries the meaning; color only speeds reading.
 */
const appearance: Record<ShipmentStatus, string> = {
  registered:
    "text-on-surface-variant before:bg-transparent before:ring-2 before:ring-outline before:ring-inset",
  assigned: "text-tertiary before:bg-tertiary",
  dispatched: "text-info before:bg-info",
  picked_up: "text-info before:bg-info",
  delivered: "text-success before:bg-success",
  exception: "text-error before:bg-error",
  returned: "text-warning before:bg-warning",
  voided: "text-on-surface-variant before:bg-outline-variant",
};

export function ShipmentStatusMark({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-label-l font-semibold whitespace-nowrap before:size-2.5 before:shrink-0 before:rounded-full before:content-['']",
        appearance[status],
        className,
      )}
    >
      {shipmentStatusLabels[status]}
    </span>
  );
}
