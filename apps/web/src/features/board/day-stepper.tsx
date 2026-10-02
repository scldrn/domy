import ChevronLeftIcon from "@material-symbols/svg-400/rounded/chevron_left.svg?react";
import ChevronRightIcon from "@material-symbols/svg-400/rounded/chevron_right.svg?react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The calendar day before or after `date` (YYYY-MM-DD). */
function shiftDay(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

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
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="Día anterior"
        onClick={() => {
          onChange(shiftDay(date, -1));
        }}
      >
        <Icon symbol={ChevronLeftIcon} />
      </Button>
      <Input
        type="date"
        aria-label="Fecha del tablero"
        className="w-44"
        value={date}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="Día siguiente"
        onClick={() => {
          onChange(shiftDay(date, 1));
        }}
      >
        <Icon symbol={ChevronRightIcon} />
      </Button>
      {date !== today && (
        <Button
          variant="ghost"
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
