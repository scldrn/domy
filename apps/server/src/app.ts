import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { routePath } from "hono/route";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "pino";
import type { UserRole } from "@domy/domain";
import { createAuth, type Auth, type AuthConfig } from "./auth.ts";
import type { Db } from "./db/client.ts";
import type { Clock } from "./lib/clock.ts";
import type { RuntimeState } from "./lib/runtime-lifecycle.ts";
import type { PhotoStorage } from "./lib/storage.ts";
import { sendNoticePushes, type PushConfig } from "./lib/push.ts";
import { AppError, handleError } from "./lib/errors.ts";
import { allowPublicRequest, type PublicRateLimitState } from "./lib/rate-limit.ts";
import { resolveClientAddress } from "./lib/client-address.ts";
import { isPublicApiPath, isPublicResponsePath, publicPathForLog } from "./lib/public-path.ts";
import { bulkRoutes } from "./routes/bulk.ts";
import { carrierRoutes } from "./routes/carriers.ts";
import { auditEventRoutes } from "./routes/audit-events.ts";
import { authRoutes } from "./routes/auth.ts";
import { courierAppRoutes } from "./routes/courier.ts";
import { courierRecordRoutes } from "./routes/courier-records.ts";
import { courierRoutes } from "./routes/couriers.ts";
import { exportRoutes } from "./routes/export.ts";
import { handoverRoutes } from "./routes/handovers.ts";
import { healthRoutes } from "./routes/health.ts";
import { merchantRoutes, pickupPointRoutes } from "./routes/merchants.ts";
import { rateCardRoutes } from "./routes/rate-card.ts";
import { routeRoutes } from "./routes/routes.ts";
import { municipalityRoutes, neighborhoodRoutes } from "./routes/neighborhoods.ts";
import { notificationRoutes } from "./routes/notifications.ts";
import { photoRoutes } from "./routes/photos.ts";
import { publicRoutes } from "./routes/public.ts";
import { rateZoneRoutes } from "./routes/rate-zones.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { shipmentRoutes } from "./routes/shipments.ts";

export type AppDeps = {
  db: Db;
  authConfig: AuthConfig;
  clock: Clock;
  logger: Logger;
  /** Validated canonical origin used to construct public merchant links. */
  publicBaseUrl: string;
  /** The private bucket of the courier's photos (feature 003, research R6). */
  storage: PhotoStorage;
  push?: PushConfig | null;
  /** Built web app served in production; absent in development and tests. */
  webDist?: string;
  /** Monotonic source for deterministic in-memory public rate-limit tests. */
  monotonicNow?: () => number;
  /** Exact optional peer IP of the reverse proxy allowed to supply X-Domy-Client-IP. */
  trustedProxyIp?: string;
  /** Exact validated HTTPS origin used by optional browser error reporting. */
  browserReportingOrigin?: string;
  /** Shared drain/readiness state; app-only callers receive a fresh per-app default. */
  runtime?: RuntimeState;
  /** End-to-end tests only: lets a test move the server clock (research R9). */
  setNow?: (instant: string) => void;
  /** End-to-end tests only: the recovery emails, to follow their links. */
  testEmails?: readonly { email: string; name: string; url: string }[];
};

export type AppEnv = {
  Variables: RequestIdVariables &
    Omit<AppDeps, "webDist" | "setNow" | "monotonicNow" | "runtime"> & {
      runtime: RuntimeState;
      auth: Auth;
      user: { id: string; name: string; role: UserRole };
      /** When the signed-in session ends; the courier app warns before it (feature 003, FR-003). */
      sessionExpiresAt: Date;
      noticeIds: string[];
    };
};

/** FR-011/FR-012, research R14: keep bearer pages and API responses private to caches/indexes. */
function setPublicResponseHeaders(c: Context<AppEnv>): void {
  if (!isPublicResponsePath(c.req.path)) return;
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex");
}

/** Research R14/R22: read the native transport peer; forwarding trust is explicit and opt-in. */
function nativePeerAddress(c: Context<AppEnv>): string | undefined {
  try {
    const address = getConnInfo(c).remote.address;
    return typeof address === "string" && address ? address : undefined;
  } catch {
    // app.request has no transport binding; the resolver maps it to the unknown bucket.
    return undefined;
  }
}

export function createApp(deps: AppDeps) {
  const auth = createAuth({ ...deps.authConfig, db: deps.db, logger: deps.logger });
  const runtime: RuntimeState = deps.runtime ?? { draining: false, readinessProbe: undefined };
  const publicRateLimitState: PublicRateLimitState = {
    buckets: new Map(),
    nextCleanupAt: 0,
  };
  const webDist = deps.webDist;
  const serveWebAssets = webDist ? serveStatic<AppEnv>({ root: webDist }) : undefined;
  const serveWebIndex = webDist
    ? serveStatic<AppEnv>({ root: webDist, path: "index.html" })
    : undefined;
  const publicSafeWebAssets: MiddlewareHandler<AppEnv> | undefined = serveWebAssets
    ? async (c, next) => {
        if (isPublicApiPath(c.req.path)) return next();
        return serveWebAssets(c, next);
      }
    : undefined;
  const publicSafeWebIndex: MiddlewareHandler<AppEnv> | undefined = serveWebIndex
    ? async (c, next) => {
        if (isPublicApiPath(c.req.path)) return next();
        return serveWebIndex(c, next);
      }
    : undefined;
  const app = new Hono<AppEnv>()
    .use(requestId({ limitLength: 0 }))
    .use(async (c, next) => {
      c.set("db", deps.db);
      c.set("auth", auth);
      c.set("authConfig", deps.authConfig);
      c.set("clock", deps.clock);
      c.set("storage", deps.storage);
      c.set("publicBaseUrl", deps.publicBaseUrl);
      c.set("push", deps.push ?? null);
      c.set("runtime", runtime);
      if (deps.trustedProxyIp !== undefined) c.set("trustedProxyIp", deps.trustedProxyIp);
      if (deps.browserReportingOrigin !== undefined)
        c.set("browserReportingOrigin", deps.browserReportingOrigin);
      const noticeIds: string[] = [];
      c.set("noticeIds", noticeIds);
      c.set("logger", deps.logger.child({ requestId: c.get("requestId") }));
      const started = performance.now();
      await next();
      // Every route transaction has finished; transport failure never delays its response.
      void sendNoticePushes(deps.db, noticeIds, deps.push ?? null, deps.logger);
      // Clients correct their clock with this header (research R9); it follows the fake clock.
      c.header("Date", deps.clock().toUTCString());
      c.get("logger").info(
        {
          method: c.req.method,
          path: publicPathForLog(c.req.path, routePath(c)),
          status: c.res.status,
          ms: Math.round(performance.now() - started),
        },
        "request",
      );
    })
    // Hardening of every answer (research R13): no framing, no MIME sniffing, no referrer to
    // other sites, and request bodies of at most 1 MB.
    .use(
      secureHeaders({
        xFrameOptions: "DENY",
        referrerPolicy: "strict-origin-when-cross-origin",
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcElem: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'"],
          // Fixed Base UI 1.8.0 and Sonner 2.0.8 style hashes; the empty hash permits no CSS.
          // csp-styles.spec.ts detects payload drift; review these hashes on dependency updates.
          styleSrcElem: [
            "'self'",
            "'sha256-kLmvWqfziFavKtqHqRsb90f006UAK2Dmd0It5Iz2KFA='",
            "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='",
            "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
          ],
          styleSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", "blob:"],
          fontSrc: ["'self'"],
          connectSrc: [
            "'self'",
            ...(deps.browserReportingOrigin === undefined ? [] : [deps.browserReportingOrigin]),
          ],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          formAction: ["'self'"],
          frameSrc: ["'none'"],
        },
      }),
    )
    .use(
      "/api/*",
      bodyLimit({
        maxSize: 1024 * 1024,
        onError: () => {
          throw new AppError("payload_too_large");
        },
      }),
    )
    .route("/health", healthRoutes)
    .use(async (c, next) => {
      setPublicResponseHeaders(c);
      if (isPublicApiPath(c.req.path)) {
        const now = deps.monotonicNow?.() ?? performance.now();
        const clientAddress = resolveClientAddress(
          nativePeerAddress(c),
          deps.trustedProxyIp,
          c.req.raw.headers.get("X-Domy-Client-IP") ?? undefined,
        );
        if (!allowPublicRequest(publicRateLimitState, clientAddress, now)) {
          throw new AppError("rate_limited");
        }
      }
      await next();
      setPublicResponseHeaders(c);
    })
    .onError(handleError)
    .notFound((c) =>
      isPublicApiPath(c.req.path)
        ? handleError(new AppError("link_not_found"), c)
        : c.text("404 Not Found", 404),
    )
    .route("/api/auth", authRoutes)
    .route("/api/notifications", notificationRoutes)
    .route("/api/shipments", shipmentRoutes)
    .route("/api/bulk", bulkRoutes)
    .route("/api/routes", routeRoutes)
    .route("/api/handovers", handoverRoutes)
    .route("/api/merchants", merchantRoutes)
    .route("/api/pickup-points", pickupPointRoutes)
    .route("/api/couriers", courierRoutes)
    .route("/api/rate-card", rateCardRoutes)
    .route("/api/audit-events", auditEventRoutes)
    .route("/api/export", exportRoutes)
    .route("/api/neighborhoods", neighborhoodRoutes)
    .route("/api/municipalities", municipalityRoutes)
    .route("/api/carriers", carrierRoutes)
    .route("/api/rate-zones", rateZoneRoutes)
    .route("/api/courier", courierAppRoutes)
    .route("/api/courier-records", courierRecordRoutes)
    .route("/api/photos", photoRoutes)
    .route("/api/settings", settingsRoutes)
    .route("/api/public", publicRoutes);

  const { setNow, testEmails } = deps;
  if (testEmails) {
    app.get("/api/test/emails", (c) => c.json({ items: testEmails }));
  }
  if (setNow) {
    app.post("/api/test/clock", async (c) => {
      const { now } = await c.req.json<{ now: string }>();
      setNow(now);
      return c.body(null, 204);
    });
  }

  if (publicSafeWebAssets) app.use("*", publicSafeWebAssets);
  if (publicSafeWebIndex) app.get("*", publicSafeWebIndex);

  return app;
}

export type AppType = ReturnType<typeof createApp>;

export type { Auth } from "./auth.ts";
