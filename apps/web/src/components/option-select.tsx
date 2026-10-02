import { useId } from "react";
import { FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** A labeled single choice from a short list (M3 exposed dropdown menu). */
export function OptionSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
  hideLabel,
}: {
  label: string;
  value: T | "" | null;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Keeps the label for screen readers only, where the value already says what it is. */
  hideLabel?: boolean;
}) {
  const labelId = useId();
  return (
    <>
      <FieldLabel id={labelId} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <Select
        value={value || null}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        items={options}
        {...(disabled !== undefined && { disabled })}
      >
        <SelectTrigger className="w-full" aria-labelledby={labelId} aria-invalid={invalid}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
