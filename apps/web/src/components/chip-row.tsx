import type { ReactNode } from "react";

/** A row of filter chips with its label in a fixed column, so stacked rows line up. */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-8 w-16 shrink-0 items-center text-label-l text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}
