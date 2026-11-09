import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { formatTime } from "@/lib/format";
import { AuthNotice } from "./auth-card";
import { RevealButton } from "./password-field";
import { sessionQuery, signIn } from "./session";

const signInSchema = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // The lockout's end, shown as its own notice with the way out (approved T055, FR-033).
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setLockedUntil(null);
    try {
      await signIn(email, password);
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await navigate({ to: "/" });
    } catch (error) {
      const retryAt = error instanceof ApiError ? error.details["retryAt"] : undefined;
      if (
        error instanceof ApiError &&
        error.code === "account_locked" &&
        typeof retryAt === "string"
      )
        setLockedUntil(retryAt);
      else
        setFormError(
          error instanceof ApiError
            ? error.message
            : "No pudimos iniciar sesión. Intenta de nuevo.",
        );
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <>
      {lockedUntil && (
        <AuthNotice tone="warning" title="Demasiados intentos fallidos">
          Podrás ingresar de nuevo a las {formatTime(lockedUntil)}, o{" "}
          <Link to="/recuperar" className="font-bold underline underline-offset-3">
            recupera tu contraseña
          </Link>
          .
        </AuthNotice>
      )}
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="email">Correo</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={Boolean(errors.password ?? formError)}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={shown ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password ?? formError)}
                className="pr-13"
                {...form.register("password")}
              />
              <RevealButton
                shown={shown}
                onToggle={() => {
                  setShown((on) => !on);
                }}
              />
            </div>
            <FieldError errors={[errors.password]} />
            {formError && <FieldError>{formError}</FieldError>}
          </Field>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando…" : "Ingresar"}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
