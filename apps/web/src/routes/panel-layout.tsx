import AddBoxIcon from "@material-symbols/svg-400/rounded/add_box.svg?react";
import DashboardIcon from "@material-symbols/svg-400/rounded/dashboard.svg?react";
import GroupIcon from "@material-symbols/svg-400/rounded/group.svg?react";
import HistoryIcon from "@material-symbols/svg-400/rounded/history.svg?react";
import LogoutIcon from "@material-symbols/svg-400/rounded/logout.svg?react";
import ManageHistoryIcon from "@material-symbols/svg-400/rounded/manage_history.svg?react";
import MapIcon from "@material-symbols/svg-400/rounded/map.svg?react";
import PostAddIcon from "@material-symbols/svg-400/rounded/post_add.svg?react";
import SellIcon from "@material-symbols/svg-400/rounded/sell.svg?react";
import StorefrontIcon from "@material-symbols/svg-400/rounded/storefront.svg?react";
import TruckIcon from "@material-symbols/svg-400/rounded/local_shipping.svg?react";
import TwoWheelerIcon from "@material-symbols/svg-400/rounded/two_wheeler.svg?react";
import type { UserRole } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Icon, type Symbol } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
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

type NavigationItem = {
  to:
    | "/"
    | "/envios/nuevo"
    | "/envios/masivo"
    | "/historial"
    | "/clientes"
    | "/mensajeros"
    | "/transportadoras"
    | "/barrios"
    | "/tarifario"
    | "/auditoria"
    | "/usuarios";
  label: string;
  icon: Symbol;
  roles: UserRole[];
};

const office: UserRole[] = ["owner", "dispatcher"];

/** Navigation of the dispatch panel, in groups; each feature adds its destinations. */
const navigation: { label: string | null; items: NavigationItem[] }[] = [
  {
    label: null,
    items: [
      { to: "/", label: "Tablero", icon: DashboardIcon, roles: office },
      { to: "/envios/nuevo", label: "Nuevo envío", icon: AddBoxIcon, roles: office },
      { to: "/envios/masivo", label: "Registro masivo", icon: PostAddIcon, roles: office },
      { to: "/historial", label: "Historial", icon: HistoryIcon, roles: office },
    ],
  },
  {
    label: "Datos maestros",
    items: [
      { to: "/clientes", label: "Clientes", icon: StorefrontIcon, roles: office },
      { to: "/mensajeros", label: "Mensajeros", icon: TwoWheelerIcon, roles: office },
      { to: "/transportadoras", label: "Transportadoras", icon: TruckIcon, roles: office },
      { to: "/barrios", label: "Barrios", icon: MapIcon, roles: office },
      { to: "/tarifario", label: "Tarifario", icon: SellIcon, roles: office },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/usuarios", label: "Usuarios", icon: GroupIcon, roles: ["owner"] },
      { to: "/auditoria", label: "Auditoría", icon: ManageHistoryIcon, roles: ["owner"] },
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

  const onSignOut = async () => {
    await signOut();
    queryClient.clear();
    await navigate({ to: "/ingresar" });
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 justify-center px-4 text-title-l text-primary">
          Domy
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
                    .map((item) => (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          isActive={
                            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
                          }
                          tooltip={item.label}
                          render={<Link to={item.to} />}
                        >
                          <Icon symbol={item.icon} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 border-b border-outline-variant px-2">
          <SidebarTrigger aria-label="Mostrar u ocultar el menú" />
          <Link
            to="/cuenta"
            className="flex-1 text-title-m text-on-surface underline-offset-4 hover:underline"
          >
            {user.name}
          </Link>
          <Button variant="ghost" onClick={() => void onSignOut()}>
            <Icon symbol={LogoutIcon} size={20} />
            Cerrar sesión
          </Button>
        </header>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
