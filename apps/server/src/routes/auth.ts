import { and, eq, ne, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import type { AppEnv } from "../app.ts";
import { users } from "../db/schema/index.ts";
import { recordAudit } from "../lib/audit.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { diffValues } from "../lib/master-data.ts";

/**
 * The rules Better Auth does not have, around its endpoints (research R5): the per-account
 * lockout (FR-033), the last active owner (FR-032), and the audit of account changes
 * (FR-036). Everything else goes straight to Better Auth.
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
async function bodyOf<T>(c: Context<AppEnv>): Promise<{ request: Request; body: Partial<T> }> {
  const request = c.req.raw.clone();
  const body = (await c.req.raw.json().catch(() => ({}))) as Partial<T>;
  return { request, body };
}

async function findUser(c: Context<AppEnv>, id: string | undefined) {
  if (!id) return undefined;
  const [user] = await c.get("db").select().from(users).where(eq(users.id, id));
  return user;
}

/** True when no other active owner would remain without this user. */
async function isLastOwner(c: Context<AppEnv>, userId: string): Promise<boolean> {
  const [others] = await c
    .get("db")
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.banned, false), ne(users.id, userId)));
  return (others?.count ?? 0) === 0;
}

type AuditedChange = {
  entityId: string;
  action: "created" | "updated" | "deactivated" | "reactivated";
  changes: Record<string, unknown>;
} | null;

/** Forwards to Better Auth and records the change when it succeeded. */
async function forwardAudited(
  c: Context<AppEnv>,
  request: Request,
  audit: (response: Response) => AuditedChange | Promise<AuditedChange>,
): Promise<Response> {
  const response = await c.get("auth").handler(request);
  if (!response.ok) return response;
  const event = await audit(response.clone());
  if (event && Object.keys(event.changes).length > 0) {
    await recordAudit(c.get("db"), {
      entityType: "user",
      ...event,
      actorUserId: c.get("user").id,
      occurredAt: c.get("clock")(),
    });
  }
  return response;
}

export const authRoutes = new Hono<AppEnv>()
  // Five consecutive failures lock password sign-in for 15 minutes; open sessions stay.
  .post("/sign-in/email", async (c) => {
    const { request, body } = await bodyOf<{ email: string }>(c);
    const db = c.get("db");
    const now = c.get("clock")();
    const [user] = body.email
      ? await db
          .select()
          .from(users)
          .where(eq(sql`lower(${users.email})`, body.email.trim().toLowerCase()))
      : [];
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
    const { request } = await bodyOf(c);
    return forwardAudited(c, request, async (response) => {
      const { user } = (await response.json()) as {
        user: { id: string; name: string; email: string; role: string };
      };
      return {
        entityId: user.id,
        action: "created",
        changes: { name: [null, user.name], email: [null, user.email], role: [null, user.role] },
      };
    });
  })
  .post("/admin/update-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf<{ userId: string; data: Record<string, unknown> }>(c);
    const before = await findUser(c, body.userId);
    return forwardAudited(c, request, async () => {
      const after = await findUser(c, body.userId);
      if (!before || !after) return null;
      return {
        entityId: after.id,
        action: "updated",
        changes: diffValues(
          { name: before.name, email: before.email },
          { name: after.name, email: after.email },
        ),
      };
    });
  })
  // The last active owner can be neither demoted nor deactivated (FR-032).
  .post("/admin/set-role", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf<{ userId: string; role: string }>(c);
    const before = await findUser(c, body.userId);
    if (before?.role === "owner" && body.role !== "owner" && (await isLastOwner(c, before.id))) {
      throw new AppError("last_owner");
    }
    return forwardAudited(c, request, () =>
      before
        ? {
            entityId: before.id,
            action: "updated",
            changes: diffValues({ role: before.role }, { role: body.role }),
          }
        : null,
    );
  })
  .post("/admin/ban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf<{ userId: string }>(c);
    const before = await findUser(c, body.userId);
    if (before?.role === "owner" && !before.banned && (await isLastOwner(c, before.id))) {
      throw new AppError("last_owner");
    }
    return forwardAudited(c, request, () =>
      before && !before.banned
        ? { entityId: before.id, action: "deactivated", changes: { isActive: [true, false] } }
        : null,
    );
  })
  .post("/admin/unban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf<{ userId: string }>(c);
    const before = await findUser(c, body.userId);
    return forwardAudited(c, request, () =>
      before?.banned
        ? { entityId: before.id, action: "reactivated", changes: { isActive: [false, true] } }
        : null,
    );
  });
