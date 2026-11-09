import CheckIcon from "@material-symbols/svg-400/rounded/check.svg?react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { cn } from "@/lib/cn";

/**
 * M3 segmented button for one choice among a few (payment mode, service level): segments on a
 * `sheet-alt` track, the selected one filled in `on-surface` with a check (feature 006,
 * approved "Nuevo envío" proposal). 40 px high with a 48 px touch target; the segments wrap
 * when the row is narrow.
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
      className={cn(
        "flex w-full flex-wrap gap-1 rounded-md border border-outline-variant bg-sheet-alt p-1",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="relative flex min-h-10 flex-[1_1_auto] cursor-pointer items-center justify-center gap-2 rounded-sm px-3.5 py-1.5 text-center text-label-l whitespace-nowrap text-on-surface-variant outline-none before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-surface-container-high hover:text-on-surface focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent-strong data-pressed:bg-on-surface data-pressed:text-surface"
        >
          <CheckIcon className="hidden size-[1.125rem] shrink-0 in-data-pressed:block" />
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
