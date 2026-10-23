import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, users } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;
let target: typeof owner;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  owner = await t.signIn("owner");
  target = await t.signIn("dispatcher");
});

function request(path: string, body: unknown, cookie = owner.cookie, actorId = owner.user.id) {
  return t.app.request(
    new Request(`http://localhost:3000/api/auth/admin/${path}`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie,
        "content-type": "application/json",
        "X-Domy-Actor-Id": actorId,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("account action identity (001/T132, IV-19, FR-042)", () => {
  it("does not reapply A after ban A, unban B and a delayed retry of A", async () => {
    const a = { actionId: crypto.randomUUID(), userId: target.user.id };
    const b = { actionId: crypto.randomUUID(), userId: target.user.id };
    expect((await request("ban-user", a)).status).toBe(200);
    expect((await request("unban-user", b)).status).toBe(200);
    expect((await request("ban-user", a)).status).toBe(200);
    const [stored] = await database.db
      .select({ banned: users.banned })
      .from(users)
      .where(eq(users.id, target.user.id));
    expect(stored?.banned).toBe(false);
    const events = await database.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.entityId, target.user.id));
    expect(events).toHaveLength(2);
  });
  it.each([
    ["update-user", { data: { name: "First name" } }, { data: { name: "Second name" } }],
    ["set-role", { role: "courier" }, { role: "dispatcher" }],
    ["unban-user", {}, {}],
  ])("does not replay %s over an intervening change", async (path, first, second) => {
    const a = { actionId: crypto.randomUUID(), userId: target.user.id, ...first };
    expect((await request(path, a)).status).toBe(200);
    const b = { actionId: crypto.randomUUID(), userId: target.user.id, ...second };
    if (path === "unban-user") {
      expect((await request("ban-user", b)).status).toBe(200);
    } else expect((await request(path, b)).status).toBe(200);
    const before = await database.db.select().from(users).where(eq(users.id, target.user.id));
    expect((await request(path, a)).status).toBe(200);
    expect(await database.db.select().from(users).where(eq(users.id, target.user.id))).toEqual(
      before,
    );
  });

  it("serializes concurrent duplicates into one effect and audit", async () => {
    const body = { actionId: crypto.randomUUID(), userId: target.user.id };
    const responses = await Promise.all([request("ban-user", body), request("ban-user", body)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await responses[0].json()).toEqual(await responses[1].json());
    const events = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, target.user.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.clientEventId).toBe(body.actionId);
  });

  it("binds the intent to its actor, operation, target and public payload", async () => {
    const secondOwner = await t.signIn("owner");
    const body = {
      actionId: crypto.randomUUID(),
      userId: target.user.id,
      data: { name: "Original" },
    };
    expect((await request("update-user", body)).status).toBe(200);
    const conflicts = [
      await request("update-user", body, secondOwner.cookie, secondOwner.user.id),
      await request("update-user", { ...body, data: { name: "Different" } }),
      await request("update-user", { ...body, userId: secondOwner.user.id }),
      await request("ban-user", { actionId: body.actionId, userId: target.user.id }),
    ];
    for (const response of conflicts) {
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: "idempotency_conflict" } });
    }
  });

  it("retains unchanged action receipts without a visible fictitious audit", async () => {
    const a = { actionId: crypto.randomUUID(), userId: target.user.id, role: "dispatcher" };
    expect((await request("set-role", a)).status).toBe(200);
    expect(await database.db.select().from(auditEvents)).toHaveLength(0);
    expect(
      (await request("set-role", { ...a, actionId: crypto.randomUUID(), role: "courier" })).status,
    ).toBe(200);
    expect((await request("set-role", a)).status).toBe(200);
    const [stored] = await database.db.select().from(users).where(eq(users.id, target.user.id));
    expect(stored?.role).toBe("courier");
    expect(await database.db.select().from(auditEvents)).toHaveLength(1);
  });

  it("maps a client creation intent to one native user and never stores secrets", async () => {
    const body = {
      id: crypto.randomUUID(),
      name: "New account",
      email: "created@domy.test",
      role: "courier",
      password: "original-password",
    };
    const first = await request("create-user", body);
    expect(first.status).toBe(200);
    const firstJson: unknown = await first.json();
    const retry = await request("create-user", { ...body, password: "changed-password" });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstJson);
    const created = await database.db.select().from(users).where(eq(users.email, body.email));
    expect(created).toHaveLength(1);
    expect(created[0]?.id).not.toBe(body.id);
    const receipts = await database.db.execute<{ input: unknown; response: unknown }>(
      sql`select input, response from account_action_receipts`,
    );
    expect(receipts).toHaveLength(1);
    const serialized = JSON.stringify(receipts);
    expect(serialized).not.toMatch(
      /password|token|cookie|fingerprint|failedSignInCount|lockedUntil/,
    );
    expect((await request("create-user", { ...body, name: "Changed" })).status).toBe(409);
  });

  it("does not revoke new sessions on replay, including self-revocation after relogin", async () => {
    const body = { actionId: crypto.randomUUID(), userId: owner.user.id };
    expect((await request("revoke-user-sessions", body)).status).toBe(200);
    const login = await t.app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const replay = await request("revoke-user-sessions", body, cookie);
    expect(replay.status).toBe(200);
    expect(replay.headers.getSetCookie()).toEqual([]);
    const session = await t.request("/api/auth/get-session", { cookie });
    expect(await session.json()).toMatchObject({ user: { id: owner.user.id } });
  });

  it("does not consume an intent when its transaction rolls back", async () => {
    const body = { actionId: crypto.randomUUID(), userId: target.user.id };
    await database.db
      .$client`alter table audit_events add constraint account_audit_fault check (entity_type <> 'user') not valid`;
    try {
      expect((await request("ban-user", body)).status).toBe(500);
      const receipts = await database.db.execute(
        sql`select client_intent_id from account_action_receipts`,
      );
      expect(receipts).toHaveLength(0);
    } finally {
      await database.db.$client`alter table audit_events drop constraint account_audit_fault`;
    }
    expect((await request("ban-user", body)).status).toBe(200);
  });

  it("requires a client UUID and revalidates active-owner access on replay", async () => {
    expect((await request("ban-user", { userId: target.user.id })).status).toBe(400);
    const secondOwner = await t.signIn("owner");
    const body = { actionId: crypto.randomUUID(), userId: target.user.id };
    expect((await request("ban-user", body, secondOwner.cookie, secondOwner.user.id)).status).toBe(
      200,
    );
    await database.db
      .update(users)
      .set({ role: "dispatcher" })
      .where(eq(users.id, secondOwner.user.id));
    expect((await request("ban-user", body, secondOwner.cookie, secondOwner.user.id)).status).toBe(
      403,
    );
  });
});

it("refuses a changed cookie actor before reserving a fresh intent or replaying a receipt", async () => {
  const secondOwner = await t.signIn("owner");
  const body = { actionId: crypto.randomUUID(), userId: target.user.id };
  const before = await database.db.select().from(users).orderBy(users.id);
  const mismatch = await request("ban-user", body, secondOwner.cookie, owner.user.id);
  expect(mismatch.status).toBe(409);
  expect(await mismatch.json()).toMatchObject({ error: { code: "actor_changed" } });
  expect(await database.db.select().from(users).orderBy(users.id)).toEqual(before);
  expect(await database.db.select().from(auditEvents)).toHaveLength(0);
  expect(
    await database.db.execute(sql`select client_intent_id from account_action_receipts`),
  ).toHaveLength(0);
  expect((await request("ban-user", body)).status).toBe(200);
  const foreign = await request("ban-user", body, secondOwner.cookie, secondOwner.user.id);
  expect(foreign.status).toBe(409);
  expect(await foreign.json()).toMatchObject({ error: { code: "idempotency_conflict" } });
  const staleActor = await request("ban-user", body, secondOwner.cookie, owner.user.id);
  expect(staleActor.status).toBe(409);
  expect(await staleActor.json()).toMatchObject({ error: { code: "actor_changed" } });
});

it.each([null, "not-a-uuid"])(
  "refuses a missing or invalid actor header (%s) without effects",
  async (actorId) => {
    const response = await t.app.request(
      new Request("http://localhost:3000/api/auth/admin/ban-user", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          cookie: owner.cookie,
          "content-type": "application/json",
          ...(actorId === null ? {} : { "X-Domy-Actor-Id": actorId }),
        },
        body: JSON.stringify({ actionId: crypto.randomUUID(), userId: target.user.id }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    const [stored] = await database.db.select().from(users).where(eq(users.id, target.user.id));
    expect(stored?.banned).toBe(false);
    expect(await database.db.select().from(auditEvents)).toHaveLength(0);
    expect(
      await database.db.execute(sql`select client_intent_id from account_action_receipts`),
    ).toHaveLength(0);
  },
);

it("does not reserve a creation intent after the confirmed native duplicate-email refusal", async () => {
  const body = {
    id: crypto.randomUUID(),
    name: "Duplicate email intent",
    email: owner.email,
    password: "contrasena-segura",
    role: "courier",
  };
  const before = await database.db.select().from(users).orderBy(users.id);
  const refused = await request("create-user", body);
  expect(refused.status).toBe(400);
  expect(await refused.json()).toMatchObject({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" });
  expect(await database.db.select().from(users).orderBy(users.id)).toEqual(before);
  expect(await database.db.select().from(auditEvents)).toHaveLength(0);
  expect(
    await database.db.execute(sql`select client_intent_id from account_action_receipts`),
  ).toHaveLength(0);

  const email = "retried-after-native-refusal@domy.test";
  expect((await request("create-user", { ...body, email })).status).toBe(200);
  expect(await database.db.select().from(users)).toHaveLength(before.length + 1);
  expect(await database.db.select().from(users).where(eq(users.email, email))).toHaveLength(1);
  const receipts = await database.db.execute<{ client_intent_id: string }>(
    sql`select client_intent_id from account_action_receipts`,
  );
  expect(receipts).toEqual([{ client_intent_id: body.id }]);
  const events = await database.db.select().from(auditEvents);
  expect(events).toHaveLength(1);
  expect(events[0]?.clientEventId).toBe(body.id);
});

it("rolls back account and audit if the safe receipt cannot commit", async () => {
  const body = { actionId: crypto.randomUUID(), userId: target.user.id };
  const before = await database.db.select().from(users).where(eq(users.id, target.user.id));
  await database.db
    .$client`alter table account_action_receipts add constraint receipt_fault check (operation <> 'deactivate') not valid`;
  try {
    expect((await request("ban-user", body)).status).toBe(500);
    expect(await database.db.select().from(users).where(eq(users.id, target.user.id))).toEqual(
      before,
    );
    expect(await database.db.select().from(auditEvents)).toHaveLength(0);
  } finally {
    await database.db.$client`alter table account_action_receipts drop constraint receipt_fault`;
  }
  expect((await request("ban-user", body)).status).toBe(200);
});

it("keeps a new session after replaying an acknowledged unchanged session-ending action", async () => {
  const userId = target.user.id;
  expect(
    (await request("revoke-user-sessions", { userId, actionId: crypto.randomUUID() })).status,
  ).toBe(200);
  const noop = { userId, actionId: crypto.randomUUID() };
  expect((await request("revoke-user-sessions", noop)).status).toBe(200);
  const login = await t.app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: target.email, password: target.password }),
  });
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect((await request("revoke-user-sessions", noop)).status).toBe(200);
  expect(await (await t.request("/api/auth/get-session", { cookie })).json()).toMatchObject({
    user: { id: userId },
  });
});

it("preserves native production Origin refusal for new actions and replays without leaking URLs", async () => {
  const result = await new Promise<{ exit: number | null; output: string; stderr: boolean }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL("./setup/account-origin.ts", import.meta.url))],
        {
          env: { ...process.env, NODE_ENV: "production", TEST: "" },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let output = "";
      let stderr = false;
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Production auth probe timed out"));
      }, 20_000);
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", () => {
        stderr = true;
      });
      child.on("error", () => {
        clearTimeout(timeout);
        reject(new Error("Production auth probe could not start"));
      });
      child.on("close", (exit) => {
        clearTimeout(timeout);
        resolve({ exit, output, stderr });
      });
      child.stdin.end(
        JSON.stringify({
          url: database.url,
          cookie: owner.cookie,
          actorId: owner.user.id,
          userId: target.user.id,
          sentinel: crypto.randomUUID(),
        }),
      );
    },
  );
  expect(result.exit, "Production auth probe must complete without disclosing child output").toBe(
    0,
  );
  expect(result.stderr, "Production auth probe must not write native diagnostics to stderr").toBe(
    false,
  );
  let probeJson: unknown;
  try {
    probeJson = JSON.parse(result.output);
  } catch {
    throw new Error("Production auth probe returned invalid safe JSON");
  }
  const probe = z
    .object({
      initial: z.number(),
      statuses: z.array(z.number()),
      noReceiptConsumed: z.boolean(),
      diagnosticRetained: z.boolean(),
      secretLeaked: z.boolean(),
    })
    .safeParse(probeJson);
  expect(probe.success, "Production probe must return only its declared safe result").toBe(true);
  if (!probe.success) return;
  expect(probe.data).toEqual({
    initial: 200,
    statuses: [403, 403, 403, 403, 403, 403],
    noReceiptConsumed: true,
    diagnosticRetained: true,
    secretLeaked: false,
  });
});
