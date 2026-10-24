import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

const bodies: [string, unknown][] = [
  ["an array", []],
  ["a string", "x"],
  ["a number", 5],
  ["null", null],
  ["a numeric email", { email: 5, password: "x" }],
  ["an array email", { email: ["a@b.c"], password: "abcdefgh" }],
  ["a numeric password", { email: "a@b.c", password: 7 }],
];

const domyError = {
  error: expect.objectContaining({ code: expect.any(String), message: expect.any(String) }),
};
// Native Better Auth 4xx keep its `{ code, message }` (contracts/http-api.md, native exception).
const nativeError = { code: expect.any(String), message: expect.any(String) };

const endpoints = [
  { path: "/api/auth/sign-in/email", owner: false, shape: domyError },
  { path: "/api/auth/request-password-reset", owner: false, shape: nativeError },
  { path: "/api/auth/admin/update-user", owner: true, shape: domyError },
];

/** Malformed JSON bodies are refused as client errors, never as a crash (release review IV-14, F001-1). */
describe("auth endpoints with malformed bodies", () => {
  for (const endpoint of endpoints) {
    it.each(bodies)(`refuses %s on ${endpoint.path} without a server error`, async (_, body) => {
      const response = await t.request(endpoint.path, {
        method: "POST",
        body,
        ...(endpoint.owner && { cookie: owner.cookie, actorId: owner.user.id }),
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(await response.json()).toEqual(endpoint.shape);
    });
  }
});
