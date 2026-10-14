/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

/**
 * The service worker of the installable app (feature 003, research R2): it keeps the built
 * app shell, so a loaded route opens without signal (FR-022, SC-003). It caches no API
 * responses: route data lives in IndexedDB (research R3). Phone notifications come later
 * (research R8).
 */

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page of the app is the same shell; the API is always the network's.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }),
);
