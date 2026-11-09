import CheckCircleIcon from "@material-symbols/svg-400/rounded/check_circle.svg?react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { AuthCard, AuthNotice, authLink } from "./auth-card";
import { checkNewPassword, PasswordField } from "./password-field";
import { resetPassword } from "./session";

/**
 * «Nueva contraseña» as approved in feature 006 (T055): sets a new password with the emailed
 * token, which ends every earlier session (FR-030); a missing or expired link says so and
 * offers another.
 */
export function ResetPassword({ token }: { token: string | undefined }) {
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AuthCard
        title="Tu contraseña se actualizó"
        icon={CheckCircleIcon}
        tone="success"
        description={<span role="status">Ya puedes ingresar con la nueva.</span>}
      >
        <Link to="/ingresar" className={cn(buttonVariants({ variant: "accent" }), "w-full")}>
          Ingresar
        </Link>
      </AuthCard>
    );
  }
  if (!token) {
    return (
      <AuthCard title="Nueva contraseña">
        <AuthNotice tone="error" title="El enlace no es válido o venció">
          Cada enlace sirve una vez y dura una hora. Pide uno nuevo.
        </AuthNotice>
        <Link to="/recuperar" className={cn(buttonVariants({ variant: "accent" }), "w-full")}>
          Pedir otro enlace
        </Link>
        <Link to="/ingresar" className={authLink}>
          Volver a ingresar
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Nueva contraseña"
      description="Al guardarla se cierran tus sesiones abiertas en otros equipos."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const problem = checkNewPassword(password, repeated);
          if (problem) {
            setError(problem);
            return;
          }
          resetPassword(token, password).then(
            () => {
              setDone(true);
            },
            (caught: unknown) => {
              setError(
                caught instanceof ApiError ? caught.message : "No pudimos guardar la contraseña.",
              );
            },
          );
        }}
      >
        <FieldGroup>
          <PasswordField
            label="Nueva contraseña"
            value={password}
            onChange={setPassword}
            hint="Al menos 8 caracteres. Una frase corta es fácil de recordar."
            shown={shown}
            reveal={() => {
              setShown((on) => !on);
            }}
          />
          <PasswordField
            label="Repite la contraseña"
            value={repeated}
            onChange={setRepeated}
            shown={shown}
          />
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="accent">
            Guardar contraseña
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
