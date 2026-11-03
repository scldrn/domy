import CloseIcon from "@material-symbols/svg-400/rounded/close.svg?react";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * A side panel (design-system.md §7, contracts/components.md): an item's detail and actions
 * opened from a list without leaving it (FR-019). 480 px on the right, the whole width on
 * phones; focus moves in on open and back to the opener on close; Escape closes; the header
 * stays in place while the body scrolls.
 */
export function SidePanel({
  open,
  onClose,
  title,
  description,
  marks,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** State mark and tags under the title. */
  marks?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(30rem,100%)] gap-0 overflow-y-auto border-outline-variant bg-sheet p-0 text-on-surface data-[side=right]:w-[min(30rem,100%)] data-[side=right]:sm:max-w-none"
      >
        <div className="sticky top-0 z-10 border-b border-outline-variant bg-sheet px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-headline-s text-on-surface">{title}</SheetTitle>
              {description && (
                <SheetDescription className="mt-0.5 text-body-m text-on-surface-variant">
                  {description}
                </SheetDescription>
              )}
            </div>
            <SheetClose
              render={<Button variant="ghost" size="icon" className="-mr-2 text-on-surface" />}
            >
              <Icon symbol={CloseIcon} />
              <span className="sr-only">Cerrar el detalle</span>
            </SheetClose>
          </div>
          {marks && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">{marks}</div>
          )}
        </div>
        <div className="flex flex-col gap-5 px-5 pt-4 pb-7">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
