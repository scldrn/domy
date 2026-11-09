import { userRoleLabels } from "@domy/domain";
import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { DetailSheet, MasterHeader } from "@/features/master-data/master-page";

export const Route = createFileRoute("/_panel/cuenta")({
  head: () => ({ meta: [{ title: "Mi cuenta · Domy" }] }),
  component: AccountPage,
});

function initials(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

/**
 * The signed-in user's account and password (FR-030), as approved in feature 006 (US5): who
 * the person is beside the form to change the password.
 */
function AccountPage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Mi cuenta"
        sentence={[
          {
            text: "Tus datos y tu contraseña. El nombre, el correo y el rol se cambian en «Usuarios».",
          },
        ]}
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section
          aria-label="Tus datos"
          className="flex flex-col gap-3.5 rounded-lg border border-outline-variant bg-sheet px-5.5 py-5"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary-container text-title-m font-bold text-on-secondary-container"
            >
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-title-l text-on-surface">{user.name}</span>
              <span className="text-body-m text-on-surface-variant">
                {userRoleLabels[user.role]}
              </span>
            </span>
          </div>
          <dl className="text-body-l">
            {[
              ["Nombre", user.name],
              ["Correo", user.email],
              ["Rol", userRoleLabels[user.role]],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={
                  index > 0
                    ? "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-outline-variant py-2.5"
                    : "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                }
              >
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="text-right font-semibold wrap-anywhere text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <DetailSheet id="cuenta-contrasena" title="Cambiar contraseña">
          <p className="-mt-1.5 text-body-m text-on-surface-variant">
            Al cambiarla se cierran tus sesiones en otros equipos.
          </p>
          <ChangePasswordForm />
        </DetailSheet>
      </div>
    </div>
  );
}
