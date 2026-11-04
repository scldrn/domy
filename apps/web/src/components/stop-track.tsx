import type { StopMark } from "@domy/domain";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

const surfaces = {
  rail: {
    done: "bg-rail-success",
    pickupDone: "border-rail-success bg-rail",
    exception: "bg-rail-error",
    pending: "border-on-rail-variant/60 bg-rail",
    next: "border-accent bg-rail motion-safe:animate-[next-stop_2.2s_ease-out_infinite]",
    link: "bg-rail-line",
    linkDone: "bg-rail-success/50",
  },
  sheet: {
    done: "bg-success",
    pickupDone: "border-success bg-sheet",
    exception: "bg-error",
    pending: "border-outline-variant bg-sheet",
    next: "border-info bg-sheet ring-3 ring-info/22",
    link: "bg-outline-variant",
    linkDone: "bg-success/60",
  },
} as const;

export type StopTrackSurface = keyof typeof surfaces;

/**
 * A stop's mark (design-system.md §8): pickup done is a hollow green ring, any other stop done
 * a solid green dot, an exception a red square, pending a ring; the next stop of a route on
 * the street stands out (lime on pizarra, the info ring on a sheet).
 */
export function markClass(mark: StopMark, next: boolean, surface: StopTrackSurface): string {
  const look = surfaces[surface];
  if (mark.state === "exception") return cn("rounded-[3px]", look.exception);
  if (mark.state === "done")
    return mark.kind === "pickup"
      ? cn("rounded-full border-[3px]", look.pickupDone)
      : cn("rounded-full", look.done);
  return cn(
    "rounded-full border-2",
    mark.kind === "pickup" && "border-[3px]",
    next ? look.next : look.pending,
  );
}

/**
 * A route's stops in one line (feature 006, FR-018): done and exception marks first, then the
 * pending ones in route order, as `routeStopMarks` gives them; `next` marks the first pending
 * stop of a route on the street.
 */
export function StopTrack({
  marks,
  next,
  surface = "sheet",
  className,
}: {
  marks: StopMark[];
  next: boolean;
  surface?: StopTrackSurface;
  className?: string;
}) {
  const look = surfaces[surface];
  const done = marks.filter((mark) => mark.state !== "pending").length;
  const nextIndex = next ? marks.findIndex((mark) => mark.state === "pending") : -1;
  return (
    <div
      role="img"
      aria-label={`${String(done)} de ${String(marks.length)} paradas completadas`}
      className={cn("flex min-h-3.5 items-center", className)}
    >
      {marks.map((mark, index) => (
        <Fragment key={index}>
          <span className={cn("size-3 shrink-0", markClass(mark, index === nextIndex, surface))} />
          {index < marks.length - 1 && (
            <span
              className={cn(
                "h-0.5 min-w-1 flex-[1_1_6px]",
                mark.state !== "pending" && marks[index + 1]?.state !== "pending"
                  ? look.linkDone
                  : look.link,
              )}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
