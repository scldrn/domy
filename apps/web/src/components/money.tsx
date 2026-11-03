import { formatCop } from "@domy/domain";
import { cn } from "@/lib/cn";

/**
 * An amount in integer COP, or "—" when there is none (contracts/components.md, FR-005);
 * screen readers hear `emptyLabel` instead of the dash.
 */
export function Money({
  amount,
  emptyLabel = "Sin valor",
  className,
}: {
  amount: number | null;
  emptyLabel?: string;
  className?: string;
}) {
  if (!amount) {
    return (
      <span className={cn("text-on-surface-variant", className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{emptyLabel}</span>
      </span>
    );
  }
  return <span className={cn("tabular-nums", className)}>{formatCop(amount)}</span>;
}
