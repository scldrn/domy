import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotFound, RouteError } from "./components/route-states";
import { queryClient } from "./lib/api-client";
import { routeTree } from "./route-tree.gen";
import "./styles/globals.css";

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
  // Search params stay plain text ("?q=3001234567&feeReview=true"): the default parser would
  // turn them into numbers and booleans. Route schemas validate them.
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
  stringifySearch: (search: Record<string, unknown>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined)
        params.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    const text = params.toString();
    return text ? `?${text}` : "";
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Browser error reporting, only when configured (research R14); loaded apart from the app.
const sentryDsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
if (sentryDsn) {
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE });
  });
}

// The installable app's service worker, in the built app only (feature 003, research R2). A
// new version waits for the app to close, so it never reloads a page mid-delivery.
if (import.meta.env.PROD) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
