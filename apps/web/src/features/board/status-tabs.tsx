import { shipmentStatuses, shipmentStatusLabels, type ShipmentStatus } from "@domy/domain";
import { cn } from "@/lib/cn";

const tab =
  "relative flex h-12 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-label-l whitespace-nowrap text-on-surface-variant outline-none hover:text-on-surface focus-visible:rounded-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full aria-pressed:text-on-surface aria-pressed:after:bg-primary";

/**
 * The count of each status (FR-021) as tabs that filter the board; "Todos" clears the
 * filter. Each tab says its count, so the row of tabs is also the day's tally.
 */
export function StatusTabs({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<ShipmentStatus, number>;
  selected: ShipmentStatus | undefined;
  onSelect: (status: ShipmentStatus | undefined) => void;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (
    <div
      role="group"
      aria-label="Envíos por estado"
      className="flex overflow-x-auto border-b border-outline-variant"
    >
      <button
        type="button"
        aria-pressed={!selected}
        className={tab}
        onClick={() => {
          onSelect(undefined);
        }}
      >
        Todos <span className="tabular-nums text-on-surface-variant">{total}</span>
      </button>
      {shipmentStatuses.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={selected === status}
          className={cn(
            tab,
            counts[status] === 0 && selected !== status && "text-on-surface-variant/80",
          )}
          onClick={() => {
            onSelect(selected === status ? undefined : status);
          }}
        >
          {shipmentStatusLabels[status]}{" "}
          <span className="tabular-nums text-on-surface-variant">{counts[status]}</span>
        </button>
      ))}
    </div>
  );
}
