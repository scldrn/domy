import { shipmentStatuses, shipmentStatusLabels, type ShipmentStatus } from "@domy/domain";
import { Toggle } from "@/components/ui/toggle";

/** One filter chip per status with its count; pressing one shows only that status. */
export function StatusCounts({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<ShipmentStatus, number>;
  selected: ShipmentStatus | undefined;
  onSelect: (status: ShipmentStatus | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Envíos por estado">
      {shipmentStatuses.map((status) => (
        <Toggle
          key={status}
          pressed={selected === status}
          onPressedChange={(pressed) => {
            onSelect(pressed ? status : undefined);
          }}
        >
          {shipmentStatusLabels[status]}
          <span className="text-title-s tabular-nums">{counts[status]}</span>
        </Toggle>
      ))}
    </div>
  );
}
