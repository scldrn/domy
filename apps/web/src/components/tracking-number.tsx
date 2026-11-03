import { formatTrackingNumber } from "@domy/domain";
import { cn } from "@/lib/cn";

/** A tracking number in the condensed heavy "guía" style (design-system.md §8, FR-005). */
export function TrackingNumber({ value, className }: { value: string; className?: string }) {
  return <span className={cn("guia", className)}>{formatTrackingNumber(value)}</span>;
}
