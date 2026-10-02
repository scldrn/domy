import CheckIcon from "@material-symbols/svg-400/rounded/check.svg?react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { cn } from "@/lib/cn";

/**
 * M3 segmented button for one choice among a few (kind, payment mode, service level): 40 px
 * high with a 48 px touch target and a check on the selected segment. On phones the segments
 * become a two-column grid; up to tablet width they share the row and their labels wrap.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(values: string[]) => {
        const next = values.find((item) => item !== value) as T | undefined;
        if (next) onChange(next);
      }}
      className={cn("grid w-full grid-cols-2 gap-1 sm:flex sm:gap-0 md:w-fit", className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="state-layer flex min-h-10 min-w-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-outline px-3 py-1.5 text-center text-label-l text-on-surface outline-none before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:z-10 data-pressed:bg-secondary-container data-pressed:text-on-secondary-container sm:-ml-px sm:rounded-none sm:first:ml-0 sm:first:rounded-l-sm sm:last:rounded-r-sm md:flex-none md:px-4 md:whitespace-nowrap"
        >
          <CheckIcon className="hidden size-[1.125rem] shrink-0 in-data-pressed:block" />
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
