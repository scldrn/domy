import CloudOffIcon from "@material-symbols/svg-400/rounded/cloud_off.svg?react";
import ContrastIcon from "@material-symbols/svg-400/rounded/contrast.svg?react";
import SyncIcon from "@material-symbols/svg-400/rounded/sync.svg?react";
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
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon, type Symbol } from "@/components/icon";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { sessionQuery, signOut } from "@/features/auth/session";
import {
  courierDatabase,
  synchronizeNow,
  useCourierState,
  useSynchronization,
} from "@/features/courier/courier-store";
import { InstallHint } from "@/features/courier/install-hint";
import { hasOldPending, pendingLabel, sessionWarning } from "@/features/courier/sync-status";
import { courierScheme, readHighContrast, saveHighContrast } from "@/features/courier/scheme";
import { cn } from "@/lib/cn";
import { now } from "@/lib/clock";
import { ApiError } from "@/lib/api-client";
import { enablePush, loadPushKey } from "@/lib/offline/push";
import { courierMeta } from "@/lib/offline/db";

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

/** Icon buttons on the pizarra header: light icons, a quiet hover, lime focus (feature 006). */
const railButton =
  "text-on-rail hover:bg-on-rail/10 hover:text-on-rail focus-visible:outline-accent";

/** In the courier app, snackbars sit above the navigation bar (M3; design-system.md §7). */
const aboveNavigationBar = { bottom: "6.5rem" };

/** The courier app (feature 003): for couriers only; the office has the panel (FR-002). */
export const Route = createFileRoute("/_courier")({
  beforeLoad: async ({ context, location }) => {
    // Loaded here, not imported: this guard stays in the route tree every page loads, the public
    // ones included (constitution: tracking within 3 s). `main.tsx` starts the download early.
    const [store, offline, sync] = await Promise.all([
      import("@/features/courier/courier-store"),
      import("@/lib/offline/db"),
      import("@/lib/offline/sync"),
    ]);
    const db = await store.courierDatabase();
    const meta = await offline.readCourierMeta(db);
    const localUser = meta ? { id: meta.userId, role: "courier" as const } : null;
    if (!navigator.onLine) {
      if (!localUser) store.resetCourierState();
      return { user: localUser };
    }
    let user;
    try {
      user = await context.queryClient.query({ ...sessionQuery, retry: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && localUser) {
        await sync.refuseCourierSession(db, {
          userId: localUser.id,
          now: () => new Date(),
          serverTime: now().toISOString(),
          status: 403,
        });
        return { user: localUser };
      }
      if (
        !(error instanceof ApiError) ||
        (error.status !== 0 && error.code !== "session_unavailable")
      )
        throw error;
      if (!localUser) store.resetCourierState();
      return { user: localUser };
    }
    if (!user) {
      if (!localUser) throw redirect({ to: "/ingresar", search: { redirect: location.href } });
      await sync.refuseCourierSession(db, {
        userId: localUser.id,
        now: () => new Date(),
        serverTime: now().toISOString(),
      });
      return { user: localUser };
    }
    if (user.role !== "courier") throw redirect({ to: "/" });
    await offline.claimCourierDb(db, user.id);
    if (meta?.userId !== user.id) store.resetCourierState();
    return { user };
  },
  component: CourierLayout,
});

function CourierLayout() {
  const { user } = Route.useRouteContext();
  // On open, when the connection returns, and every 30 seconds (FR-020, FR-022).
  useSynchronization(user?.id ?? null);
  const status = useCourierState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [highContrast, setHighContrast] = useState(readHighContrast);
  const [signingOut, setSigningOut] = useState(false);
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [pushAsked, setPushAsked] = useState(false);
  useEffect(() => {
    if (!user || typeof Notification === "undefined" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    void loadPushKey()
      .then(async (key) => {
        if (!disposed) setPushKey(key);
        if (key && Notification.permission === "granted") await enablePush(key);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [user]);
  const askPush = () => {
    if (!pushKey || !user) return;
    setPushAsked(true);
    // Invoke the native prompt synchronously in the click (required by mobile browsers).
    const permission = enablePush(pushKey);
    void courierDatabase()
      .then(async (db) => {
        const tx = db.transaction("meta", "readwrite");
        const meta = courierMeta.parse(await tx.store.get("current"));
        if (meta.userId === user.id)
          await tx.store.put({ ...meta, notificationPrompted: true }, "current");
        await tx.done;
      })
      .catch(() => undefined);
    void permission.catch(() => {
      toast.error(
        "No pudimos activar las notificaciones. Los cambios siguen disponibles en «Mi ruta».",
      );
    });
  };

  useEffect(() => {
    const reconnect = () => {
      void router.invalidate();
    };
    window.addEventListener("online", reconnect);
    return () => {
      window.removeEventListener("online", reconnect);
    };
  }, [router]);

  useEffect(() => {
    if (status.sessionStatus !== "active") queryClient.setQueryData(sessionQuery.queryKey, null);
  }, [status.sessionStatus, queryClient]);

  useEffect(() => {
    // DOM types describe current browsers; older supported devices may lack persistence.
    const storage = navigator.storage as Partial<StorageManager> | undefined;
    if (user) void storage?.persist?.().catch(() => undefined);
  }, [user]);

  // The phone's light or dark unless the courier chose high contrast (feature 006, FR-015a);
  // the panel follows its own choice again after.
  useEffect(() => {
    const root = document.documentElement;
    const scheme = courierScheme(highContrast);
    if (scheme) root.dataset["scheme"] = scheme;
    else delete root.dataset["scheme"];
    return () => {
      delete root.dataset["scheme"];
    };
  }, [highContrast]);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      await navigate({ to: "/ingresar" });
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No pudimos cerrar la sesión. Intenta de nuevo.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  const warning = sessionWarning(
    status.meta?.sessionExpiresAt ?? status.view?.sessionExpiresAt,
    now(),
  );
  const oldPending = hasOldPending(status.pending, new Date());
  const totalPending = status.pending.length + status.pendingPhotos;
  const syncNotice = useRef({ syncing: false, hadPending: false });
  useEffect(() => {
    // Notify attempts with pending work, not every idle refresh (design-system.md §8).
    const previous = syncNotice.current;
    syncNotice.current = {
      syncing: status.syncing,
      hadPending: status.syncing && (previous.hadPending || totalPending > 0),
    };
    if (status.syncing || !previous.syncing || !previous.hadPending) return;
    if (status.offline || status.refusal) {
      toast.error(
        status.offline ? "Sin conexión. Tus pendientes siguen guardados." : status.refusal,
        {
          id: "courier-sync",
          classNames: { actionButton: "min-h-12 min-w-12" },
          ...(user && {
            action: {
              label: "Reintentar",
              onClick: () => void synchronizeNow(user.id),
            },
          }),
        },
      );
    } else if (totalPending === 0) {
      toast.success("Pendientes sincronizados.", { id: "courier-sync" });
    }
  }, [status.syncing, status.offline, status.refusal, totalPending, user]);

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-paper">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-sm bg-sheet px-4 py-3 text-label-l text-on-surface shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        {/* Pizarra only in the header and the navigation bar (feature 006, FR-015a). The header
          scrolls away with the page, so it never covers part of a control; the bar stays. */}
        <header className="bg-rail text-on-rail">
          <div className="mx-auto flex h-16 w-full max-w-xl items-center gap-1 pr-2 pl-4">
            <Wordmark className="mr-auto h-9 w-fit text-accent" />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alto contraste"
              aria-pressed={highContrast}
              className={cn(
                railButton,
                highContrast && "bg-accent text-on-accent hover:bg-accent hover:text-on-accent",
              )}
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
              className={railButton}
              disabled={signingOut || !user}
              onClick={() => void onSignOut()}
            >
              <Icon symbol={LogoutIcon} />
            </Button>
          </div>
        </header>
        {/* The sync strip reads calmly on pizarra under the header and scrolls away, so it never
          covers the screen's controls (approved app del mensajero, US3 scenario 2). */}
        {(status.offline || status.syncing || totalPending > 0) && (
          <div role="status" className="bg-rail-raised text-body-m text-on-rail">
            <div className="mx-auto flex max-w-xl items-start gap-2.5 px-4 py-2.5">
              <Icon
                symbol={status.offline ? CloudOffIcon : SyncIcon}
                size={20}
                className="mt-0.5 text-rail-warning"
              />
              <span>
                {status.offline ? "Sin conexión — " : status.syncing ? "Sincronizando — " : ""}
                {pendingLabel(status.pending.length)}
                {status.pendingPhotos > 0 &&
                  ` · ${String(status.pendingPhotos)} ${status.pendingPhotos === 1 ? "foto pendiente" : "fotos pendientes"}`}
                {status.offline && (
                  <span className="text-on-rail-variant">
                    . Se envían solos cuando vuelva la señal.
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
        {/* Keep actions scrollable above the fixed navigation and sync snackbars (FR-038). */}
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-64 outline-none"
        >
          <div className="mb-4 flex flex-col gap-3">
            {status.sessionStatus === "withdrawn" ? (
              <p
                role="alert"
                className="rounded-sm bg-error-container p-3 text-body-l text-on-error-container"
              >
                Tu acceso fue retirado. Tus registros pendientes siguen guardados; comunícate con el
                coordinador.
              </p>
            ) : warning === "expired" || status.sessionStatus === "expired" ? (
              <div
                role="alert"
                className="rounded-sm bg-warning-container p-3 text-body-l text-on-warning-container"
              >
                <p>
                  Tu sesión venció. Puedes seguir trabajando; tus registros quedan guardados hasta
                  que ingreses de nuevo.
                </p>
                <Link
                  to="/ingresar"
                  className="mt-2 inline-flex min-h-12 items-center font-medium underline underline-offset-4"
                >
                  Ingresar de nuevo
                </Link>
              </div>
            ) : warning === "soon" ? (
              <p
                role="status"
                className="rounded-sm bg-warning-container p-3 text-body-l text-on-warning-container"
              >
                Tu sesión vence en 2 días o menos. Sincroniza tus pendientes e ingresa de nuevo
                antes de salir a una ruta.
              </p>
            ) : null}
            {oldPending && (
              <p
                role="alert"
                className="rounded-sm bg-warning-container p-3 text-body-l text-on-warning-container"
              >
                Hay registros pendientes desde hace más de 2 horas. Busca señal para enviarlos; si
                no llegan, comunícate con el coordinador.
              </p>
            )}
            {/* One actionable refusal across courier screens, including withdrawn access (T099). */}
            {status.refusal && status.sessionStatus !== "expired" && (
              <div
                role="alert"
                className="rounded-sm bg-error-container p-3 text-body-l text-on-error-container"
              >
                <p>{status.refusal}</p>
                {user && (
                  <Button
                    variant="ghost"
                    className="mt-2 text-on-error-container"
                    disabled={status.syncing}
                    onClick={() => void synchronizeNow(user.id)}
                  >
                    Reintentar sincronización
                  </Button>
                )}
              </div>
            )}
            <InstallHint />
          </div>
          {pushKey &&
            !pushAsked &&
            !status.meta?.notificationPrompted &&
            typeof Notification !== "undefined" &&
            Notification.permission === "default" && (
              <aside className="flex flex-col gap-2 rounded-md bg-secondary-container p-4 text-on-secondary-container">
                <p className="text-body-l">
                  Recibe avisos cuando el coordinador cambie tu ruta, incluso con la app cerrada.
                </p>
                <Button variant="outline" className="self-start" onClick={askPush}>
                  Activar notificaciones
                </Button>
              </aside>
            )}
          <Outlet />
        </main>
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-rail-line bg-rail pb-[env(safe-area-inset-bottom)]"
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
                    className="flex flex-1 flex-col items-center justify-center gap-1 rounded-sm text-label-m text-on-rail-variant outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:text-on-rail"
                  >
                    <span
                      className={cn(
                        "state-layer flex h-8 w-16 items-center justify-center rounded-full",
                        active && "bg-accent text-on-accent",
                      )}
                    >
                      <Icon symbol={active ? destination.activeIcon : destination.icon} />
                    </span>
                    {destination.label}
                    {destination.to === "/mensajero/pendientes" && totalPending > 0 && (
                      <span
                        className="mt-0.5 rounded-full bg-rail-warning px-2 text-label-m text-rail tabular-nums"
                        aria-label={`${String(status.pending.length)} acciones y ${String(status.pendingPhotos)} fotos pendientes`}
                      >
                        {status.pending.length}
                        {status.pendingPhotos > 0 &&
                          ` · ${String(status.pendingPhotos)} ${status.pendingPhotos === 1 ? "foto" : "fotos"}`}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <Toaster
        // T101 / FR-038: courier notices sit above navigation (z-20), below sheets (z-50).
        offset={aboveNavigationBar}
        mobileOffset={aboveNavigationBar}
        className="toaster group !z-40"
      />
    </>
  );
}
