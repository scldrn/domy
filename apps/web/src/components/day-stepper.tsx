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

/** Outlined controls on pizarra or on a sheet (design-system.md §8, "Day summary"). */
const surfaces = {
  rail: {
    control:
      "border-rail-line bg-transparent text-on-rail hover:border-on-rail-variant hover:bg-rail-raised",
    input: "[color-scheme:dark]",
    today: "text-accent hover:bg-rail-raised",
  },
  sheet: { control: "", input: "", today: "" },
} as const;

/**
 * Moves a screen one day back or forward, or to any date, and back to today; the board on
 * pizarra, «Rutas» on a sheet (feature 006). Nothing earlier than `min` can be chosen.
 */
export function DayStepper({
  date,
  today,
  onChange,
  label = "Fecha del tablero",
  surface = "rail",
  min,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
  label?: string;
  surface?: keyof typeof surfaces;
  min?: string;
}) {
  const look = surfaces[surface];
  return (
    <div role="group" aria-label="Cambiar de día" className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn("size-11", look.control)}
        aria-label="Día anterior"
        disabled={min !== undefined && date <= min}
        onClick={() => {
          onChange(shiftDay(date, -1));
        }}
      >
        <Icon symbol={ChevronLeftIcon} size={20} />
      </Button>
      <Input
        type="date"
        aria-label={label}
        className={cn("h-11 w-44", look.input, look.control)}
        value={date}
        {...(min !== undefined && { min })}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className={cn("size-11", look.control)}
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
          className={cn("h-11 px-3", look.today)}
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
