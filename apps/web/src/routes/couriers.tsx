import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import type { Courier } from "@domy/domain";
import { Badge } from "@/components/ui/badge";
import { listCouriers, updateCourier } from "@/features/master-data/api";
import { CourierDialog } from "@/features/master-data/couriers/courier-dialog";
import { DirectoryPage } from "@/features/master-data/directory-page";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/mensajeros")({
  head: () => ({ meta: [{ title: "Mensajeros · Domy" }] }),
  component: CouriersPage,
});

function initials(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

/** The couriers directory (FR-026), as approved in feature 006 (US5). */
function CouriersPage() {
  const { user } = panelRoute.useRouteContext();
  return (
    <DirectoryPage<Courier>
      title="Mensajeros"
      dataset="couriers"
      queryKey="couriers"
      list={(q) => listCouriers(q)}
      sentence={(couriers) => {
        const active = couriers.filter((courier) => courier.isActive);
        const without = active.filter((courier) => !courier.account).length;
        if (active.length === 0) return [{ text: "Todavía no hay mensajeros activos." }];
        return [
          {
            text: `${String(active.length)} ${active.length === 1 ? "mensajero activo" : "mensajeros activos"}`,
            strong: true,
          },
          {
            text:
              without === 0
                ? "; todos usan la app con su cuenta."
                : `; ${String(active.length - without)} usan la app con su cuenta y `,
          },
          ...(without > 0
            ? [
                {
                  text: `${String(without)} ${without === 1 ? "no tiene cuenta" : "no tienen cuenta"}`,
                  strong: true,
                },
                { text: "." },
              ]
            : []),
        ];
      }}
      template="minmax(13rem,1.3fr) 10rem minmax(13rem,1.2fr)"
      columns={[
        {
          key: "name",
          header: "Mensajero",
          card: { order: 1, place: "start" },
          cell: (courier) => (
            <span className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-container text-label-m font-bold text-on-secondary-container"
              >
                {initials(courier.name)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-on-surface">{courier.name}</span>
                {courier.aliases.length > 0 && (
                  <span className="truncate text-body-m text-on-surface-variant">
                    {courier.aliases.join(" · ")}
                  </span>
                )}
              </span>
            </span>
          ),
        },
        {
          key: "phone",
          header: "Teléfono",
          card: { order: 3, place: "start" },
          cell: (courier) => <span className="tabular-nums">{courier.phone}</span>,
        },
        // Linked by the owner in "Usuarios" (feature 003, FR-002).
        {
          key: "account",
          header: "Cuenta de la app",
          card: { order: 4, place: "full" },
          cell: (courier) =>
            courier.account ? (
              <span className="truncate">{courier.account.email}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Sin cuenta</Badge>
                {user.role === "owner" && (
                  <Link
                    to="/usuarios"
                    className="text-body-m font-semibold text-on-surface underline underline-offset-4"
                  >
                    Crear en Usuarios
                  </Link>
                )}
              </span>
            ),
        },
      ]}
      create={<CourierDialog />}
      edit={(courier) => <CourierDialog courier={courier} />}
      setActive={async (courier, isActive) => {
        const { openRoutes } = await updateCourier(courier.id, {
          actionId: crypto.randomUUID(),
          isActive,
        });
        // Their routes stay with them until the dispatcher reassigns them (feature 002, FR-010).
        if (isActive || openRoutes === 0) return undefined;
        return openRoutes === 1
          ? "Tiene 1 ruta abierta, que sigue a su nombre hasta que la reasignes."
          : `Tiene ${String(openRoutes)} rutas abiertas, que siguen a su nombre hasta que las reasignes.`;
      }}
    />
  );
}
