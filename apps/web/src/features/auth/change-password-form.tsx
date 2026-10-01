import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { checkNewPassword, PasswordField } from "./password-field";
import { changePassword } from "./session";

/** Changes the signed-in user's password; other sessions end (FR-030). */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = current
          ? checkNewPassword(password, repeated)
          : "Escribe tu contraseña actual.";
        if (problem) {
          setError(problem);
          return;
        }
        setError(null);
        changePassword(current, password).then(
          () => {
            toast.success("Contraseña actualizada");
            setCurrent("");
            setPassword("");
            setRepeated("");
          },
          (caught: unknown) => {
            setError(
              caught instanceof ApiError ? caught.message : "No pudimos cambiar la contraseña.",
            );
          },
        );
      }}
    >
      <FieldGroup>
        <PasswordField
          label="Contraseña actual"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} />
        <PasswordField label="Repite la contraseña" value={repeated} onChange={setRepeated} />
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="self-start">
          Cambiar contraseña
        </Button>
      </FieldGroup>
    </form>
  );
}
