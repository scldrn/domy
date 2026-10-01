import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/sign-in-form";
import { sessionQuery } from "@/features/auth/session";

export const Route = createFileRoute("/ingresar")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query(sessionQuery);
    if (user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Ingresar · Domy" }] }),
  component: SignInPage,
});

function SignInPage() {
  return (
    <AuthCard title="Domy" description="Ingresa con tu correo y contraseña.">
      <SignInForm />
      <Link to="/recuperar" className="mt-4 block text-body-m text-primary underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthCard>
  );
}
