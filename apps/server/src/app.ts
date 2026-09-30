import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { requestId, type RequestIdVariables } from "hono/request-id";
import type { Logger } from "pino";
import type { UserRole } from "@domy/domain";
import type { Auth } from "./auth.ts";
import type { Db } from "./db/client.ts";
import type { Clock } from "./lib/clock.ts";
import { handleError } from "./lib/errors.ts";

export type AppDeps = {
  db: Db;
  auth: Auth;
  clock: Clock;
  logger: Logger;
  /** Built web app served in production; absent in development and tests. */
  webDist?: string;
  /** End-to-end tests only: lets a test move the server clock (research R9). */
  setNow?: (instant: string) => void;
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
    .onError(handleError)
    .on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw));

  const { setNow } = deps;
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
