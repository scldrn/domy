import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ResetPassword } from "@/features/auth/reset-password-form";

export const Route = createFileRoute("/restablecer")({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: "Nueva contraseña · Domy" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return <ResetPassword token={error ? undefined : token} />;
}
