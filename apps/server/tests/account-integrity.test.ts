import { Writable } from "node:stream";
import { inspect } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tx } from "../src/db/client.ts";
import { accounts, auditEvents, couriers, sessions, users } from "../src/db/schema/index.ts";
import { createLogger } from "../src/lib/logger.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;
let dispatcher: typeof owner;
let output: string;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  output = "";
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  t = createTestApp(database.db, { logger: createLogger("debug", sink) });
  owner = await t.signIn("owner");
  dispatcher = await t.signIn("dispatcher");
});

/** Trusted real HTTP requests, not the library's privileged server-side API (R18). */
async function request(path: string, body?: unknown, cookie = owner.cookie, method?: string) {
  return t.app.request(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        origin: "http://localhost:3000",
        cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function state(userId: string) {
  return {
    user: (await database.db.select().from(users).where(eq(users.id, userId)))[0],
    // Never include tokens/hashes in failed-test diffs.
    sessions: await database.db
      .select({ id: sessions.id, userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(sessions.id),
    credentials: await database.db
      .select({ id: accounts.id, userId: accounts.userId, providerId: accounts.providerId })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.id),
    audit: await database.db.select().from(auditEvents).where(eq(auditEvents.entityId, userId)),
  };
}

/** Real row/advisory barriers, with explicit cleanup even when an assertion fails. */
async function withUserLocks(
  ids: string[],
  run: (pid: number, release: () => void, tx: Tx) => Promise<void>,
  invariantLock = false,
) {
  const ready = Promise.withResolvers<{ pid: number; tx: Tx }>();
  const released = Promise.withResolvers<undefined>();
  const blocker = database.db.transaction(async (tx) => {
    if (invariantLock) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('domy:account-administration', 0))`,
      );
    }
    await tx.select().from(users).where(inArray(users.id, ids)).orderBy(users.id).for("update");
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    if (!row) throw new Error("Missing PostgreSQL barrier connection");
    ready.resolve({ pid: row.pid, tx });
    await released.promise;
  });
  void blocker.catch(ready.reject);
  try {
    const { pid, tx } = await ready.promise;
    await run(
      pid,
      () => {
        released.resolve(undefined);
      },
      tx,
    );
  } finally {
    released.resolve(undefined);
    await blocker;
  }
}

async function afterContention(
  pending: Promise<Response>[],
  blockerPid: number,
  release: () => void,
  beforeRelease?: () => Promise<void>,
) {
  try {
    await expect
      .poll(
        async () => {
          const [row] = await database.db.execute<{ waiting: number }>(sql`
        select count(*)::int as waiting from pg_stat_activity
        where datname = current_database() and pid <> ${blockerPid}
          and wait_event_type = 'Lock'
          and (query ilike '%users%' or query ilike '%couriers%' or query ilike '%pg_advisory%')
      `);
          return row?.waiting;
        },
        { timeout: 10_000 },
      )
      .toBe(pending.length);
    await beforeRelease?.();
    release();
    return await Promise.all(pending);
  } finally {
    release();
    await Promise.allSettled(pending);
  }
}

describe("concurrent account invariants (T130, FR-032, R18)", () => {
  it.each(["two demotions", "mixed ban and demotion"])(
    "keeps one active owner after %s",
    async (mode) => {
      const second = await t.signIn("owner");
      await withUserLocks([owner.user.id, second.user.id], async (pid, release) => {
        const pending =
          mode === "two demotions"
            ? [
                request("admin/set-role", { userId: owner.user.id, role: "dispatcher" }),
                request("admin/set-role", { userId: second.user.id, role: "dispatcher" }),
              ]
            : [
                request("admin/ban-user", { userId: second.user.id }),
                request(
                  "admin/set-role",
                  { userId: owner.user.id, role: "dispatcher" },
                  second.cookie,
                ),
              ];
        const responses = await afterContention(pending, pid, release);
        expect(
          responses.map((response) => response.status).filter((status) => status === 200),
        ).toHaveLength(1);
        expect(
          responses
            .map((response) => response.status)
            .filter((status) => [401, 403, 409].includes(status)),
        ).toHaveLength(1);
        const active = await database.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, "owner"), eq(users.banned, false)));
        expect(active).toHaveLength(1);
      });
    },
  );

  it("does not retain a link to an account whose role changed concurrently", async () => {
    const courierUser = await t.signIn("courier");
    const courierId = crypto.randomUUID();
    await database.db
      .insert(couriers)
      .values({ id: courierId, name: "Courier race", phone: "3004445566" });
    await withUserLocks([courierUser.user.id], async (pid, release) => {
      const responses = await afterContention(
        [
          t.request(`/api/couriers/accounts/${courierUser.user.id}`, {
            method: "PUT",
            cookie: owner.cookie,
            body: { actionId: crypto.randomUUID(), courierId },
          }),
          request("admin/set-role", { userId: courierUser.user.id, role: "dispatcher" }),
        ],
        pid,
        release,
      );
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const [linked] = await database.db
        .select({ userId: couriers.userId, role: users.role })
        .from(couriers)
        .leftJoin(users, eq(users.id, couriers.userId))
        .where(eq(couriers.id, courierId));
      expect(linked?.userId === null || linked?.role === "courier").toBe(true);
    });
  });

  it("revalidates an owner's permission after waiting for the transaction boundary", async () => {
    const second = await t.signIn("owner");
    const before = await state(dispatcher.user.id);
    await withUserLocks(
      [dispatcher.user.id],
      async (pid, release, tx) => {
        const responses = await afterContention(
          [
            request(
              "admin/update-user",
              { userId: dispatcher.user.id, data: { name: "Revoked actor must not edit" } },
              second.cookie,
            ),
          ],
          pid,
          release,
          async () => {
            // Simulates the earlier serialized owner operation before it commits/releases.
            await tx.update(users).set({ role: "dispatcher" }).where(eq(users.id, second.user.id));
          },
        );
        expect(responses[0]?.status).toBe(403);
        expect(await state(dispatcher.user.id)).toEqual(before);
      },
      true,
    );
  });
});

describe("account HTTP surface (T130, FR-032, R18)", () => {
  it.each([{ password: "corta" }, { name: "   " }, { data: { banned: true } }, { banned: true }])(
    "refuses unsupported/invalid creation input: %j",
    async (extra) => {
      const before = await database.db.select({ id: users.id }).from(users).orderBy(users.id);
      const response = await request("admin/create-user", {
        name: "Nueva cuenta",
        email: "invalid-create@domy.test",
        password: "contrasena-segura",
        role: "courier",
        ...extra,
      });
      expect(response.status).toBe(400);
      expect(await database.db.select({ id: users.id }).from(users).orderBy(users.id)).toEqual(
        before,
      );
    },
  );

  it.each([
    { role: "courier" },
    { banned: true },
    { emailVerified: true },
    { failedSignInCount: 100 },
    { banReason: "Not a name/email edit" },
  ])("refuses administrative fields through generic profile update: %j", async (data) => {
    const userId = "role" in data ? owner.user.id : dispatcher.user.id;
    const before = await state(userId);
    const response = await request("admin/update-user", { userId, data });
    expect(response.status).toBe(400);
    expect(await state(userId)).toEqual(before);
  });

  it.each([
    "admin/remove-user",
    "admin/set-user-password",
    "admin/impersonate-user",
    "admin/stop-impersonating",
    "admin/list-user-sessions",
    "admin/revoke-user-session",
    "admin/has-permission",
    "update-user",
  ])("does not expose the unsupported native mutation %s", async (path) => {
    const before = await state(dispatcher.user.id);
    const response = await request(path, {
      userId: dispatcher.user.id,
      newPassword: "contrasena-no-autorizada",
      name: "Not an approved profile endpoint",
      permissions: { user: ["delete"] },
    });
    expect(response.status).toBe(404);
    expect(await state(dispatcher.user.id)).toEqual(before);
  });

  it.each([
    "admin/update-user/",
    "admin/%75pdate-user",
    "admin//update-user",
    "admin%2Fupdate-user",
  ])("does not delegate an alternate administrative path %s", async (path) => {
    const before = await state(owner.user.id);
    const response = await request(path, { userId: owner.user.id, data: { role: "courier" } });
    expect(response.status).toBe(404);
    expect(await state(owner.user.id)).toEqual(before);
  });

  it("keeps legitimate name/email edits and native duplicate-email refusal", async () => {
    const response = await request("admin/update-user", {
      userId: dispatcher.user.id,
      data: { name: "Nombre actualizado", email: "actualizada@domy.test" },
    });
    expect(response.status).toBe(200);
    expect((await state(dispatcher.user.id)).user).toMatchObject({
      name: "Nombre actualizado",
      email: "actualizada@domy.test",
    });
    const duplicate = await request("admin/create-user", {
      name: "Duplicado",
      email: owner.email,
      password: "contrasena-segura",
      role: "courier",
    });
    expect(duplicate.status).toBe(400);
  });

  it.each([
    ["HEAD", "admin/list-users"],
    ["HEAD", "get-session"],
    ["GET", "admin/set-role"],
    ["PUT", "admin/update-user"],
    ["PATCH", "admin/ban-user"],
    ["DELETE", "admin/remove-user"],
    ["OPTIONS", "admin/create-user"],
  ])("refuses unsupported method %s on %s", async (method, path) => {
    const before = await state(dispatcher.user.id);
    const response = await request(path, undefined, owner.cookie, method);
    expect(response.status).toBe(404);
    expect(await state(dispatcher.user.id)).toEqual(before);
  });
});

describe("account atomicity (T131, FR-036, Constitution IV)", () => {
  it("rolls back deactivation if native session deletion fails", async () => {
    const before = await state(dispatcher.user.id);
    const session = before.sessions[0];
    if (!session) throw new Error("The fixture must have an active dispatcher session");
    await database.db
      .$client`create table account_session_fault (session_id uuid references sessions(id))`;
    try {
      await database.db
        .$client`insert into account_session_fault(session_id) values (${session.id})`;
      const response = await request("admin/ban-user", { userId: dispatcher.user.id });
      expect(response.status).toBe(500);
      expect(await state(dispatcher.user.id)).toEqual(before);
      expect(output).toContain("23503");
    } finally {
      await database.db.$client`drop table account_session_fault`;
    }
  });

  it("audits a successful session revocation without token values", async () => {
    const response = await request("admin/revoke-user-sessions", { userId: dispatcher.user.id });
    expect(response.status).toBe(200);
    const after = await state(dispatcher.user.id);
    expect(after.sessions).toEqual([]);
    expect(after.audit).toHaveLength(1);
    expect(after.audit[0]).toMatchObject({
      action: "updated",
      actorUserId: owner.user.id,
      occurredAt: t.now(),
      changes: { sessions: [1, 0] },
    });
    expect(JSON.stringify(after.audit).includes("token")).toBe(false);
  });

  it.each(["update-user", "set-role", "ban-user", "unban-user", "revoke-user-sessions"])(
    "rolls back %s and session consequences if its audit cannot be recorded",
    async (operation) => {
      if (operation === "unban-user") {
        expect((await request("admin/ban-user", { userId: dispatcher.user.id })).status).toBe(200);
      }
      const before = await state(dispatcher.user.id);
      await database.db
        .$client`alter table audit_events add constraint account_audit_fault check (entity_type <> 'user') not valid`;
      try {
        const response = await request(`admin/${operation}`, {
          userId: dispatcher.user.id,
          ...(operation === "update-user"
            ? { data: { name: "Must roll back", email: "rollback@domy.test" } }
            : {}),
          ...(operation === "set-role" ? { role: "courier" } : {}),
        });
        expect(response.status).toBe(500);
        expect(await state(dispatcher.user.id)).toEqual(before);
      } finally {
        await database.db.$client`alter table audit_events drop constraint account_audit_fault`;
      }
    },
  );

  it("rolls back user and credentials if creation audit fails", async () => {
    const beforeUsers = await database.db.select({ id: users.id }).from(users).orderBy(users.id);
    const beforeAccounts = await database.db
      .select({ id: accounts.id })
      .from(accounts)
      .orderBy(accounts.id);
    await database.db
      .$client`alter table audit_events add constraint account_audit_fault check (entity_type <> 'user') not valid`;
    try {
      const response = await request("admin/create-user", {
        name: "Must roll back",
        email: "rollback@domy.test",
        password: "contrasena-segura",
        role: "courier",
      });
      expect(response.status).toBe(500);
      expect(await database.db.select({ id: users.id }).from(users).orderBy(users.id)).toEqual(
        beforeUsers,
      );
      expect(
        await database.db.select({ id: accounts.id }).from(accounts).orderBy(accounts.id),
      ).toEqual(beforeAccounts);
    } finally {
      await database.db.$client`alter table audit_events drop constraint account_audit_fault`;
    }
  });

  it.each(["rollback", "redaction"])(
    "preserves %s on credential-write failure (T131/T150)",
    async (focus) => {
      const beforeUsers = await database.db.select({ id: users.id }).from(users).orderBy(users.id);
      // Observe the native logger in memory: never print a captured password hash in RED.
      const nativeErrors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await database.db
        .$client`alter table accounts add constraint account_credential_fault check (provider_id <> 'credential') not valid`;
      try {
        const response = await request("admin/create-user", {
          name: "Credential fault",
          email: "credential-fault@domy.test",
          password: "contrasena-segura",
          role: "courier",
        });
        expect(response.status).toBe(500);
        const nativeLog = inspect(nativeErrors.mock.calls, { depth: 8 });
        const leaked =
          nativeLog.includes('insert into "accounts"') || nativeLog.includes("params:");
        if (focus === "redaction") {
          expect(leaked, "native logger must not receive sensitive SQL/credential parameters").toBe(
            false,
          );
          expect(output.includes("params:"), "application logger must omit SQL parameters").toBe(
            false,
          );
          expect(output).toContain("23514");
        } else {
          expect(await database.db.select({ id: users.id }).from(users).orderBy(users.id)).toEqual(
            beforeUsers,
          );
        }
      } finally {
        nativeErrors.mockRestore();
        await database.db.$client`alter table accounts drop constraint account_credential_fault`;
      }
    },
  );
});
