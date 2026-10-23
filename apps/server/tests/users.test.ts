import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;
let dispatcher: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;

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
  dispatcher = await t.signIn("dispatcher");
});

async function admin(path: string, body: unknown, cookie = owner.cookie) {
  const mutation =
    typeof body === "object" && body !== null
      ? {
          [path === "create-user" ? "id" : "actionId"]: crypto.randomUUID(),
          ...body,
        }
      : body;
  const actorId = cookie === owner.cookie ? owner.user.id : dispatcher.user.id;
  const response = await t.request(`/api/auth/admin/${path}`, {
    method: "POST",
    cookie,
    body: mutation,
    actorId,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("user accounts (FR-032)", () => {
  it("are created only by the owner, with no self-registration", async () => {
    const body = {
      email: "nuevo@domy.test",
      password: "contrasena-segura",
      name: "Nuevo",
      role: "courier",
    };
    expect((await admin("create-user", body, dispatcher.cookie)).status).toBe(403);
    const created = await admin("create-user", body);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ user: { email: "nuevo@domy.test", role: "courier" } });

    const signUp = await t.request("/api/auth/sign-up/email", {
      method: "POST",
      body: { email: "otro@domy.test", password: "contrasena-segura", name: "Otro" },
    });
    expect(signUp.status).toBeGreaterThanOrEqual(400);
  });

  it("are edited, promoted, deactivated, and reactivated by the owner, with an audit", async () => {
    const id = dispatcher.user.id;
    expect((await admin("update-user", { userId: id, data: { name: "John" } })).status).toBe(200);
    expect((await admin("set-role", { userId: id, role: "owner" })).status).toBe(200);
    expect((await admin("ban-user", { userId: id })).status).toBe(200);
    expect((await admin("unban-user", { userId: id })).status).toBe(200);
    expect((await admin("set-role", { userId: id, role: "owner" }, dispatcher.cookie)).status).toBe(
      401,
    );

    const audit = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, id))
      .orderBy(auditEvents.id);
    expect(audit.map((event) => [event.action, event.changes])).toEqual([
      ["updated", { name: ["Usuario dispatcher", "John"] }],
      ["updated", { role: ["dispatcher", "owner"] }],
      ["deactivated", { isActive: [true, false] }],
      ["reactivated", { isActive: [false, true] }],
    ]);
    expect(audit.every((event) => event.actorUserId === owner.user.id)).toBe(true);
  });

  it("always keeps one active owner (scenario 6)", async () => {
    for (const [path, body] of [
      ["ban-user", { userId: owner.user.id }],
      ["set-role", { userId: owner.user.id, role: "dispatcher" }],
    ] as const) {
      const result = await admin(path, body);
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ error: { code: "last_owner" } });
    }
    // With a second active owner, either may step down.
    await admin("set-role", { userId: dispatcher.user.id, role: "owner" });
    expect((await admin("set-role", { userId: owner.user.id, role: "dispatcher" })).status).toBe(
      200,
    );
  });

  it("lists accounts for the owner only", async () => {
    const list = await t.request("/api/auth/admin/list-users", { cookie: owner.cookie });
    expect(list.status).toBe(200);
    const denied = await t.request("/api/auth/admin/list-users", { cookie: dispatcher.cookie });
    expect(denied.status).toBe(403);
  });
});
