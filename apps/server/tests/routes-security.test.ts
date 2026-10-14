import type { RouteDetail } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

/**
 * Hostile input on the routes API (Constitution V and IX, research R13): refused at the
 * boundary with a Spanish message, never a server error, never a partial change, and never a
 * glimpse of the internals.
 */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
});

/** A raw request with the session, for bodies the JSON helper would not send. */
const raw = (path: string, init: { method?: string; body?: string; type?: string } = {}) =>
  t.app.request(path, {
    method: init.method ?? "POST",
    headers: { cookie, ...(init.type && { "content-type": init.type }) },
    ...(init.body !== undefined && { body: init.body }),
  });

const routeCount = async () =>
  (await send<{ routes: unknown[] }>(t, cookie, "/api/routes/board?date=2026-10-01")).body.routes
    .length;

/** No answer shows SQL, a stack trace, a file path, or a library's own message. */
async function expectSafeRefusal(response: Response, status: number) {
  const text = await response.text();
  expect(response.status, text).toBe(status);
  expect(text).not.toMatch(/select |insert |update |postgres|drizzle|at \w+ \(|\.ts:\d+|zod/i);
  const body = JSON.parse(text) as { error: { code: string; message: string } };
  expect(body.error.message).toMatch(/[áéíóúñ¿¡]|^[A-ZÁÉÍÓÚ][a-záéíóúñ ,.;:«»0-9-]+/);
}

describe("identifiers and bodies", () => {
  it.each([
    ["GET", "/api/routes/no-es-un-id"],
    ["POST", "/api/routes/no-es-un-id/dispatch"],
    ["POST", "/api/routes/00000000-0000-0000-0000-000000000000/shipments/x/remove"],
    ["POST", "/api/shipments/1%27%20or%201%3D1/reassign"],
    ["POST", "/api/handovers/%3Cscript%3E/confirm"],
    ["GET", "/api/routes/board?date=2026-02-31"],
    ["GET", "/api/routes/board?date=hoy"],
    ["GET", "/api/shipments/unassigned?date=2026-13-01"],
  ])("refuses %s %s with 400", async (method, path) => {
    const response = await raw(path, {
      method,
      ...(method === "POST" && {
        body: JSON.stringify({ actionId: crypto.randomUUID(), version: 1 }),
        type: "application/json",
      }),
    });
    await expectSafeRefusal(response, 400);
  });

  it("refuses broken JSON and bodies that are not objects", async () => {
    for (const body of ["{", "null", "[]", '"ruta"', "1e309"]) {
      await expectSafeRefusal(await raw("/api/routes", { body, type: "application/json" }), 400);
    }
    expect(await routeCount()).toBe(0);
  });

  it("refuses a cross-site form post: route actions take only JSON", async () => {
    const shipment = await registerShipment(t, cookie, catalog);
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: [shipment.id],
    });
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      const response = await raw("/api/routes", { body, type });
      expect(response.status, type).toBeGreaterThanOrEqual(400);
      expect(response.status, type).toBeLessThan(500);
    }
    expect(await routeCount()).toBe(0);
  });

  it("refuses oversized lists and bodies", async () => {
    const ids = Array.from({ length: 201 }, () => crypto.randomUUID());
    const tooMany = await send(t, cookie, "/api/routes", {
      id: crypto.randomUUID(),
      actionId: crypto.randomUUID(),
      serviceDate: "2026-10-01",
      shipmentIds: ids,
    });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body).toMatchObject({
      error: { code: "invalid_request", fields: { shipmentIds: expect.any(String) } },
    });

    const route = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
    });
    const order = await routeAction(
      t,
      cookie,
      route,
      "/stop-order",
      { stopIds: Array.from({ length: 501 }, () => crypto.randomUUID()) },
      "PUT",
    );
    expect(order.status).toBe(400);

    const huge = await raw(`/api/routes/${route.id}/cancel`, {
      body: JSON.stringify({
        actionId: crypto.randomUUID(),
        version: route.version,
        reason: "x".repeat(2 * 1024 * 1024),
      }),
      type: "application/json",
    });
    await expectSafeRefusal(huge, 413);
  });
});

describe("what a request can change", () => {
  it("ignores fields outside the schema", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const route = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
    });
    const changed = await routeAction(
      t,
      cookie,
      route,
      "",
      {
        courierId: ana,
        status: "finished",
        number: 99,
        cancelReason: "Inyectado",
        dispatchedAt: "2026-10-01T15:00:00Z",
        codToCollect: 0,
      },
      "PATCH",
    );
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      number: route.number,
      status: "draft",
      cancelReason: null,
      dispatchedAt: null,
      courier: { name: "Ana Ruiz" },
    });
  });

  it("keeps markup in a reason as plain text", async () => {
    const route = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
    });
    const reason = `<img src=x onerror="alert('domy')">'; drop table routes; --`;
    const cancelled = await routeAction(t, cookie, route, "/cancel", { reason });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.cancelReason).toBe(reason);
    expect(cancelled.body.events.at(-1)?.reason).toBe(reason);
    expect(await routeCount()).toBe(1);
  });

  it("never lets a stale or forged version through", async () => {
    const route = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
    });
    for (const version of [route.version + 1, 0, -1, 1.5, "1", null]) {
      const response = await send<RouteDetail>(t, cookie, `/api/routes/${route.id}/cancel`, {
        actionId: crypto.randomUUID(),
        version,
        reason: "Ruta armada por error",
      });
      expect([400, 409], String(version)).toContain(response.status);
    }
    expect((await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body.status).toBe(
      "draft",
    );
  });
});

describe("headers and session", () => {
  it("forbids framing and content sniffing, and sends no referrer elsewhere", async () => {
    const response = await t.request("/api/routes/board?date=2026-10-01", { cookie });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("keeps the session cookie away from scripts and other sites", async () => {
    const { email, password } = await t.signIn("dispatcher");
    const response = await t.app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const session = response.headers.getSetCookie().find((each) => each.includes("session_token"));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
  });
});
