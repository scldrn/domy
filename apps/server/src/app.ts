import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "pino";
import type { UserRole } from "@domy/domain";
import type { Auth } from "./auth.ts";
import type { Db } from "./db/client.ts";
import type { Clock } from "./lib/clock.ts";
import { AppError, handleError } from "./lib/errors.ts";
import { bulkRoutes } from "./routes/bulk.ts";
import { carrierRoutes } from "./routes/carriers.ts";
import { auditEventRoutes } from "./routes/audit-events.ts";
import { authRoutes } from "./routes/auth.ts";
import { courierRoutes } from "./routes/couriers.ts";
import { exportRoutes } from "./routes/export.ts";
import { handoverRoutes } from "./routes/handovers.ts";
import { merchantRoutes, pickupPointRoutes } from "./routes/merchants.ts";
import { rateCardRoutes } from "./routes/rate-card.ts";
import { routeRoutes } from "./routes/routes.ts";
import { municipalityRoutes, neighborhoodRoutes } from "./routes/neighborhoods.ts";
import { rateZoneRoutes } from "./routes/rate-zones.ts";
import { shipmentRoutes } from "./routes/shipments.ts";

export type AppDeps = {
  db: Db;
  auth: Auth;
  clock: Clock;
  logger: Logger;
  /** Built web app served in production; absent in development and tests. */
  webDist?: string;
  /** End-to-end tests only: lets a test move the server clock (research R9). */
  setNow?: (instant: string) => void;
  /** End-to-end tests only: the recovery emails, to follow their links. */
  testEmails?: readonly { email: string; name: string; url: string }[];
};

export type AppEnv = {
  Variables: RequestIdVariables &
    Omit<AppDeps, "webDist" | "setNow"> & {
      user: { id: string; name: string; role: UserRole };
    };
};

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()
    .use(requestId())
    .use(async (c, next) => {
      c.set("db", deps.db);
      c.set("auth", deps.auth);
      c.set("clock", deps.clock);
      c.set("logger", deps.logger.child({ requestId: c.get("requestId") }));
      const started = performance.now();
      await next();
      // Clients correct their clock with this header (research R9); it follows the fake clock.
      c.header("Date", deps.clock().toUTCString());
      c.get("logger").info(
        {
          method: c.req.method,
          path: c.req.path,
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
        contentSecurityPolicy: { frameAncestors: ["'none'"] },
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
    .onError(handleError)
    .route("/api/auth", authRoutes)
    .on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw))
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
    .route("/api/rate-zones", rateZoneRoutes);

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

  if (deps.webDist) {
    app.use("*", serveStatic({ root: deps.webDist }));
    app.get("*", serveStatic({ root: deps.webDist, path: "index.html" }));
  }

  return app;
}

export type AppType = ReturnType<typeof createApp>;
