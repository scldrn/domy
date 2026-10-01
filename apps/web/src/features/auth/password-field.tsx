import { useId } from "react";
import { z } from "zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Passwords have 8 to 128 characters, with no composition rules (FR-030). */
const newPassword = z
  .string()
  .min(8, "Usa al menos 8 caracteres.")
  .max(128, "Usa máximo 128 caracteres.");

export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

/** The new password and its repetition, or the first problem with them. */
export function checkNewPassword(password: string, repeated: string): string | null {
  const parsed = newPassword.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Contraseña no válida.";
  return password === repeated ? null : "Las contraseñas no coinciden.";
}
