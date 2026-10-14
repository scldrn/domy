import type { BoardEntry } from "@domy/domain";
import { useId } from "react";
import { BoardTable } from "./board-table";

/**
 * One table of the board under its heading, count, and what to do with it. Both sections
 * share the same columns so they line up (FR-021).
 */
export function BoardSection({
  title,
  hint,
  shipments,
  now,
  today,
  pointed,
  onPoint,
}: {
  title: string;
  hint: string;
  shipments: BoardEntry[];
  now: Date;
  today?: string;
  pointed: string | null;
  onPoint: (id: string | null) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="flex items-baseline gap-2 text-title-l text-on-surface">
          {title}
          <span className="text-body-l text-on-surface-variant tabular-nums">
            {shipments.length}
          </span>
        </h2>
        <p className="text-body-m text-on-surface-variant">{hint}</p>
      </div>
      <BoardTable
        shipments={shipments}
        now={now}
        pointed={pointed}
        onPoint={onPoint}
        {...(today && { today })}
      />
    </section>
  );
}
