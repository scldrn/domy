import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;

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
});
afterEach(() => {
  vi.useRealTimers();
});

const day = 24 * 60 * 60 * 1000;
const status = async (cookie: string) => (await t.request("/api/rate-zones", { cookie })).status;

describe("sessions (FR-033a)", () => {
  it("lasts 30 days from sign-in and is never extended (scenario 4)", async () => {
    const start = Date.now();
    const dispatcher = await t.signIn("dispatcher");
    const [session] = await database.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, dispatcher.user.id));
    const expiresAt = session?.expiresAt.getTime() ?? 0;
    expect(Math.round((expiresAt - start) / day)).toBe(30);

    vi.useFakeTimers({ toFake: ["Date"], now: start + 29 * day });
    expect(await status(dispatcher.cookie)).toBe(200);
    const [after] = await database.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, dispatcher.user.id));
    expect(after?.expiresAt.getTime()).toBe(expiresAt);

    // One second past the stored expiry, not past a start taken before sign-in (F001-2).
    vi.setSystemTime(expiresAt + 1000);
    expect(await status(dispatcher.cookie)).toBe(401);
  });

  it("refuses a deactivated user on the next request (scenario 1)", async () => {
    const dispatcher = await t.signIn("dispatcher");
    expect(await status(dispatcher.cookie)).toBe(200);
    const response = await t.request("/api/auth/admin/ban-user", {
      method: "POST",
      cookie: owner.cookie,
      body: { actionId: crypto.randomUUID(), userId: dispatcher.user.id },
      actorId: owner.user.id,
    });
    expect(response.status).toBe(200);
    expect(await status(dispatcher.cookie)).toBe(401);
    const signIn = await t.request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: dispatcher.email, password: dispatcher.password },
    });
    expect(signIn.status).toBe(403);
  });

  it("ends every session of a user at the owner's request (scenario 5)", async () => {
    const first = await t.signIn("dispatcher");
    const second = await t.request("/api/auth/sign-in/email", {
      method: "POST",
      body: { email: first.email, password: first.password },
    });
    const secondCookie = second.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const response = await t.request("/api/auth/admin/revoke-user-sessions", {
      method: "POST",
      cookie: owner.cookie,
      body: { actionId: crypto.randomUUID(), userId: first.user.id },
      actorId: owner.user.id,
    });
    expect(response.status).toBe(200);
    expect(await status(first.cookie)).toBe(401);
    expect(await status(secondCookie)).toBe(401);
  });

  it("lets users sign out", async () => {
    const dispatcher = await t.signIn("dispatcher");
    await t.request("/api/auth/sign-out", { method: "POST", cookie: dispatcher.cookie, body: {} });
    expect(await status(dispatcher.cookie)).toBe(401);
  });
});
