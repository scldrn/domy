import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let user: Awaited<ReturnType<ReturnType<typeof createTestApp>["signIn"]>>;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  // 10:00 in Bogotá.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  await t.signIn("owner");
  user = await t.signIn("dispatcher");
});
afterEach(() => {
  vi.useRealTimers();
});

async function signIn(password: string) {
  const response = await t.request("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: user.email, password },
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
const status = async (cookie: string) => (await t.request("/api/rate-zones", { cookie })).status;

async function requestReset(email: string) {
  const response = await t.request("/api/auth/request-password-reset", {
    method: "POST",
    body: { email, redirectTo: "/restablecer" },
  });
  return { status: response.status, body: await response.json() };
}
const tokenOf = (url: string) => /reset-password\/([^?]+)/.exec(url)?.[1] ?? "";
const reset = (token: string, newPassword: string) =>
  t.request("/api/auth/reset-password", { method: "POST", body: { token, newPassword } });

describe("lockout (FR-033)", () => {
  it("locks password sign-in for 15 minutes on the fifth consecutive failure (scenario 3)", async () => {
    for (let i = 0; i < 4; i++) expect((await signIn("equivocada")).status).toBe(401);
    const fifth = await signIn("equivocada");
    expect(fifth.status).toBe(423);
    expect(fifth.body).toMatchObject({
      error: {
        code: "account_locked",
        retryAt: "2026-10-01T15:15:00.000Z",
        message: expect.stringContaining("10:15") as string,
      },
    });
    // The right password is refused too while locked; open sessions keep working.
    expect((await signIn(user.password)).status).toBe(423);
    expect(await status(user.cookie)).toBe(200);

    t.setNow("2026-10-01T15:15:00Z");
    expect((await signIn(user.password)).status).toBe(200);
  });

  it("counts only consecutive failures", async () => {
    for (let i = 0; i < 4; i++) await signIn("equivocada");
    expect((await signIn(user.password)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await signIn("equivocada")).status).toBe(401);
  });
});

describe("password recovery (FR-030)", () => {
  it("sends a single-use link and answers the same for unknown emails (scenarios 2, 7)", async () => {
    const known = await requestReset(user.email);
    const unknown = await requestReset("nadie@domy.test");
    expect(known).toEqual(unknown);
    expect(t.emails).toHaveLength(1);
    expect(t.emails[0]?.email).toBe(user.email);

    const token = tokenOf(t.emails[0]?.url ?? "");
    expect((await reset(token, "contrasena-nueva-1")).status).toBe(200);
    expect((await reset(token, "contrasena-nueva-2")).status).toBe(400);
    expect((await signIn("contrasena-nueva-1")).status).toBe(200);
  });

  it("expires the link after 60 minutes", async () => {
    await requestReset(user.email);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 61 * 60 * 1000 });
    expect((await reset(tokenOf(t.emails[0]?.url ?? ""), "contrasena-nueva-1")).status).toBe(400);
  });

  it("ends earlier sessions and lifts the lock (scenario 8)", async () => {
    for (let i = 0; i < 5; i++) await signIn("equivocada");
    expect((await signIn(user.password)).status).toBe(423);
    await requestReset(user.email);
    expect((await reset(tokenOf(t.emails[0]?.url ?? ""), "contrasena-nueva-1")).status).toBe(200);
    expect(await status(user.cookie)).toBe(401);
    expect((await signIn("contrasena-nueva-1")).status).toBe(200);
  });

  it("accepts passwords of 8 to 128 characters", async () => {
    await requestReset(user.email);
    const token = tokenOf(t.emails[0]?.url ?? "");
    expect((await reset(token, "corta")).status).toBe(400);
    expect((await reset(token, "x".repeat(129))).status).toBe(400);
    expect((await reset(token, "x".repeat(128))).status).toBe(200);
  });

  it("lets a signed-in user change their own password", async () => {
    const response = await t.request("/api/auth/change-password", {
      method: "POST",
      cookie: user.cookie,
      body: { currentPassword: user.password, newPassword: "otra-contrasena-segura" },
    });
    expect(response.status).toBe(200);
    expect((await signIn("otra-contrasena-segura")).status).toBe(200);
  });
});
