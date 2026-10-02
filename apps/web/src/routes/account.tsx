import { userRoleLabels } from "@domy/domain";
import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_panel/cuenta")({
  head: () => ({ meta: [{ title: "Mi cuenta · Domy" }] }),
  component: AccountPage,
});

/** The signed-in user's account and password (FR-030). */
function AccountPage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Mi cuenta" />
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 rounded-md border border-outline-variant bg-sheet p-6 text-body-l">
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
