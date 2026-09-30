import { createFileRoute, redirect } from "@tanstack/react-router";
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
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-low p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-sm">
        <h1 className="text-headline-s text-on-surface">Domy</h1>
        <p className="mt-1 mb-6 text-body-m text-on-surface-variant">
          Ingresa con tu correo y contraseña.
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
