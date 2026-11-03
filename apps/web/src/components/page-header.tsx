import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The title of a panel page, what the person needs to know under it (FR-007), the page's one
 * emphasized action, and an aside on the right. `description` and `actions` are the older
 * names of `sentence` and `action`, kept until every screen is redesigned (feature 006).
 */
export function PageHeader({
  title,
  sentence,
  description,
  action,
  actions,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  sentence?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  /** Marks shown next to the title (status chip, badges). */
  children?: ReactNode;
  className?: string;
}) {
  const line = sentence ?? description;
  const right = action ?? actions;
  return (
    <header
      className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-m text-on-surface">{title}</h1>
          {children}
        </div>
        {line && <div className="text-body-l text-on-surface-variant">{line}</div>}
      </div>
      {(right ?? aside) && (
        <div className="flex flex-wrap items-center gap-2">
          {aside}
          {right}
        </div>
      )}
    </header>
  );
}
