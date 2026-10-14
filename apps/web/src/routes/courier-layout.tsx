import ContrastIcon from "@material-symbols/svg-400/rounded/contrast.svg?react";
import LogoutIcon from "@material-symbols/svg-400/rounded/logout.svg?react";
import RouteFillIcon from "@material-symbols/svg-400/rounded/route-fill.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import CloudUploadFillIcon from "@material-symbols/svg-400/rounded/cloud_upload-fill.svg?react";
import CloudUploadIcon from "@material-symbols/svg-400/rounded/cloud_upload.svg?react";
import TodayFillIcon from "@material-symbols/svg-400/rounded/today-fill.svg?react";
import TodayIcon from "@material-symbols/svg-400/rounded/today.svg?react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon, type Symbol } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { sessionQuery, signOut } from "@/features/auth/session";
import { courierScheme, readHighContrast, saveHighContrast } from "@/features/courier/scheme";
import { cn } from "@/lib/cn";

type Destination = {
  to: "/mensajero" | "/mensajero/pendientes" | "/mensajero/mi-dia";
  label: string;
  icon: Symbol;
  /** Filled variant for the current destination (design-system.md §7.1). */
  activeIcon: Symbol;
};

/** The navigation bar's destinations (design-system.md §2, §7: 3–4 destinations). */
const destinations: Destination[] = [
  { to: "/mensajero", label: "Mi ruta", icon: RouteIcon, activeIcon: RouteFillIcon },
  {
    to: "/mensajero/pendientes",
    label: "Pendientes",
    icon: CloudUploadIcon,
    activeIcon: CloudUploadFillIcon,
  },
  { to: "/mensajero/mi-dia", label: "Mi día", icon: TodayIcon, activeIcon: TodayFillIcon },
];

/** The courier app (feature 003): for couriers only; the office has the panel (FR-002). */
export const Route = createFileRoute("/_courier")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(sessionQuery);
    if (!user) throw redirect({ to: "/ingresar", search: { redirect: location.href } });
    if (user.role !== "courier") throw redirect({ to: "/" });
    return { user };
  },
  component: CourierLayout,
});

function CourierLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [highContrast, setHighContrast] = useState(readHighContrast);

  // Light unless the courier chose high contrast; the panel follows the device again after.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset["scheme"] = courierScheme(highContrast);
    return () => {
      delete root.dataset["scheme"];
    };
  }, [highContrast]);

  const onSignOut = async () => {
    await signOut();
    queryClient.clear();
    await navigate({ to: "/ingresar" });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-sm bg-sheet px-4 py-3 text-label-l text-on-surface shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center gap-1 pr-2 pl-4">
          <span className="mr-auto text-[1.5rem] leading-none font-bold tracking-[-0.02em] text-primary [font-stretch:125%]">
            domy
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alto contraste"
            aria-pressed={highContrast}
            className={cn(highContrast && "bg-secondary-container text-on-secondary-container")}
            onClick={() => {
              setHighContrast((on) => {
                saveHighContrast(!on);
                return !on;
              });
            }}
          >
            <Icon symbol={ContrastIcon} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={() => void onSignOut()}
          >
            <Icon symbol={LogoutIcon} />
          </Button>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28 outline-none"
      >
        <Outlet />
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-surface-container pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-20 max-w-xl grid-cols-3">
          {destinations.map((destination) => {
            const active =
              destination.to === "/mensajero"
                ? pathname === "/mensajero" || pathname.startsWith("/mensajero/parada")
                : pathname.startsWith(destination.to);
            return (
              <li key={destination.to} className="flex">
                <Link
                  to={destination.to}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-1 flex-col items-center justify-center gap-1 rounded-sm text-label-m text-on-surface-variant aria-[current=page]:text-on-surface"
                >
                  <span
                    className={cn(
                      "state-layer flex h-8 w-16 items-center justify-center rounded-full",
                      active && "bg-secondary-container text-on-secondary-container",
                    )}
                  >
                    <Icon symbol={active ? destination.activeIcon : destination.icon} />
                  </span>
                  {destination.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
