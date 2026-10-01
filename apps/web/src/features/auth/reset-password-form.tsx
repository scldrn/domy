import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { checkNewPassword, PasswordField } from "./password-field";
import { resetPassword } from "./session";

/** Sets a new password with the emailed token; it ends every earlier session (FR-030). */
export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "El enlace no es válido o venció.",
  );
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p role="status" className="text-body-l text-on-surface">
        Tu contraseña se actualizó.{" "}
        <Link to="/ingresar" className="text-primary underline">
          Ingresa con la nueva
        </Link>
        .
      </p>
    );
  }
  if (!token) {
    return (
      <p className="text-body-l text-error">
        El enlace no es válido o venció.{" "}
        <Link to="/recuperar" className="text-primary underline">
          Pide uno nuevo
        </Link>
        .
      </p>
    );
  }
  return (
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
        <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} />
        <PasswordField label="Repite la contraseña" value={repeated} onChange={setRepeated} />
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit">Guardar contraseña</Button>
      </FieldGroup>
    </form>
  );
}
