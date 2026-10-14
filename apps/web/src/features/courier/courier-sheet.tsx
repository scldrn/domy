import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * A bottom sheet of the courier app (design-system.md §7: confirm a delivery, report an
 * exception): reachable with the thumb, scrolling inside when the phone is short.
 */
export function CourierSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-xl gap-0 rounded-t-xl bg-surface-container-low pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="pr-14">
          <SheetTitle className="text-title-l text-on-surface">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-body-l text-on-surface-variant">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** A line of the summary shown before saving (FR-017). */
export function SummaryLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-body-l text-on-surface-variant">{label}</dt>
      <dd className="text-right text-body-l text-on-surface">{children}</dd>
    </div>
  );
}
