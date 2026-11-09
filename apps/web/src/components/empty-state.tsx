import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type Symbol } from "./icon";

/**
 * What a list shows when it has nothing: an icon, what happened, and what to do next
 * (design-system.md §8), on a sheet like the approved screens (feature 006, T018).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: Symbol;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-outline-variant bg-sheet px-6 py-11 text-center",
        className,
      )}
    >
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon symbol={icon} className="size-7" />
      </span>
      <p className="text-title-l font-semibold text-on-surface">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-body-m text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
