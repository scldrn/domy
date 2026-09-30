import type { BoardShipment } from "@domy/domain";
import { useId } from "react";
import { BoardTable } from "./board-table";

/** Shipments of earlier days not yet delivered, returned, or voided (FR-021). */
export function PendingSection({
  shipments,
  now,
  today,
}: {
  shipments: BoardShipment[];
  now: Date;
  today: string;
}) {
  const headingId = useId();
  if (shipments.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-lg bg-warning-container/40 p-4"
    >
      <h2 id={headingId} className="text-title-m text-on-surface">
        Pendientes de días anteriores
      </h2>
      <BoardTable shipments={shipments} now={now} today={today} />
    </section>
  );
}
