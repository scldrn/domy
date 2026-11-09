import AddBoxFillIcon from "@material-symbols/svg-400/rounded/add_box-fill.svg?react";
import CampaignFillIcon from "@material-symbols/svg-400/rounded/campaign-fill.svg?react";
import DashboardFillIcon from "@material-symbols/svg-400/rounded/dashboard-fill.svg?react";
import GroupFillIcon from "@material-symbols/svg-400/rounded/group-fill.svg?react";
import HistoryFillIcon from "@material-symbols/svg-400/rounded/history-fill.svg?react";
import ManageHistoryFillIcon from "@material-symbols/svg-400/rounded/manage_history-fill.svg?react";
import MapFillIcon from "@material-symbols/svg-400/rounded/map-fill.svg?react";
import PostAddFillIcon from "@material-symbols/svg-400/rounded/post_add-fill.svg?react";
import RouteFillIcon from "@material-symbols/svg-400/rounded/route-fill.svg?react";
import SellFillIcon from "@material-symbols/svg-400/rounded/sell-fill.svg?react";
import StorefrontFillIcon from "@material-symbols/svg-400/rounded/storefront-fill.svg?react";
import TruckFillIcon from "@material-symbols/svg-400/rounded/local_shipping-fill.svg?react";
import TwoWheelerFillIcon from "@material-symbols/svg-400/rounded/two_wheeler-fill.svg?react";
import AddBoxIcon from "@material-symbols/svg-400/rounded/add_box.svg?react";
import CampaignIcon from "@material-symbols/svg-400/rounded/campaign.svg?react";
import DashboardIcon from "@material-symbols/svg-400/rounded/dashboard.svg?react";
import GroupIcon from "@material-symbols/svg-400/rounded/group.svg?react";
import HistoryIcon from "@material-symbols/svg-400/rounded/history.svg?react";
import AddIcon from "@material-symbols/svg-400/rounded/add.svg?react";
import LogoutIcon from "@material-symbols/svg-400/rounded/logout.svg?react";
import ManageHistoryIcon from "@material-symbols/svg-400/rounded/manage_history.svg?react";
import MapIcon from "@material-symbols/svg-400/rounded/map.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import PostAddIcon from "@material-symbols/svg-400/rounded/post_add.svg?react";
import SellIcon from "@material-symbols/svg-400/rounded/sell.svg?react";
import StorefrontIcon from "@material-symbols/svg-400/rounded/storefront.svg?react";
import TruckIcon from "@material-symbols/svg-400/rounded/local_shipping.svg?react";
import TwoWheelerIcon from "@material-symbols/svg-400/rounded/two_wheeler.svg?react";
import SettingsIcon from "@material-symbols/svg-400/rounded/settings.svg?react";
import SettingsFillIcon from "@material-symbols/svg-400/rounded/settings-fill.svg?react";
import { userRoleLabels, type UserRole } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Icon, type Symbol } from "@/components/icon";
import { LogoSymbol, Wordmark } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { GlobalSearch, LastUpdate } from "@/features/board/global-search";
import { Button, buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { sessionQuery, signOut } from "@/features/auth/session";
import { useNotificationSync } from "@/features/notifications/use-notification-sync";
import { cn } from "@/lib/cn";
import { usePanelTheme } from "@/lib/theme";

type NavigationItem = {
  to:
    | "/"
    | "/envios/nuevo"
    | "/envios/masivo"
    | "/historial"
    | "/notificar"
    | "/rutas"
    | "/clientes"
    | "/mensajeros"
    | "/transportadoras"
    | "/barrios"
    | "/tarifario"
    | "/auditoria"
    | "/usuarios"
    | "/configuracion";
  label: string;
  icon: Symbol;
  /** Filled variant for the current page (design-system.md §7.1). */
  activeIcon: Symbol;
  roles: UserRole[];
};

const office: UserRole[] = ["owner", "dispatcher"];

/** Navigation of the dispatch panel, in groups; each feature adds its destinations. */
const navigation: { label: string | null; items: NavigationItem[] }[] = [
  {
    label: null,
    items: [
      {
        to: "/",
        label: "Tablero",
        icon: DashboardIcon,
        activeIcon: DashboardFillIcon,
        roles: office,
      },
      {
        to: "/envios/nuevo",
        label: "Nuevo envío",
        icon: AddBoxIcon,
        activeIcon: AddBoxFillIcon,
        roles: office,
      },
      {
        to: "/envios/masivo",
        label: "Registro masivo",
        icon: PostAddIcon,
        activeIcon: PostAddFillIcon,
        roles: office,
      },
      {
        to: "/rutas",
        label: "Rutas",
        icon: RouteIcon,
        activeIcon: RouteFillIcon,
        roles: office,
      },
      {
        to: "/historial",
        label: "Historial",
        icon: HistoryIcon,
        activeIcon: HistoryFillIcon,
        roles: office,
      },
      {
        to: "/notificar",
        label: "Notificar clientes",
        icon: CampaignIcon,
        activeIcon: CampaignFillIcon,
        roles: office,
      },
    ],
  },
  {
    label: "Datos maestros",
    items: [
      {
        to: "/clientes",
        label: "Clientes",
        icon: StorefrontIcon,
        activeIcon: StorefrontFillIcon,
        roles: office,
      },
      {
        to: "/mensajeros",
        label: "Mensajeros",
        icon: TwoWheelerIcon,
        activeIcon: TwoWheelerFillIcon,
        roles: office,
      },
      {
        to: "/transportadoras",
        label: "Transportadoras",
        icon: TruckIcon,
        activeIcon: TruckFillIcon,
        roles: office,
      },
      { to: "/barrios", label: "Barrios", icon: MapIcon, activeIcon: MapFillIcon, roles: office },
      {
        to: "/tarifario",
        label: "Tarifario",
        icon: SellIcon,
        activeIcon: SellFillIcon,
        roles: office,
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        to: "/configuracion",
        label: "Configuración",
        icon: SettingsIcon,
        activeIcon: SettingsFillIcon,
        roles: ["owner"],
      },
      {
        to: "/usuarios",
        label: "Usuarios",
        icon: GroupIcon,
        activeIcon: GroupFillIcon,
        roles: ["owner"],
      },
      {
        to: "/auditoria",
        label: "Auditoría",
        icon: ManageHistoryIcon,
        activeIcon: ManageHistoryFillIcon,
        roles: ["owner"],
      },
    ],
  },
];

export const Route = createFileRoute("/_panel")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(sessionQuery);
    if (!user) {
      throw redirect({ to: "/ingresar", search: { redirect: location.href } });
    }
    // The panel is for the office; couriers have their own app (feature 003).
    if (user.role === "courier") throw redirect({ to: "/mensajero" });
    return { user };
  },
  component: PanelLayout,
});

function PanelLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const theme = usePanelTheme();
  const notificationSnapshot = useNotificationSync(user.id);
  const notificationIntents = notificationSnapshot.data?.intents ?? [];
  const notificationDates = [...new Set(notificationIntents.map((intent) => intent.serviceDate))];
  const readyNotificationCount = notificationIntents.filter(
    (intent) => intent.phase === "ready",
  ).length;
  const preparedNotificationCount = notificationIntents.filter(
    (intent) => intent.phase === "prepared",
  ).length;

  const onSignOut = async () => {
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
    }
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <a
          href="#contenido"
          className="sr-only z-50 rounded-sm bg-sheet px-4 py-3 text-label-l text-on-surface shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:min-h-12 focus:min-w-12 focus:inline-flex focus:items-center"
        >
          Saltar al contenido
        </a>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-5 pt-6 pb-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            <Link
              to="/"
              aria-label="Domy, ir al tablero"
              className="flex w-fit flex-col rounded-sm text-on-rail"
            >
              <Wordmark className="h-12.5 w-fit group-data-[collapsible=icon]:hidden" />
              <LogoSymbol className="hidden h-9 w-fit group-data-[collapsible=icon]:block" />
              <span className="-mt-2.5 text-body-s text-on-rail-variant group-data-[collapsible=icon]:hidden">
                de Cohex
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {navigation
              .filter((group) => group.items.some((item) => item.roles.includes(user.role)))
              .map((group) => (
                <SidebarGroup key={group.label ?? "main"}>
                  {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                  <SidebarMenu>
                    {group.items
                      .filter((item) => item.roles.includes(user.role))
                      .map((item) => {
                        const active =
                          item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton
                              isActive={active}
                              tooltip={item.label}
                              render={<Link to={item.to} />}
                            >
                              <Icon symbol={active ? item.activeIcon : item.icon} />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
          </SidebarContent>
          <SidebarFooter className="border-t border-rail-raised px-3 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            <div className="flex items-center gap-1">
              <Link
                to="/cuenta"
                aria-label={`Mi cuenta: ${user.name}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-2 py-2 text-on-rail hover:bg-on-rail/8"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rail-raised text-label-l text-on-rail"
                >
                  {initials(user.name)}
                </span>
                <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-label-l">{user.name}</span>
                  <span className="text-body-s text-on-rail-variant">
                    {userRoleLabels[user.role]}
                  </span>
                </span>
              </Link>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Cerrar sesión"
                      className="text-on-rail-variant hover:text-on-rail group-data-[collapsible=icon]:hidden"
                      onClick={() => void onSignOut()}
                    />
                  }
                >
                  <Icon symbol={LogoutIcon} />
                </TooltipTrigger>
                <TooltipContent>Cerrar sesión</TooltipContent>
              </Tooltip>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur">
            {/* Top app bar (design-system.md §7): search, theme, and the one lime action. */}
            <div className="mx-auto flex h-18 w-full max-w-380 items-center gap-2 px-4 md:px-8">
              <SidebarTrigger aria-label="Mostrar u ocultar el menú" className="-ml-3" />
              <GlobalSearch />
              {pathname === "/" && <LastUpdate />}
              <span className="flex-1" />
              <ThemeSwitch shown={theme.shown} onToggle={theme.toggle} />
              <Link
                to="/envios/masivo"
                aria-current={pathname === "/envios/masivo" ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "max-lg:hidden aria-[current=page]:border-on-surface aria-[current=page]:font-bold",
                )}
              >
                <Icon symbol={PostAddIcon} />
                Registro masivo
              </Link>
              {/* On its own page it is the current page, not a second lime action (approved "Nuevo envío"). */}
              <Link
                to="/envios/nuevo"
                aria-current={pathname === "/envios/nuevo" ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: pathname === "/envios/nuevo" ? "outline" : "accent" }),
                  "max-sm:size-12 max-sm:px-0 aria-[current=page]:border-on-surface aria-[current=page]:font-bold",
                )}
              >
                <Icon symbol={AddIcon} />
                <span className="hidden sm:inline">Nuevo envío</span>
                <span className="sr-only sm:hidden">Nuevo envío</span>
              </Link>
            </div>
            <PhoneDestinations role={user.role} pathname={pathname} />
          </header>
          <div
            id="contenido"
            tabIndex={-1}
            className="mx-auto w-full max-w-380 px-4 pt-4 pb-16 outline-none md:px-8"
          >
            {(notificationDates.length > 0 || notificationSnapshot.data?.guidance) && (
              <aside
                role={notificationSnapshot.data?.guidance ? "alert" : "status"}
                aria-live="polite"
                className="mb-5 flex flex-col gap-3 rounded-sm border border-outline-variant bg-secondary-container p-4 text-on-secondary-container"
              >
                <p className="text-body-m">
                  {notificationSnapshot.data?.guidance ??
                    [
                      readyNotificationCount > 0
                        ? `${String(readyNotificationCount)} notificaciones esperan su registro.`
                        : null,
                      preparedNotificationCount > 0
                        ? `${String(preparedNotificationCount)} acciones necesitan que vuelvas a compartir el mensaje.`
                        : null,
                    ]
                      .filter((message) => message !== null)
                      .join(" ")}
                </p>
                {notificationDates.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {notificationDates.map((date) => (
                      <li key={date}>
                        <Link
                          to="/notificar"
                          search={{ date }}
                          className="inline-flex min-h-12 items-center rounded-sm px-3 text-label-l text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Revisar {date}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            )}
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

/**
 * Below 768 px the rail gives way to a row of destinations under the top bar
 * (design-system.md §2); the menu button still opens the full rail with the account.
 */
function PhoneDestinations({ role, pathname }: { role: UserRole; pathname: string }) {
  return (
    <nav aria-label="Destinos" className="bg-rail md:hidden">
      <ul className="relative flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
        {navigation
          .flatMap((group) => group.items)
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <li key={item.to} className="shrink-0">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-sm px-3 text-label-l whitespace-nowrap text-on-rail-variant outline-none hover:bg-on-rail/8 hover:text-on-rail focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent",
                    active &&
                      "bg-accent font-bold text-on-accent hover:bg-accent hover:text-on-accent",
                  )}
                >
                  <Icon symbol={active ? item.activeIcon : item.icon} size={20} />
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

function initials(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}
