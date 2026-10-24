import {
  accountChangeRefusal,
  accountCreateInput,
  accountRoleInput,
  accountTargetInput,
  accountUpdateInput,
  passwordSignInInput,
  userRole,
  type UserRole,
} from "@domy/domain";
import { and, eq, ne, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { isAPIError, originCheckMiddleware } from "better-auth/api";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { JSONParsed } from "hono/utils/types";
import type { AppEnv } from "../app.ts";
import { createAuth, type Auth } from "../auth.ts";
import { accountActionReceipts, couriers, sessions, users } from "../db/schema/index.ts";
import { recordAudit } from "../lib/audit.ts";
import { assertAccountActor } from "../lib/account-actor.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { resolveClientAddress } from "../lib/client-address.ts";
import { AppError } from "../lib/errors.ts";
import { diffValues } from "../lib/master-data.ts";
import { allowRequest, type PublicRateLimitState } from "../lib/rate-limit.ts";

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

/** The bounded client identity of the request: native peer, or the trusted proxy's header. */
function clientAddressOf(c: Context<AppEnv>): string {
  let peer: string | undefined;
  try {
    const address = getConnInfo(c).remote.address;
    peer = typeof address === "string" && address ? address : undefined;
  } catch {
    // app.request has no transport binding; the resolver maps it to the unknown peer.
  }
  return resolveClientAddress(
    peer,
    c.get("trustedProxyIp"),
    c.req.raw.headers.get("X-Domy-Client-IP") ?? undefined,
  );
}

/**
 * SEC-8: Better Auth reads the client address only from X-Domy-Client-IP (src/auth.ts), so the
 * header it sees is always the one resolved here: the proxy's value only when
 * DOMY_TRUSTED_PROXY_IP names the exact peer, otherwise the native peer. A header sent by the
 * client itself never reaches it.
 */
function forAuth(c: Context<AppEnv>, request: Request): Request {
  const headers = new Headers(request.headers);
  const address = clientAddressOf(c);
  if (address === "unknown") headers.delete("X-Domy-Client-IP");
  else headers.set("X-Domy-Client-IP", address);
  return new Request(request, { headers });
}

/** The request's JSON body, leaving the original request intact for Better Auth. */
async function bodyOf<Schema extends z.ZodType>(
  c: Context<AppEnv>,
  schema: Schema,
): Promise<{ request: Request; body: z.output<Schema> }> {
  const request = forAuth(c, c.req.raw.clone());
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

/** Forward only normalized native fields, never the client intent discriminator (R19). */
function nativeRequest(request: Request, body: Record<string, unknown>): Request {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(body),
  });
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

// R19/T132: validate unknown native JSON and strip all fields outside this public allowlist.
type NativeUser = JSONParsed<Awaited<ReturnType<Auth["api"]["createUser"]>>["user"]>;
const safeAccount = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  image: z.string().nullable().optional(),
  role: userRole.optional(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable().optional(),
  banExpires: z.iso.datetime({ offset: true }).nullable().optional(),
}) satisfies z.ZodType<
  Pick<
    NativeUser,
    | "id"
    | "name"
    | "email"
    | "emailVerified"
    | "createdAt"
    | "updatedAt"
    | "image"
    | "role"
    | "banned"
    | "banReason"
    | "banExpires"
  >
>;
const safeAccountEnvelope = z.object({ user: safeAccount });
const safeSessionEnding = z.object({ success: z.literal(true) }) satisfies z.ZodType<
  Awaited<ReturnType<Auth["api"]["revokeUserSessions"]>>
>;

function safeOutcome(kind: AccountOperation["kind"], input: unknown) {
  return kind === "end_sessions"
    ? safeSessionEnding.parse(input)
    : kind === "profile"
      ? safeAccount.parse(input)
      : safeAccountEnvelope.parse(input);
}

/** T130/T131: native account writes, invariant facts and audit have one PG boundary. */
async function forwardAudited(
  c: Context<AppEnv>,
  request: Request,
  operation: AccountOperation,
  intentId: string,
  publicInput: Record<string, unknown>,
): Promise<Response> {
  try {
    return await c.get("db").transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('domy:account-administration', 0))`,
      );
      const auth = createAuth({ ...c.get("authConfig"), db: tx, logger: c.get("logger") });
      const actor = await auth.api.getSession({ headers: request.headers });
      if (!actor || actor.user.banned === true) throw new AppError("unauthenticated");
      if (actor.user.role !== "owner") throw new AppError("forbidden");

      // Use the native public primitive even for cached responses: cookies must not bypass CSRF.
      try {
        const nativeContext = {
          request,
          headers: request.headers,
          context: await auth.$context,
        };
        await originCheckMiddleware(nativeContext);
      } catch (error) {
        if (isAPIError(error))
          throw new AuthResponseRollback(Response.json(error.body, { status: error.statusCode }));
        throw error;
      }
      // A different tab can replace the shared cookie after this intent was persisted.
      assertAccountActor(request.headers.get("X-Domy-Actor-Id"), actor.user.id);
      const [receipt] = await tx
        .select()
        .from(accountActionReceipts)
        .where(eq(accountActionReceipts.clientIntentId, intentId));
      if (receipt) {
        if (
          receipt.actorUserId !== actor.user.id ||
          receipt.operation !== operation.kind ||
          (operation.kind !== "create" && receipt.targetUserId !== operation.userId) ||
          !isDeepStrictEqual(receipt.input, publicInput)
        )
          throw new AppError("idempotency_conflict");
        // Never replay Set-Cookie, native mutations, state guards or historical session deletion.
        return Response.json(safeOutcome(operation.kind, receipt.response), {
          status: receipt.status,
        });
      }

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
      const nativeJson: unknown = await response.clone().json();
      const outcome = safeOutcome(operation.kind, nativeJson);

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
          clientEventId: intentId,
        });
      }
      await tx.insert(accountActionReceipts).values({
        clientIntentId: intentId,
        actorUserId: actor.user.id,
        operation: operation.kind,
        targetUserId: after.id,
        input: publicInput,
        response: outcome,
        status: response.status,
        occurredAt: c.get("clock")(),
      });
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return Response.json(outcome, { status: response.status, headers });
    });
  } catch (error) {
    if (error instanceof AuthResponseRollback) return error.response;
    throw error;
  }
}

/**
 * SEC-1: password checks are bounded before they touch PostgreSQL, so an anonymous flood can
 * never hold the connection pool. Each client address (an IPv6 /64) has a fixed-window budget;
 * in-process requests without a transport peer ("unknown", only app.request) have none, but
 * still pass the global bound below.
 */
const signInPolicy = { maxRequests: 20, windowMs: 60_000, maxClients: 10_000 };
const signInBudgets: PublicRateLimitState = { buckets: new Map(), nextCleanupAt: 0 };
/** At most this many sign-ins hold a pooled connection at once; the rest wait in memory. */
const maxActiveSignIns = 2;
/** Waiters beyond this are refused at once rather than queued without bound. */
const maxWaitingSignIns = 64;
let activeSignIns = 0;
const signInWaiters: (() => void)[] = [];
/** FR-033/T146: one account's attempts run in order, waiting in memory, not on a connection. */
const accountTurns = new Map<string, { tail: Promise<void>; waiting: number }>();

async function withSignInSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeSignIns < maxActiveSignIns) activeSignIns++;
  else {
    if (signInWaiters.length >= maxWaitingSignIns) throw new AppError("rate_limited");
    // The finishing sign-in hands its slot over directly, so the count stays unchanged.
    await new Promise<void>((resolve) => signInWaiters.push(resolve));
  }
  try {
    return await run();
  } finally {
    const next = signInWaiters.shift();
    if (next) next();
    else activeSignIns--;
  }
}

async function inAccountTurn<T>(email: string, run: () => Promise<T>): Promise<T> {
  const turn = accountTurns.get(email) ?? { tail: Promise.resolve(), waiting: 0 };
  if (turn.waiting >= maxWaitingSignIns) throw new AppError("rate_limited");
  const previous = turn.tail;
  let release = () => {};
  turn.tail = new Promise<void>((resolve) => (release = resolve));
  turn.waiting++;
  accountTurns.set(email, turn);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (--turn.waiting === 0) accountTurns.delete(email);
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
    const client = clientAddressOf(c);
    if (
      client !== "unknown" &&
      !allowRequest(signInBudgets, client, performance.now(), signInPolicy)
    ) {
      throw new AppError("rate_limited");
    }
    const { request, body } = await bodyOf(c, passwordSignInInput);
    const email = body.email.toLowerCase();
    // FR-033: one account's password checks and failure counters have one order: in this
    // process through its turn, across processes through the advisory lock, which is only
    // tried so a connection never waits on it (SEC-1).
    const outcome = await inAccountTurn(email, () =>
      withSignInSlot(() =>
        c.get("db").transaction(async (tx) => {
          const [turn] = await tx.execute<{ acquired: boolean }>(
            sql`select pg_try_advisory_xact_lock(hashtextextended(${`domy:sign-in:${email}`}, 0)) as acquired`,
          );
          if (turn?.acquired !== true) return new AppError("rate_limited");
          const now = c.get("clock")();
          const [user] = await tx
            .select()
            .from(users)
            .where(eq(sql`lower(${users.email})`, body.email.toLowerCase()));
          if (user?.lockedUntil && user.lockedUntil > now) return locked(user.lockedUntil);

          const auth = createAuth({ ...c.get("authConfig"), db: tx, logger: c.get("logger") });
          const response = await auth.handler(request);
          if (!user) return response;
          if (response.status === 401) {
            const failures = user.failedSignInCount + 1;
            const lockedUntil = failures >= maxFailures ? new Date(now.getTime() + lockMs) : null;
            await tx
              .update(users)
              .set({ failedSignInCount: lockedUntil ? 0 : failures, lockedUntil })
              .where(eq(users.id, user.id));
            // Return the refusal so the counter commits before Hono handles the error.
            if (lockedUntil) return locked(lockedUntil);
          } else if (response.ok && (user.failedSignInCount > 0 || user.lockedUntil)) {
            await tx
              .update(users)
              .set({ failedSignInCount: 0, lockedUntil: null })
              .where(eq(users.id, user.id));
          }
          return response;
        }),
      ),
    );
    if (outcome instanceof AppError) throw outcome;
    return outcome;
  })
  .post("/admin/create-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountCreateInput);
    const { id, password: _password, ...publicInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, { ...publicInput, password: body.password }),
      { kind: "create", email: body.email },
      id,
      publicInput,
    );
  })
  .post("/admin/update-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountUpdateInput);
    const { actionId, ...nativeInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, nativeInput),
      { kind: "profile", userId: body.userId },
      actionId,
      body.data,
    );
  })
  .post("/admin/set-role", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountRoleInput);
    const { actionId, ...nativeInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, nativeInput),
      { kind: "role", ...nativeInput },
      actionId,
      { role: body.role },
    );
  })
  .post("/admin/ban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    const { actionId, ...nativeInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, nativeInput),
      { kind: "deactivate", ...nativeInput },
      actionId,
      {},
    );
  })
  .post("/admin/unban-user", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    const { actionId, ...nativeInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, nativeInput),
      { kind: "reactivate", ...nativeInput },
      actionId,
      {},
    );
  })
  .post("/admin/revoke-user-sessions", requireRole("owner"), async (c) => {
    const { request, body } = await bodyOf(c, accountTargetInput);
    const { actionId, ...nativeInput } = body;
    return forwardAudited(
      c,
      nativeRequest(request, nativeInput),
      { kind: "end_sessions", ...nativeInput },
      actionId,
      {},
    );
  })
  .get("/admin/list-users", requireRole("owner"), (c) =>
    c.get("auth").handler(forAuth(c, c.req.raw)),
  )
  // Keep the native recovery callback as well as its form submission (FR-030).
  .on("GET", ["/get-session", "/reset-password/:token"], (c) =>
    c.get("auth").handler(forAuth(c, c.req.raw)),
  )
  .on(
    "POST",
    ["/sign-out", "/request-password-reset", "/reset-password", "/change-password"],
    (c) => c.get("auth").handler(forAuth(c, c.req.raw)),
  )
  .all("*", () => {
    throw new AppError("not_found");
  });
