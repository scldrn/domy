import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { requestPasswordReset } from "./session";

/**
 * Asks for a recovery link. The answer is the same whether or not the email is registered
 * (FR-030).
 */
export function RecoveryRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (sent) {
    return (
      <p role="status" className="text-body-l text-on-surface">
        Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisa
        tu bandeja de entrada; el enlace sirve una vez durante 60 minutos.
      </p>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
          setError("Escribe un correo válido.");
          return;
        }
        setSending(true);
        setError(null);
        requestPasswordReset(email.trim())
          .then(() => {
            setSent(true);
          })
          .catch((caught: unknown) => {
            setError(caught instanceof ApiError ? caught.message : "No pudimos enviar el enlace.");
          })
          .finally(() => {
            setSending(false);
          });
      }}
    >
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="recovery-email">Correo</FieldLabel>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" disabled={sending}>
          Enviar enlace
        </Button>
      </FieldGroup>
    </form>
  );
}
