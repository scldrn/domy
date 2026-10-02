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
    <AuthCard title="Ingresar" description="Usa el correo y la contraseña de tu cuenta.">
      <SignInForm />
      <Link
        to="/recuperar"
        className="mt-6 block w-fit rounded-xs text-body-m text-primary underline underline-offset-4"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthCard>
  );
}
