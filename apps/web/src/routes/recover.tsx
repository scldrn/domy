import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/auth-card";
import { RecoveryRequestForm } from "@/features/auth/recovery-request-form";

export const Route = createFileRoute("/recuperar")({
  head: () => ({ meta: [{ title: "Recuperar contraseña · Domy" }] }),
  component: () => (
    <AuthCard
      title="Recuperar contraseña"
      description="Te enviamos a tu correo un enlace para crear una contraseña nueva."
    >
      <RecoveryRequestForm />
      <Link to="/ingresar" className="mt-4 block text-body-m text-primary underline">
        Volver a ingresar
      </Link>
    </AuthCard>
  ),
});
