import { readFileSync } from "node:fs";
import {
  handoverStatuses,
  routeStatuses,
  shipmentKinds,
  shipmentStatuses,
  stopKinds,
  taskStatuses,
  type RouteDetail,
  type Shipment,
} from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../src/lib/errors.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
  pickUp,
  registerShipment,
  routeAction,
  send,
} from "./setup/routes.ts";

/**
 * The HTTP contract of feature 002 (contracts/http-api.md) against the running app: every
 * documented endpoint exists and every route endpoint is documented, every documented error
 * has its status, and every body has exactly the documented shape.
 */

const contract = readFileSync(
  new URL("../../../specs/002-routes-dispatch/contracts/http-api.md", import.meta.url),
  "utf8",
);

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;

const now = new Date("2026-10-01T15:00:00Z");

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: now.toISOString() });
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
});

const named = z.object({ id: z.uuid(), name: z.string().min(1) }).strict();
const instant = z.iso.datetime();
const calendarDay = z.iso.date();
const trackingNumber = z.string().regex(/^[0-9A-Z]{8}$/);

const handover = z
  .object({
    id: z.uuid(),
    shipment: z.object({ id: z.uuid(), trackingNumber }).strict(),
    fromCourier: named,
    toCourier: named,
    fromRouteId: z.uuid().nullable(),
    toRouteId: z.uuid(),
    reason: z.string().min(5).max(200),
    status: z.enum(handoverStatuses),
    requestedBy: named,
    requestedAt: instant,
    resolvedBy: named.nullable(),
    resolvedAt: instant.nullable(),
    resolvedOnBehalf: z.boolean(),
  })
  .strict();

const task = z
  .object({
    id: z.uuid(),
    shipmentId: z.uuid(),
    kind: z.enum(stopKinds),
    status: z.enum(taskStatuses),
    completedAt: instant.nullable(),
    completedBy: named.nullable(),
    blockedByHandoverId: z.uuid().nullable(),
    shipment: z
      .object({
        trackingNumber,
        kind: z.enum(shipmentKinds),
        status: z.enum(shipmentStatuses),
        merchant: named,
        recipientName: z.string().nullable(),
        windowStart: z.string().nullable(),
        windowEnd: z.string().nullable(),
        codAmount: z.int().min(0),
      })
      .strict(),
  })
  .strict();

const routeEvent = z
  .object({
    id: z.uuid(),
    type: z.enum([
      "created",
      "shipment_added",
      "shipment_removed",
      "reordered",
      "courier_set",
      "dispatched",
      "dispatch_undone",
      "reassigned",
      "handover_requested",
      "handover_confirmed",
      "handover_cancelled",
      "cancelled",
      "finished",
    ]),
    actor: named,
    occurredAt: instant,
    shipment: z.object({ id: z.uuid(), trackingNumber }).strict().nullable(),
    fromCourier: named.nullable(),
    toCourier: named.nullable(),
    reason: z.string().nullable(),
    changes: z.record(z.string(), z.unknown()).nullable(),
    onBehalf: z.boolean(),
  })
  .strict();

const routeDetail = z
  .object({
    id: z.uuid(),
    number: z.int().min(1),
    serviceDate: calendarDay,
    status: z.enum(routeStatuses),
    courier: named.extend({ phone: z.string() }).strict().nullable(),
    cancelReason: z.string().nullable(),
    dispatchedAt: instant.nullable(),
    finishedAt: instant.nullable(),
    version: z.int().min(1),
    codToCollect: z.int().min(0),
    progress: z.object({ completed: z.int().min(0), total: z.int().min(0) }).strict(),
    stops: z.array(
      z
        .object({
          id: z.uuid(),
          position: z.int().min(0),
          kind: z.enum(stopKinds),
          address: z.string().min(1),
          neighborhood: named.nullable(),
          tasks: z.array(task).min(1),
        })
        .strict(),
    ),
    handovers: z.array(handover),
    events: z.array(routeEvent).min(1),
  })
  .strict();

const routeSummary = z
  .object({
    id: z.uuid(),
    number: z.int().min(1),
    serviceDate: calendarDay,
    status: z.enum(routeStatuses),
    courier: named.nullable(),
    completedStops: z.int().min(0),
    totalStops: z.int().min(0),
    codToCollect: z.int().min(0),
    atRiskCount: z.int().min(0),
    lateCount: z.int().min(0),
    pendingHandovers: z.int().min(0),
  })
  .strict();

const routesBoard = z
  .object({
    date: calendarDay,
    serverTime: instant,
    routes: z.array(routeSummary),
    routesFromPreviousDays: z.array(routeSummary),
    unassignedCount: z.int().min(0),
  })
  .strict();

const unassignedShipment = z
  .object({
    id: z.uuid(),
    trackingNumber,
    kind: z.enum(shipmentKinds),
    status: z.enum(["registered", "picked_up", "exception"]),
    // Feature 003 FR-031 extends this projection without allowing arbitrary extra fields.
    heldBy: z.union([z.object({ courier: named }).strict(), z.literal("office")]).nullable(),
    serviceDate: calendarDay,
    merchant: named,
    recipientName: z.string().nullable(),
    recipientNeighborhood: named.nullable(),
    rateZone: named.nullable(),
    windowStart: z.string().nullable(),
    windowEnd: z.string().nullable(),
    codAmount: z.int().min(0),
    feeNeedsReview: z.boolean(),
    routeId: z.null(),
    routeNumber: z.null(),
    courier: z.null(),
    recipientPhone: z.string().nullable(),
    merchantReference: z.string().nullable(),
    fee: z.int().min(0),
    registeredAt: instant,
    pickupPoint: z.object({ id: z.uuid(), label: z.string() }).strict().nullable(),
    pickupAddress: z.string().min(1),
    pickupNeighborhood: named,
  })
  .strict();

/** What this feature adds to feature 001's shipment detail. */
const shipmentDetailAdditions = z.object({
  route: z
    .object({
      id: z.uuid(),
      number: z.int().min(1),
      serviceDate: calendarDay,
      status: z.enum(routeStatuses),
      courier: named.nullable(),
    })
    .strict()
    .nullable(),
  custodyCourier: named.nullable(),
  handover: handover.nullable(),
  events: z.array(z.object({ onBehalf: z.boolean() })),
});

const errorBody = z
  .object({
    error: z
      .object({
        code: z.string().regex(/^[a-z_]+$/),
        message: z.string().min(1),
        fields: z.record(z.string(), z.string()).optional(),
      })
      .catchall(z.unknown()),
  })
  .strict();

/** The `METHOD /path` of every row of the contract's endpoint table, without query strings. */
function documentedEndpoints(): string[] {
  return [...contract.matchAll(/^\| `(GET|POST|PUT|PATCH|DELETE) (\/api\/[^`?\s]+)/gm)].map(
    ([, method, path]) => `${String(method)} ${String(path)}`,
  );
}

describe("endpoints (contracts/http-api.md)", () => {
  const registered = () =>
    new Set(
      t.app.routes
        .filter((route) => route.method !== "ALL")
        .map((route) => `${route.method} ${route.path}`),
    );

  it("registers every documented endpoint", () => {
    const documented = documentedEndpoints();
    expect(documented).toHaveLength(16);
    const missing = documented.filter((endpoint) => !registered().has(endpoint));
    expect(missing).toEqual([]);
  });

  it("documents every route, handover, and route-related shipment endpoint", () => {
    const documented = new Set(documentedEndpoints());
    const undocumented = [...registered()].filter(
      (endpoint) =>
        /^\w+ \/api\/(routes|handovers)\b/.test(endpoint) ||
        /^\w+ \/api\/shipments\/(unassigned|:id\/reassign)$/.test(endpoint),
    );
    expect(undocumented.filter((endpoint) => !documented.has(endpoint))).toEqual([]);
  });

  it("answers every documented error code with its documented status", () => {
    const rows = [...contract.matchAll(/^\| (\d{3}) \| `([a-z_]+)` \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(12);
    for (const [, status, code] of rows) {
      const error = new AppError(code as ConstructorParameters<typeof AppError>[0]);
      expect(error.status, String(code)).toBe(Number(status));
      expect(error.message, String(code)).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

describe("bodies (contracts/http-api.md)", () => {
  it("has the documented shape at every step of a route's life", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const beto = await createCourier(database.db, "Beto Gómez");
    const carla = await createCourier(database.db, "Carla Díaz");
    const register = () => registerShipment(t, cookie, catalog);
    const first = await register();
    const second = await register();
    const third = await register();

    const unassigned = await send<{ shipments: unknown[] }>(
      t,
      cookie,
      "/api/shipments/unassigned?date=2026-10-01",
    );
    expect(unassigned.status).toBe(200);
    const initial = z
      .object({ shipments: z.array(unassignedShipment).length(3) })
      .strict()
      .parse(unassigned.body);
    expect(initial.shipments.map((item) => ({ status: item.status, heldBy: item.heldBy }))).toEqual(
      [
        { status: "registered", heldBy: null },
        { status: "registered", heldBy: null },
        { status: "registered", heldBy: null },
      ],
    );

    // Every route action answers the route's detail.
    let route = await createRoute(t, cookie, {
      shipmentIds: [first.id, second.id],
      courierId: ana,
    });
    routeDetail.parse(route);
    const act = async (path: string, body: Record<string, unknown> = {}, method = "POST") => {
      const result = await routeAction(t, cookie, route, path, body, method);
      expect(result.status, `${method} ${path}`).toBe(200);
      routeDetail.parse(result.body);
      route = result.body;
      return route;
    };
    await act("", { courierId: beto }, "PATCH");
    // The shared pickup stop first, then the two deliveries swapped.
    const [pickupStop, ...deliveries] = route.stops.map((stop) => stop.id);
    await act("/stop-order", { stopIds: [pickupStop, ...deliveries.reverse()] }, "PUT");
    await act("/shipments", { shipmentIds: [third.id] });
    await act(`/shipments/${third.id}/remove`);
    expect((await act("/dispatch")).status).toBe("in_progress");
    routeDetail.parse((await send(t, cookie, `/api/routes/${route.id}`)).body);

    const board = await send(t, cookie, "/api/routes/board?date=2026-10-01");
    expect(board.status).toBe(200);
    expect(routesBoard.parse(board.body).routes).toHaveLength(1);

    // A picked-up shipment moved to another courier's route waits for a handover.
    const other = (
      await routeAction(
        t,
        cookie,
        await createRoute(t, cookie, { shipmentIds: [third.id], courierId: ana }),
        "/dispatch",
      )
    ).body;
    await pickUp(database.db, first.id, now);
    const moved = await send<{ shipment: Shipment; handover: unknown }>(
      t,
      cookie,
      `/api/shipments/${first.id}/reassign`,
      { actionId: crypto.randomUUID(), toRouteId: other.id, reason: "Ana pasa por la zona" },
    );
    expect(moved.status).toBe(200);
    expect(Object.keys(moved.body).sort()).toEqual(["handover", "shipment"]);
    const pending = handover.parse(moved.body.handover);
    expect(pending.status).toBe("pending");

    const detail = await send(t, cookie, `/api/shipments/${first.id}`);
    expect(shipmentDetailAdditions.parse(detail.body)).toMatchObject({
      route: { id: other.id },
      custodyCourier: { name: "Beto Gómez" },
      handover: { id: pending.id },
    });

    const confirmed = await send(t, cookie, `/api/handovers/${pending.id}/confirm`, {
      actionId: crypto.randomUUID(),
    });
    expect(handover.parse(confirmed.body)).toMatchObject({
      status: "confirmed",
      resolvedOnBehalf: true,
    });

    // Moved back to Beto, and cancelled: the delivery returns to Ana's route.
    const latest = (await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body;
    route = latest;
    const back = await send<{ handover: unknown }>(
      t,
      cookie,
      `/api/shipments/${first.id}/reassign`,
      {
        actionId: crypto.randomUUID(),
        toRouteId: route.id,
        reason: "Beto vuelve a la zona",
      },
    );
    const again = handover.parse(back.body.handover);
    const cancelled = await send(t, cookie, `/api/handovers/${again.id}/cancel`, {
      actionId: crypto.randomUUID(),
    });
    expect(handover.parse(cancelled.body).status).toBe("cancelled");

    // Reassigning, undoing, and cancelling also answer the route's detail.
    route = (await send<RouteDetail>(t, cookie, `/api/routes/${route.id}`)).body;
    await act("/reassign", { courierId: carla, reason: "Beto terminó su turno" });
    route = await createRoute(t, cookie, {
      shipmentIds: [(await register()).id],
      courierId: await createCourier(database.db, "Darío Mesa"),
    });
    await act("/dispatch");
    expect((await act("/undo-dispatch", { reason: "Despachada por error" })).status).toBe("draft");
    expect((await act("/cancel", { reason: "Ruta armada por error" })).status).toBe("cancelled");
  });

  it("answers every refusal with the error body", async () => {
    const ana = await createCourier(database.db, "Ana Ruiz");
    const busy = await routeAction(
      t,
      cookie,
      await createRoute(t, cookie, {
        shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
        courierId: ana,
      }),
      "/dispatch",
    );
    const second = await createRoute(t, cookie, {
      shipmentIds: [(await registerShipment(t, cookie, catalog)).id],
      courierId: ana,
    });

    const refusals = [
      await routeAction(t, cookie, second, "/dispatch"),
      await routeAction(t, cookie, { ...second, version: second.version + 5 }, "/dispatch"),
      await routeAction(t, cookie, second, "/cancel", { reason: "no" }),
      await send(t, cookie, `/api/routes/${crypto.randomUUID()}`),
      await send(t, cookie, "/api/routes", { id: "not-a-uuid" }),
    ];
    expect(refusals.map((refusal) => refusal.status)).toEqual([409, 409, 400, 404, 400]);
    for (const refusal of refusals) errorBody.parse(refusal.body);
    expect(refusals[0]?.body).toMatchObject({
      error: { code: "courier_busy", routeId: busy.body.id, routeNumber: busy.body.number },
    });
    expect(refusals[1]?.body).toMatchObject({ error: { code: "version_conflict" } });
    expect(refusals[2]?.body).toMatchObject({
      error: { code: "invalid_request", fields: { reason: expect.any(String) } },
    });
  });
});
