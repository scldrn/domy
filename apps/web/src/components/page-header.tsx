import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The title of a form screen, its marks beside it, and what the person needs to know under it
 * (FR-007), as the approved shipment form, edit, and bulk registration open (feature 006).
 */
export function PageHeader({
  title,
  sentence,
  children,
  className,
}: {
  title: ReactNode;
  sentence?: ReactNode;
  /** Marks shown next to the title (the shipment's state). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-headline-m text-on-surface">{title}</h1>
        {children}
      </div>
      {sentence && <div className="text-body-l text-on-surface-variant">{sentence}</div>}
    </header>
  );
}
