import type { RouteDetail, RoutesBoard } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, registerShipment, send } from "./setup/routes.ts";

/**
 * Task 002/T063 and Finding IV-13: Exact financial aggregates on route projections.
 * Two valid COD shipments of COP 1,200,000,000 produce an aggregate total of COP 2,400,000,000.
 * In int32 (PostgreSQL integer), this exceeds 2,147,483,647, causing integer out of range (22003)
 * if cast with SUM(...)::int.
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
  // 10:00 in Bogotá on Thursday 1 October 2026.
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  const dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
  cookie = dispatcher.cookie;
});

const register = (overrides: Record<string, unknown> = {}) =>
  registerShipment(t, cookie, catalog, overrides);

describe("Route financial aggregates beyond int32 bounds (Finding IV-13 / T063)", () => {
  it("computes exact COD aggregates on create, detail, board, and dispatch without int32 overflow", async () => {
    // 1. Register two high-value COD shipments: COP 1,200,000,000 each.
    // Each individually fits within standard PostgreSQL integer limits (<= 2,147,483,647).
    const s1 = await register({
      codAmount: 1_200_000_000,
      confirmed: true,
    });
    const s2 = await register({
      codAmount: 1_200_000_000,
      confirmed: true,
    });

    // Also register a shipment with merchant_account (codAmount: 0) to verify mixed payment modes.
    const s3 = await register({
      paymentMode: "merchant_account",
      codAmount: undefined,
    });

    const expectedCodTotal = 2_400_000_000; // 2.4 billion COP > int32 max (2,147,483,647)
    const courierId = await createCourier(database.db, "Carlos Perez");

    // 2. Create route with both high-value shipments and the zero-COD shipment.
    // Previously, this transaction committed but loadRouteDetail threw 22003 (integer out of range)
    // due to SUM(...)::int, returning HTTP 500.
    const routeId = crypto.randomUUID();
    const actionId = crypto.randomUUID();
    const createRes = await send<RouteDetail>(t, cookie, "/api/routes", {
      id: routeId,
      actionId,
      serviceDate: "2026-10-01",
      shipmentIds: [s1.id, s2.id, s3.id],
      courierId,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.codToCollect).toBe(expectedCodTotal);
    expect(Number.isSafeInteger(createRes.body.codToCollect)).toBe(true);

    // 3. Exact replay of creation returns 200 with unchanged aggregate.
    const replayRes = await send<RouteDetail>(t, cookie, "/api/routes", {
      id: routeId,
      actionId,
      serviceDate: "2026-10-01",
      shipmentIds: [s1.id, s2.id, s3.id],
      courierId,
    });
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.codToCollect).toBe(expectedCodTotal);

    // 4. Query route detail (GET /api/routes/:id).
    const detailRes = await send<RouteDetail>(t, cookie, `/api/routes/${routeId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.codToCollect).toBe(expectedCodTotal);

    // 5. Query routes board (GET /api/routes/board).
    const boardRes = await send<RoutesBoard>(t, cookie, "/api/routes/board?date=2026-10-01");
    expect(boardRes.status).toBe(200);
    const summary = boardRes.body.routes.find((r) => r.id === routeId);
    expect(summary).toBeDefined();
    expect(summary?.codToCollect).toBe(expectedCodTotal);

    // 6. Dispatch the route (POST /api/routes/:id/dispatch).
    const dispatchRes = await send<RouteDetail>(t, cookie, `/api/routes/${routeId}/dispatch`, {
      actionId: crypto.randomUUID(),
      version: detailRes.body.version,
    });
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.status).toBe("in_progress");
    expect(dispatchRes.body.codToCollect).toBe(expectedCodTotal);
  });
});
