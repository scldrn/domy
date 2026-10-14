import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
});

/** In the courier app, snackbars sit above the navigation bar (M3; design-system.md §7). */
const aboveNavigationBar = { bottom: "6.5rem" };

function Root() {
  const courierApp = useRouterState({
    select: (state) => state.location.pathname.startsWith("/mensajero"),
  });
  return (
    <TooltipProvider>
      <HeadContent />
      <Outlet />
      <Toaster
        {...(courierApp && { offset: aboveNavigationBar, mobileOffset: aboveNavigationBar })}
      />
    </TooltipProvider>
  );
}
