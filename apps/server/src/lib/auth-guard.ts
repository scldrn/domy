import type { UserRole } from "@domy/domain";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app.ts";
import { AppError } from "./errors.ts";

/** Loads the session and refuses users without one of the given roles (FR-031). */
export function requireRole(...allowed: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const result = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
    if (!result || result.user.banned === true) {
      throw new AppError("unauthenticated");
    }
    const role = result.user.role as UserRole;
    if (!allowed.includes(role)) {
      throw new AppError("forbidden");
    }
    c.set("user", { id: result.user.id, name: result.user.name, role });
    await next();
  });
}
