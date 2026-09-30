import DashboardIcon from "@material-symbols/svg-400/rounded/dashboard.svg?react";
import LogoutIcon from "@material-symbols/svg-400/rounded/logout.svg?react";
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { sessionQuery, signOut } from "@/features/auth/session";

type NavigationItem = { to: "/"; label: string; icon: Symbol; roles: UserRole[] };

/** Navigation of the dispatch panel; each feature adds its destinations. */
const navigation: NavigationItem[] = [
  { to: "/", label: "Tablero", icon: DashboardIcon, roles: ["owner", "dispatcher"] },
];

export const Route = createFileRoute("/_panel")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query(sessionQuery);
    if (!user) {
      throw redirect({ to: "/ingresar", search: { redirect: location.href } });
    }
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
          <SidebarGroup>
            <SidebarMenu>
              {navigation
                .filter((item) => item.roles.includes(user.role))
                .map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={pathname === item.to}
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
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 border-b border-outline-variant px-2">
          <SidebarTrigger aria-label="Mostrar u ocultar el menú" />
          <span className="flex-1 text-title-m text-on-surface">{user.name}</span>
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
