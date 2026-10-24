import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

/**
 * Release review DEPLOY-5 and SEC-4: with the built web app mounted, unknown server paths stay
 * JSON errors instead of the SPA shell, and every API answer is kept out of shared caches.
 */
let database: TestDatabase;
let webDist: string;
const indexMarker = "<!doctype html><title>Domy SPA shell</title>";

beforeAll(async () => {
  database = await startDatabase();
  webDist = await mkdtemp(join(tmpdir(), "domy-web-dist-"));
  await writeFile(join(webDist, "index.html"), indexMarker);
  await writeFile(join(webDist, "app.js"), "console.log('asset');");
});

afterAll(async () => {
  await database.stop();
  await rm(webDist, { recursive: true, force: true });
});

beforeEach(async () => {
  await database.truncate();
});

describe("production routing with the web app mounted", () => {
  it.each(["/api/nope", "/api/nope/deeper", "/health/nope", "/health"])(
    "answers the catalogued 404 JSON error for the unknown server path %s",
    async (path) => {
      const t = createTestApp(database.db, { webDist });
      const response = await t.app.request(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "No encontramos lo que buscas." },
      });
    },
  );

  it("still serves the SPA shell for panel routes and the static assets", async () => {
    const t = createTestApp(database.db, { webDist });
    const page = await t.app.request("/envios/nuevo");
    expect(page.status).toBe(200);
    expect(await page.text()).toBe(indexMarker);
    const asset = await t.app.request("/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBeNull();
  });

  it("answers the same JSON 404 for unknown API paths without the web app", async () => {
    const t = createTestApp(database.db);
    const response = await t.app.request("/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });
});

describe("API cache policy", () => {
  it("marks authenticated API data no-store", async () => {
    const t = createTestApp(database.db, { webDist });
    const dispatcher = await t.signIn("dispatcher");
    const response = await t.request("/api/shipments/board", { cookie: dispatcher.cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("marks API errors and unknown API paths no-store", async () => {
    const t = createTestApp(database.db, { webDist });
    const unauthenticated = await t.request("/api/shipments/board");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");
    const unknown = await t.request("/api/nope");
    expect(unknown.headers.get("cache-control")).toBe("no-store");
  });

  it("marks Better Auth answers no-store", async () => {
    const t = createTestApp(database.db, { webDist });
    const dispatcher = await t.signIn("dispatcher");
    const response = await t.request("/api/auth/get-session", { cookie: dispatcher.cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
