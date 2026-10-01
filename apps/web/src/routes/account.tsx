import { userRoleLabels } from "@domy/domain";
import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordForm } from "@/features/auth/change-password-form";

export const Route = createFileRoute("/_panel/cuenta")({
  head: () => ({ meta: [{ title: "Mi cuenta · Domy" }] }),
  component: AccountPage,
});

/** The signed-in user's account and password (FR-030). */
function AccountPage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-headline-s text-on-surface">Mi cuenta</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-body-l">
        <dt className="text-on-surface-variant">Nombre</dt>
        <dd>{user.name}</dd>
        <dt className="text-on-surface-variant">Correo</dt>
        <dd>{user.email}</dd>
        <dt className="text-on-surface-variant">Rol</dt>
        <dd>{userRoleLabels[user.role]}</dd>
      </dl>
      <section className="flex flex-col gap-3">
        <h2 className="text-title-m text-on-surface">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
