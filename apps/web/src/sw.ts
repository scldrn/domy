/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { courierPushMessage, noticeText } from "@domy/domain";
import { isPublicPagePath } from "./lib/public-route";

/**
 * The service worker of the installable app (feature 003, research R2): it keeps the built
 * app shell, so a loaded route opens without signal (FR-022, SC-003). It caches no API
 * responses: route data lives in IndexedDB (research R3). Push notifications use the shared
 * Spanish labels and expose no recipient data (research R8).
 */

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page of the app is the same shell; the API is always the network's.
registerRoute(
  ({ request, sameOrigin, url }) =>
    request.mode === "navigate" &&
    sameOrigin &&
    !url.pathname.startsWith("/api/") &&
    !isPublicPagePath(url.pathname),
  createHandlerBoundToURL("index.html"),
);

// FR-040: ignore malformed transport data; never display untrusted text or recipient data.
self.addEventListener("push", (event) => {
  let input: unknown;
  try {
    input = event.data?.json();
  } catch {
    return;
  }
  const parsed = courierPushMessage.safeParse(input);
  if (!parsed.success) return;
  const { type, routeNumber } = parsed.data;
  event.waitUntil(
    self.registration.showNotification(
      routeNumber === undefined ? "Domy" : `Domy · Ruta ${String(routeNumber)}`,
      {
        body: noticeText(type, routeNumber === undefined ? {} : { routeNumber }),
        icon: "/icons/icon-192.png",
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL("/mensajero", self.location.origin).href;
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(target);
        await existing.focus();
      } else await self.clients.openWindow(target);
    })(),
  );
});
