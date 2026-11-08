import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet } from "@tanstack/react-router";

/**
 * The root loads with every page, the public ones included, so it holds nothing else: tooltips
 * and snackbars live in the panel and courier layouts that use them (constitution: public
 * tracking within 3 s on a weak mobile connection).
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
});

function Root() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
