import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthCard } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const Route = createFileRoute("/restablecer")({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: "Nueva contraseña · Domy" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return (
    <AuthCard
      title="Nueva contraseña"
      description="Al guardarla se cierran tus sesiones abiertas en otros equipos."
    >
      <ResetPasswordForm token={error ? undefined : token} />
    </AuthCard>
  );
}
