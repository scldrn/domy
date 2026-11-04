import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled card of the detail (design-system.md §8). */
export function DetailCard({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-outline-variant bg-sheet px-5 py-4.5",
        className,
      )}
    >
      <h2 id={id} className="flex items-center gap-2 text-title-l text-on-surface">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-sheet-alt px-2 text-label-m text-on-surface-variant tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
