import ArrowBackIcon from "@material-symbols/svg-400/rounded/arrow_back.svg?react";
import MarkEmailReadIcon from "@material-symbols/svg-400/rounded/mark_email_read.svg?react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { AuthCard, authLink } from "./auth-card";
import { requestPasswordReset } from "./session";

/**
 * «Recuperar contraseña» as approved in feature 006 (T055): the email, then «Revisa tu
 * correo». The answer is the same whether or not the email is registered (FR-030); the link
 * lasts one hour (`resetPasswordTokenExpiresIn`).
 */
export function RecoveryRequest() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (sentTo) {
    return (
      <AuthCard
        title="Revisa tu correo"
        icon={MarkEmailReadIcon}
        tone="success"
        description={
          <span role="status">
            Si <strong className="font-semibold text-on-surface">{sentTo}</strong> está registrado,
            te enviamos un enlace para crear una contraseña nueva. Vence en una hora.
          </span>
        }
      >
        <Link to="/ingresar" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <Icon symbol={ArrowBackIcon} size={20} />
          Volver a ingresar
        </Link>
        <p className="text-body-m text-on-surface-variant">
          ¿No llega? Revisa la carpeta de correo no deseado o pide otro enlace en unos minutos.
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Recuperar contraseña"
      description="Te enviamos a tu correo un enlace para crear una contraseña nueva."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const typed = email.trim();
          if (!/^\S+@\S+\.\S+$/.test(typed)) {
            setError("Escribe un correo válido.");
            return;
          }
          setSending(true);
          setError(null);
          requestPasswordReset(typed)
            .then(() => {
              setSentTo(typed);
            })
            .catch((caught: unknown) => {
              setError(
                caught instanceof ApiError ? caught.message : "No pudimos enviar el enlace.",
              );
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
              aria-invalid={Boolean(error)}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" variant="accent" disabled={sending}>
            Enviar enlace
          </Button>
        </FieldGroup>
      </form>
      <Link to="/ingresar" className={authLink}>
        Volver a ingresar
      </Link>
    </AuthCard>
  );
}
