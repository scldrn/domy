import { cn } from "@/lib/cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** M3 segmented button for one choice among a few (kind, payment mode, service level). */
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
      spacing={0}
      className={cn("flex-wrap", className)}
    >
      {options.map((option, index) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            "rounded-none",
            index === 0 && "rounded-l-full",
            index === options.length - 1 && "rounded-r-full",
            index > 0 && "-ml-px",
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
