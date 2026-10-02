import { formatTrackingNumber, type BoardShipment } from "@domy/domain";
import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import {
  bogotaHours,
  dayEnd,
  dayStart,
  layoutRibbon,
  ribbonTone,
  type RibbonTone,
} from "./ribbon-layout";

const hourLabels: [number, string][] = [
  [8, "8 a. m."],
  [10, "10 a. m."],
  [12, "12 p. m."],
  [14, "2 p. m."],
  [16, "4 p. m."],
  [18, "6 p. m."],
  [20, "8 p. m."],
];

const toneClasses: Record<RibbonTone, string> = {
  late: "bg-error text-on-error",
  risk: "bg-warning-container text-on-warning-container ring-1 ring-warning ring-inset",
  route: "bg-info-container text-on-info-container ring-1 ring-info ring-inset",
  open: "bg-surface-container-high text-on-surface",
  done: "bg-success-container/70 text-on-success-container line-through decoration-1",
};

const visibleTags = 6;

const legend: [RibbonTone, string][] = [
  ["late", "Atrasado o con novedad"],
  ["risk", "En riesgo"],
  ["route", "En camino"],
  ["open", "Por salir"],
  ["done", "Entregado"],
];

type Pointing = {
  now: Date;
  pointed: string | null;
  point: (shipment: BoardShipment) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
  };
};

/** Shipments outside the timeline: earlier days' and those without a window. */
function Bin({
  title,
  items,
  now,
  pointed,
  point,
}: { title: string; items: BoardShipment[] } & Pointing) {
  return (
    <div className="flex flex-col gap-1.5 rounded-sm bg-sheet-alt p-2.5">
      <h3 className="px-0.5 text-label-m text-on-surface-variant">{title}</h3>
      {items.length === 0 && <p className="px-0.5 text-body-s text-on-surface-variant">Ninguno</p>}
      {items.slice(0, visibleTags).map((shipment) => (
        <button
          key={shipment.id}
          type="button"
          tabIndex={-1}
          {...point(shipment)}
          className={cn(
            "guia cursor-pointer rounded-xs px-2 py-1 text-left text-label-m",
            toneClasses[ribbonTone(shipment, now) ?? "open"],
            pointed === shipment.id && "outline-2 outline-offset-1 outline-on-surface",
          )}
        >
          {formatTrackingNumber(shipment.trackingNumber)}
        </button>
      ))}
      {items.length > visibleTags && (
        <p className="px-0.5 text-body-s text-on-surface-variant">
          y {items.length - visibleTags} más
        </p>
      )}
    </div>
  );
}

const percent = (hours: number) => `${String(((hours - dayStart) / (dayEnd - dayStart)) * 100)}%`;

/**
 * The day's delivery windows against the clock (design-system.md §8): one bar per window,
 * stacked in lanes, with the part of the day already gone shaded and a line at "now". It is a
 * picture of the list below, so assistive technology reads its summary and the list instead;
 * pointing at a bar marks its row, and clicking it takes you there.
 */
export function DayRibbon({
  shipments,
  pending,
  now,
  isToday,
  isPast,
  pointed,
  onPoint,
  onPick,
}: {
  /** The date's own shipments, as filtered on the board. */
  shipments: BoardShipment[];
  /** Earlier days' open shipments, shown apart (today only). */
  pending: BoardShipment[];
  now: Date;
  isToday: boolean;
  isPast: boolean;
  pointed: string | null;
  onPoint: (id: string | null) => void;
  onPick: (shipment: BoardShipment) => void;
}) {
  const titleId = useId();
  const { bars, lanes, unscheduled } = layoutRibbon(shipments, now);
  const nowHours = Math.min(dayEnd, Math.max(dayStart, bogotaHours(now.toISOString())));
  const elapsed = isToday ? percent(nowHours) : isPast ? "100%" : "0%";
  const showNow = isToday && nowHours > dayStart && nowHours < dayEnd;

  const point: Pointing["point"] = (shipment) => ({
    onMouseEnter: () => {
      onPoint(shipment.id);
    },
    onMouseLeave: () => {
      onPoint(null);
    },
    onClick: () => {
      onPick(shipment);
    },
  });

  const pointing: Pointing = { now, pointed, point };
  const lateInDay = nowHours > 17;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-md border border-outline-variant bg-sheet px-5 pt-4 pb-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id={titleId} className="text-title-m text-on-surface">
          Franjas de entrega
        </h2>
        <ul
          aria-hidden="true"
          className="flex flex-wrap gap-x-4 gap-y-1 text-body-s text-on-surface-variant"
        >
          {legend.map(([tone, label]) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-[3px]", toneClasses[tone])} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only">
        La lista de envíos, más abajo, tiene el detalle de cada franja de entrega.
      </p>

      <div aria-hidden="true" className="overflow-x-auto pb-1">
        <div
          className={cn(
            "grid min-w-[48rem] gap-3",
            isToday ? "grid-cols-[8rem_1fr_7rem]" : "grid-cols-[1fr_7rem]",
          )}
        >
          {isToday && <Bin title="Antes de hoy" items={pending} {...pointing} />}

          <div
            className="relative"
            style={{ "--elapsed": elapsed, "--now": percent(nowHours) } as CSSProperties}
          >
            <div className="relative h-6 text-label-s text-on-surface-variant">
              {hourLabels.map(([hour, label], index) => (
                <span
                  key={hour}
                  className={cn(
                    "absolute top-0 whitespace-nowrap",
                    index === 0
                      ? ""
                      : index === hourLabels.length - 1
                        ? "-translate-x-full"
                        : "-translate-x-1/2",
                  )}
                  style={{ left: percent(hour) }}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="relative border-t border-outline-variant">
              <div className="absolute inset-y-0 left-0 w-(--elapsed) bg-on-surface/[0.045]" />
              {[10, 12, 14, 16, 18].map((hour) => (
                <span
                  key={hour}
                  className="absolute inset-y-0 w-px bg-outline-variant/70"
                  style={{ left: percent(hour) }}
                />
              ))}
              <div className="relative max-h-[15rem] overflow-y-auto py-1">
                {lanes === 0 && (
                  <p className="flex h-8 items-center px-2 text-body-s text-on-surface-variant">
                    Ningún envío con franja.
                  </p>
                )}
                {Array.from({ length: lanes }, (_, lane) => (
                  <div key={lane} className="relative h-8">
                    {bars
                      .filter((bar) => bar.lane === lane)
                      .map((bar, index) => (
                        <button
                          key={bar.shipment.id}
                          type="button"
                          tabIndex={-1}
                          {...point(bar.shipment)}
                          className={cn(
                            "guia absolute top-1 flex h-6 origin-left cursor-pointer items-center overflow-hidden rounded-xs px-2 text-label-m whitespace-nowrap",
                            "animate-[ribbon-draw_600ms_var(--ease-emphasized-decelerate)_both]",
                            toneClasses[bar.tone],
                            pointed === bar.shipment.id &&
                              "outline-2 outline-offset-1 outline-on-surface",
                          )}
                          style={{
                            left: percent(bar.from),
                            width: `calc(${percent(bar.to)} - ${percent(bar.from)} - 2px)`,
                            animationDelay: `${String(Math.min(index + lane, 12) * 30)}ms`,
                          }}
                        >
                          {formatTrackingNumber(bar.shipment.trackingNumber)}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
              {showNow && (
                <span className="pointer-events-none absolute -top-1 -bottom-7 left-(--now) w-0.5 -translate-x-1/2 bg-accent" />
              )}
            </div>
            <div className="relative h-7">
              {showNow && (
                <span
                  className={cn(
                    "absolute top-1.5 left-(--now) text-label-m whitespace-nowrap text-accent",
                    lateInDay ? "-ml-1.5 -translate-x-full" : "ml-1.5",
                  )}
                >
                  Ahora, {formatTime(now)}
                </span>
              )}
            </div>
          </div>

          <Bin title="Sin franja" items={unscheduled} {...pointing} />
        </div>
      </div>
    </section>
  );
}
