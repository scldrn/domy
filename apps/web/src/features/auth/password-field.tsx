import VisibilityIcon from "@material-symbols/svg-400/rounded/visibility.svg?react";
import VisibilityOffIcon from "@material-symbols/svg-400/rounded/visibility_off.svg?react";
import { useId } from "react";
import { z } from "zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon";

/** Passwords have 8 to 128 characters, with no composition rules (FR-030). */
const newPassword = z
  .string()
  .min(8, "Usa al menos 8 caracteres.")
  .max(128, "Usa máximo 128 caracteres.");

/**
 * Shows or hides the password typed beside it (approved T055): a 44 px icon button inside the
 * field, announced as a toggle.
 */
export function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      onClick={onToggle}
      className="absolute top-0.5 right-0.5 grid size-11 cursor-pointer place-items-center rounded-sm text-on-surface-variant outline-none hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent-strong"
    >
      <Icon symbol={shown ? VisibilityOffIcon : VisibilityIcon} size={20} />
    </button>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  reveal,
  shown = false,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  /** Draws the show/hide button in this field; `shown` applies to every field of the form. */
  reveal?: () => void;
  shown?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={hint ? hintId : undefined}
          className={reveal ? "pr-13" : undefined}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        {reveal && <RevealButton shown={shown} onToggle={reveal} />}
      </div>
      {hint && (
        <p id={hintId} className="text-body-m text-on-surface-variant">
          {hint}
        </p>
      )}
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
