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
  /** Public pages: the date field's focus is a 2 px outline like every public control. */
  public: {
    control: "",
    input:
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent-strong",
    today: "",
  },
} as const;

/**
 * Moves a screen one day back or forward, or to any date, and back to today; the board on
 * pizarra, «Rutas» and «Notificar clientes» on a sheet (feature 006). Nothing earlier than
 * `min` or later than `max` can be chosen. Its targets are 48 px (Constitution VII).
 */
export function DayStepper({
  date,
  today,
  onChange,
  label = "Fecha del tablero",
  surface = "rail",
  min,
  max,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
  label?: string;
  surface?: keyof typeof surfaces;
  min?: string;
  /** Nothing later can be chosen («Notificar clientes»: today, FR-015 of feature 004). */
  max?: string;
}) {
  const look = surfaces[surface];
  return (
    <div role="group" aria-label="Cambiar de día" className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn("size-12", look.control)}
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
        className={cn("h-12 w-44", look.input, look.control)}
        value={date}
        {...(min !== undefined && { min })}
        {...(max !== undefined && { max })}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className={cn("size-12", look.control)}
        aria-label="Día siguiente"
        disabled={max !== undefined && date >= max}
        onClick={() => {
          onChange(shiftDay(date, 1));
        }}
      >
        <Icon symbol={ChevronRightIcon} size={20} />
      </Button>
      {date !== today && (
        <Button
          variant="ghost"
          className={cn("h-12 px-3", look.today)}
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
