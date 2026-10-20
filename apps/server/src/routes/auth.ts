import {
  accountChangeRefusal,
  accountCreateInput,
  accountRoleInput,
  accountTargetInput,
  accountUpdateInput,
  passwordSignInInput,
  type UserRole,
} from "@domy/domain";
import { and, eq, ne, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import type { z } from "zod";
import type { AppEnv } from "../app.ts";
import { createAuth } from "../auth.ts";
import { couriers, sessions, users } from "../db/schema/index.ts";
import { recordAudit } from "../lib/audit.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { diffValues } from "../lib/master-data.ts";

/**
 * The rules Better Auth does not have, around its endpoints (research R5): the per-account
 * lockout (FR-033), the last active owner (FR-032), and the audit of account changes
 * (FR-036). R18/T130 exposes only the approved native HTTP paths below.
 */

const maxFailures = 5;
const lockMs = 15 * 60 * 1000;
const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function locked(until: Date): AppError {
  return new AppError("account_locked", {
    message: `Demasiados intentos fallidos. Podrás ingresar de nuevo a las ${timeFormat.format(until)}, o recupera tu contraseña.`,
    details: { retryAt: until.toISOString() },
  });
}

/** The request's JSON body, leaving the original request intact for Better Auth. */
async function bodyOf<Schema extends z.ZodType>(
  c: Context<AppEnv>,
  schema: Schema,
): Promise<{ request: Request; body: z.output<Schema> }> {
  const request = c.req.raw.clone();
  const input: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    throw new AppError("invalid_request", {
      message: "Revisa los datos de la cuenta e intenta de nuevo.",
      fields,
    });
  }
  return { request, body: result.data };
}

/** A native failing response must roll back before it can leave the transaction (R18). */
class AuthResponseRollback extends Error {
  readonly response: Response;
  constructor(response: Response) {
    super("Authentication request refused");
    this.response = response;
  }
}

type AccountOperation =
  | { kind: "create"; email: string }
  | { kind: "profile"; userId: string }
  | { kind: "role"; userId: string; role: UserRole }
  | { kind: "deactivate" | "reactivate" | "end_sessions"; userId: string };

/** T130/T131: native account writes, invariant facts and audit have one PG boundary. */
async function forwardAudited(
  c: Context<AppEnv>,
  request: Request,
  operation: AccountOperation,
): Promise<Response> {
  try {
    return await c.get("db").transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('domy:account-administration', 0))`,
      );
      const auth = createAuth({ ...c.get("authConfig"), db: tx });
      const actor = await auth.api.getSession({ headers: request.headers });
      if (!actor || actor.user.banned === true) throw new AppError("unauthenticated");
      if (actor.user.role !== "owner") throw new AppError("forbidden");

      const [before] =
        operation.kind === "create"
          ? []
          : await tx.select().from(users).where(eq(users.id, operation.userId)).for("update");
      if (operation.kind !== "create" && !before) {
        throw new AppError("not_found", { message: "No encontramos esa cuenta." });
      }
      if (before) {
        const [otherOwner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, "owner"), eq(users.banned, false), ne(users.id, before.id)))
          .limit(1);
        const [linked] = await tx
          .select({ id: couriers.id })
          .from(couriers)
          .where(eq(couriers.userId, before.id))
          .limit(1);
        const refusal = accountChangeRefusal(
          { role: before.role, isActive: !before.banned },
          {
            role: operation.kind === "role" ? operation.role : before.role,
            isActive:
              operation.kind === "deactivate"
                ? false
                : operation.kind === "reactivate"
                  ? true
                  : !before.banned,
          },
          { hasOtherActiveOwner: otherOwner !== undefined, hasCourierLink: linked !== undefined },
        );
        if (refusal) throw new AppError(refusal);
      }
      const previousSessions =
        operation.kind === "end_sessions"
          ? await tx
              .select({ id: sessions.id })
              .from(sessions)
              .where(eq(sessions.userId, operation.userId))
          : [];
      const response = await auth.handler(request);
      if (!response.ok) throw new AuthResponseRollback(response);

      const [after] = await tx
        .select()
        .from(users)
        .where(
          operation.kind === "create"
            ? eq(sql`lower(${users.email})`, operation.email.toLowerCase())
            : eq(users.id, operation.userId),
        );
      if (!after) throw new Error("Successful account operation did not persist a user");
      const changes: Record<string, unknown> = before
        ? diffValues(
            { name: before.name, email: before.email, role: before.role, isActive: !before.banned },
            { name: after.name, email: after.email, role: after.role, isActive: !after.banned },
          )
        : { name: [null, after.name], email: [null, after.email], role: [null, after.role] };
      if (operation.kind === "end_sessions") {
        const remaining = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, operation.userId));
        if (previousSessions.length !== remaining.length)
          changes["sessions"] = [previousSessions.length, remaining.length];
      }
      if (Object.keys(changes).length > 0) {
        await recordAudit(tx, {
          entityType: "user",
          entityId: after.id,
          action: !before
            ? "created"
            : before.banned !== after.banned
              ? after.banned
                ? "deactivated"
                : "reactivated"
              : "updated",
          changes,
          actorUserId: actor.user.id,
          occurredAt: c.get("clock")(),
        });
      }
      return response;
    });
  } catch (error) {
    if (error instanceof AuthResponseRollback) return error.response;
    throw error;
  }
}

export const authRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    // R18/T130: Hono can decode a static path before dispatch. Only canonical ASCII
    // auth paths are exposed; encoded callback query parameters remain untouched.
    if (new URL(c.req.raw.url).pathname.includes("%")) throw new AppError("not_found");
    await next();
  })
  // Five consecutive failures lock password sign-in for 15 minutes; open sessions stay.
  .post("/sign-in/email", async (c) => {
    const { request, body } = await bodyOf(c, passwordSignInInput);
    const db = c.get("db");
    const now = c.get("clock")();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, body.email.toLowerCase()));
    if (user?.lockedUntil && user.lockedUntil > now) throw locked(user.lockedUntil);

    const response = await c.get("auth").handler(request);
    if (!user) return response;
    if (response.status === 401) {
      const failures = user.failedSignInCount + 1;
      const lockedUntil = failures >= maxFailures ? new Date(now.getTime() + lockMs) : null;
      await db
        .update(users)
        .set({ failedSignInCount: lockedUntil ? 0 : failures, lockedUntil })
        .where(eq(users.id, user.id));
      if (lockedUntil) throw locked(lockedUntil);
    } else if (response.ok && (user.failedSignInCount > 0 || user.lockedUntil)) {
      await db
        .update(users)
        .set({ failedSignInCount: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    }
    return response;
  })
  .post("/admin/create-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountCreateInput);
    return forwardAudited(c, request, { kind: "create", email: body.email });
  })
  .post("/admin/update-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountUpdateInput);
    return forwardAudited(c, request, { kind: "profile", userId: body.userId });
  })
  .post("/admin/set-role", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountRoleInput);
    return forwardAudited(c, request, { kind: "role", ...body });
  })
  .post("/admin/ban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    return forwardAudited(c, request, { kind: "deactivate", ...body });
  })
  .post("/admin/unban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    return forwardAudited(c, request, { kind: "reactivate", ...body });
  })
  .post("/admin/revoke-user-sessions", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    return forwardAudited(c, request, { kind: "end_sessions", ...body });
  })
  .get("/admin/list-users", requireRole("owner"), (c) => c.get("auth").handler(c.req.raw))
  // Keep the native recovery callback as well as its form submission (FR-030).
  .on("GET", ["/get-session", "/reset-password/:token"], (c) => c.get("auth").handler(c.req.raw))
  .on(
    "POST",
    ["/sign-out", "/request-password-reset", "/reset-password", "/change-password"],
    (c) => c.get("auth").handler(c.req.raw),
  )
  .all("*", () => {
    throw new AppError("not_found");
  });
