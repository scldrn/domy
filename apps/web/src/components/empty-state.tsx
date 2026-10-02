import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type Symbol } from "./icon";

/** What a list shows when it has nothing: an icon, what happened, and what to do next. */
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
        "flex flex-col items-center gap-3 rounded-md border border-outline-variant bg-sheet px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon symbol={icon} />
      </span>
      <p className="text-title-m text-on-surface">{title}</p>
      {description && <p className="max-w-md text-body-m text-on-surface-variant">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
