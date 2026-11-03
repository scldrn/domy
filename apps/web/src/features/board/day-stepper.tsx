import ChevronLeftIcon from "@material-symbols/svg-400/rounded/chevron_left.svg?react";
import ChevronRightIcon from "@material-symbols/svg-400/rounded/chevron_right.svg?react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** The calendar day before or after `date` (YYYY-MM-DD). */
function shiftDay(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/** Outlined controls on pizarra (design-system.md §8, "Day summary"). */
const onRail =
  "border-rail-line bg-transparent text-on-rail hover:border-on-rail-variant hover:bg-rail-raised";

/** Moves the board one day back or forward, or to any date, and back to today. */
export function DayStepper({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  return (
    <div role="group" aria-label="Cambiar de día" className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn("size-11", onRail)}
        aria-label="Día anterior"
        onClick={() => {
          onChange(shiftDay(date, -1));
        }}
      >
        <Icon symbol={ChevronLeftIcon} size={20} />
      </Button>
      <Input
        type="date"
        aria-label="Fecha del tablero"
        className={cn("h-11 w-44 [color-scheme:dark]", onRail)}
        value={date}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className={cn("size-11", onRail)}
        aria-label="Día siguiente"
        onClick={() => {
          onChange(shiftDay(date, 1));
        }}
      >
        <Icon symbol={ChevronRightIcon} size={20} />
      </Button>
      {date !== today && (
        <Button
          variant="ghost"
          className="h-11 px-3 text-accent hover:bg-rail-raised"
          onClick={() => {
            onChange(today);
          }}
        >
          Ir a hoy
        </Button>
      )}
    </div>
  );
}
