import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

const execute = promisify(execFile);
let database: TestDatabase;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
});

describe("native production recovery origin policy", () => {
  it.each(["redirect", "callback", "same-origin"])(
    "validates %s using production mode from process startup",
    async (mode) => {
      const { stdout } = await execute(
        process.execPath,
        [new URL("./fixtures/auth-origin-production.ts", import.meta.url).pathname, mode],
        {
          env: {
            ...process.env,
            NODE_ENV: "production",
            TEST: "",
            BETTER_AUTH_TELEMETRY: "false",
            DATABASE_URL: database.url,
          },
          timeout: 20_000,
        },
      );
      const result: unknown = JSON.parse(stdout);
      expect(result).toMatchObject({
        originCheckEnabled: true,
        status: mode === "same-origin" ? 200 : 403,
        mailCount: mode === "same-origin" ? 1 : 0,
      });
      if (mode === "callback") expect(result).toMatchObject({ redirected: false });
      if (mode === "same-origin")
        expect(result).toMatchObject({
          callbackStatus: 302,
          callbackOrigin: "http://localhost:3000",
        });
    },
  );
});
