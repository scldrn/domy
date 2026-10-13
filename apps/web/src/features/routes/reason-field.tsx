import { reason as reasonSchema } from "@domy/domain";
import { useId } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Every reassignment, undone dispatch, and cancellation states why, in 5 to 200 characters (FR-016). */
export function ReasonField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>Motivo</FieldLabel>
      <Textarea
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function reasonError(reason: string): string | undefined {
  const parsed = reasonSchema.safeParse(reason);
  return parsed.success ? undefined : (parsed.error.issues[0]?.message ?? "Escribe el motivo.");
}
