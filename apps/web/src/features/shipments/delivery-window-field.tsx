import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/option-select";
import type { ShipmentFormValues } from "./form-values";

const presets = [
  { value: "none", label: "Sin franja" },
  { value: "before", label: "Antes de las…" },
  { value: "after", label: "Después de las…" },
  { value: "between", label: "Entre… y…" },
  { value: "morning", label: "En la mañana (8:00 a. m. – 12:00 m.)" },
  { value: "afternoon", label: "En la tarde (12:00 m. – 8:00 p. m.)" },
] as const;

/** Optional delivery window, within operating hours 8:00–20:00 (FR-010). */
export function DeliveryWindowField() {
  const { control, register, formState } = useFormContext<ShipmentFormValues>();
  const preset = useWatch({ control, name: "window.preset" });
  const timeInput = (name: "window.start" | "window.end", label: string) => (
    <Field className="w-40">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} type="time" min="08:00" max="20:00" step={900} {...register(name)} />
    </Field>
  );
  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="window.preset"
        render={({ field }) => (
          <Field>
            <OptionSelect
              label="Franja de entrega"
              value={field.value}
              onChange={field.onChange}
              options={presets}
            />
          </Field>
        )}
      />
      <div className="flex gap-3">
        {(preset === "after" || preset === "between") && timeInput("window.start", "Desde")}
        {(preset === "before" || preset === "between") && timeInput("window.end", "Hasta")}
      </div>
      <FieldError errors={[formState.errors.window]} />
    </div>
  );
}
