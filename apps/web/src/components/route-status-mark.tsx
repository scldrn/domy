import { routeStatusLabels, type RouteStatus } from "@domy/domain";
import { cn } from "@/lib/cn";

/**
 * Route state mark (design-system.md §3.3, §8): the shipment state mark's dot and label, with
 * the route status roles, so a route reads like its shipments.
 */
const appearance: Record<RouteStatus, string> = {
  draft: "text-tertiary before:bg-tertiary",
  in_progress: "text-info before:bg-info",
  finished: "text-success before:bg-success",
  cancelled: "text-on-surface-variant before:bg-outline-variant",
};

export function RouteStatusMark({
  status,
  className,
}: {
  status: RouteStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-label-l whitespace-nowrap before:size-2.5 before:shrink-0 before:rounded-full before:content-['']",
        appearance[status],
        className,
      )}
    >
      {routeStatusLabels[status]}
    </span>
  );
}
