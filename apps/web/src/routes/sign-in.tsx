import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AuthCard, authLink } from "@/features/auth/auth-card";
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

/** «Ingresar» as approved in feature 006 (T055). */
function SignInPage() {
  return (
    <AuthCard title="Ingresar" description="Usa el correo y la contraseña de tu cuenta.">
      <SignInForm />
      <Link to="/recuperar" className={authLink}>
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthCard>
  );
}
