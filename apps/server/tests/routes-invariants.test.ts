import type { RouteDetail, RoutesBoard, ShipmentDetail, UnassignedShipment } from "@domy/domain";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createCourier, finishTask, pickUp, registerShipment, send } from "./setup/routes.ts";

/**
 * SC-002 under a random but reproducible sequence of route actions by two dispatchers, with
 * the courier app's pickups and deliveries (feature 003) in between. Every action is sent
 * twice with the same `actionId` and has exactly one effect (FR-020); a stale `version` is
 * always refused and changes nothing (FR-021); and after every step every shipment that is
 * not final is either unassigned or on exactly one route in preparation or in progress.
 */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let users: string[];
let couriers: string[];

const now = new Date("2026-10-01T15:00:00Z");
const today = "2026-10-01";

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
  users = [owner.cookie, (await t.signIn("dispatcher")).cookie];
  couriers = [];
  for (const name of ["Ana", "Beto", "Carla", "Darío"]) {
    couriers.push(await createCourier(database.db, name));
  }
});

/** Mulberry32: a small seeded generator, so a failing sequence can be replayed. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(list: readonly T[]): T | undefined =>
    list.length === 0 ? undefined : list[Math.floor(next() * list.length)];
  return { next, pick };
}

type Request = { path: string; body: Record<string, unknown>; method?: string };

const rows = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) => [
  ...(await database.db.execute<T>(query)),
];

/** Everything an action could change; equal before and after a replay. */
const fingerprint = async () =>
  JSON.stringify(
    await rows(sql`select
      (select count(*) from route_events) as route_events,
      (select count(*) from shipment_events) as shipment_events,
      (select count(*) from routes) as routes,
      (select coalesce(sum(version), 0) from routes) as route_versions,
      (select coalesce(sum(version), 0) from shipments) as shipment_versions,
      (select count(*) from handovers) as handovers,
      (select count(*) from route_tasks) as tasks`),
  );

/** SC-002 and the rules around it, straight from the database. */
async function expectInvariants(step: string) {
  const broken = await rows<{ rule: string; id: string }>(sql`
    select 'not final, not unassigned, and not on a route in preparation or in progress' as rule, s.id::text
      from shipments s left join routes r on r.id = s.route_id
      where s.status not in ('delivered', 'returned', 'voided')
        and not (s.status = 'registered' and s.route_id is null)
        and not (r.status in ('draft', 'in_progress'))
    union all
    select 'status does not match its route', s.id::text
      from shipments s join routes r on r.id = s.route_id
      where s.status not in ('delivered', 'returned', 'voided')
        and not ((r.status = 'draft' and s.status = 'assigned')
          or (r.status = 'in_progress' and s.status in ('dispatched', 'picked_up')))
    union all
    select 'pending task on another route', t.id::text
      from route_tasks t join route_stops st on st.id = t.stop_id
      join shipments s on s.id = t.shipment_id
      where t.status = 'pending' and st.route_id is distinct from s.route_id
    union all
    select 'wrong pending tasks for its status', s.id::text
      from shipments s
      where s.status in ('assigned', 'dispatched', 'picked_up')
        and (select count(*) filter (where kind = 'pickup') from route_tasks
               where shipment_id = s.id and status = 'pending')
            <> (case when s.status = 'picked_up' then 0 else 1 end)
         or s.status in ('assigned', 'dispatched', 'picked_up')
        and (select count(*) from route_tasks
               where shipment_id = s.id and status = 'pending' and kind = 'delivery') <> 1
    union all
    select 'two routes in progress', courier_id::text
      from routes where status = 'in_progress' group by courier_id having count(*) > 1
    union all
    select 'custody gap', s.id::text from shipments s
      where (s.status = 'picked_up') <> (s.custody_courier_id is not null)
    union all
    select 'route in progress with nothing left', r.id::text from routes r
      where r.status = 'in_progress'
        and not exists (select 1 from route_tasks t join route_stops st on st.id = t.stop_id
                        where st.route_id = r.id and t.status = 'pending')
        and not exists (select 1 from handovers h where h.status = 'pending'
                        and r.id in (h.from_route_id, h.to_route_id))
    union all
    select 'handover not blocking its delivery', h.id::text from handovers h
      join shipments s on s.id = h.shipment_id
      where h.status = 'pending'
        and (s.status <> 'picked_up' or s.route_id <> h.to_route_id
          or not exists (select 1 from route_tasks t where t.blocked_by_handover_id = h.id
                         and t.kind = 'delivery' and t.status = 'pending'))`);
  expect(broken, step).toEqual([]);
  const board = await send<RoutesBoard>(t, users[0] ?? "", `/api/routes/board?date=${today}`);
  const [registered] = await rows<{ count: number }>(
    sql`select count(*)::int as count from shipments where status = 'registered'`,
  );
  expect(board.body.unassignedCount, step).toBe(registered?.count);
}

/** Each step: a dispatcher's request, or the courier app's pickup or delivery. */
async function nextStep(random: ReturnType<typeof generator>): Promise<Request | string | null> {
  const board = (await send<RoutesBoard>(t, users[0] ?? "", `/api/routes/board?date=${today}`))
    .body;
  const open = board.routes.filter((route) => ["draft", "in_progress"].includes(route.status));
  const unassigned = (
    await send<{ shipments: UnassignedShipment[] }>(
      t,
      users[0] ?? "",
      `/api/shipments/unassigned?date=${today}`,
    )
  ).body.shipments;
  const routeId = random.pick(open)?.id;
  const route = routeId
    ? (await send<RouteDetail>(t, users[0] ?? "", `/api/routes/${routeId}`)).body
    : null;
  const tasks = route?.stops.flatMap((stop) => stop.tasks) ?? [];
  const some = (count: number) =>
    unassigned
      .filter(() => random.next() < 0.5)
      .slice(0, count)
      .map((shipment) => shipment.id);
  const action = { actionId: crypto.randomUUID(), version: route?.version };
  const reason = "Cambio de la prueba de invariantes";

  switch (random.pick(["register", "create", "route", "route", "route", "courier", "shipment"])) {
    case "register":
      await registerShipment(t, users[0] ?? "", catalog);
      return "registered a shipment";
    case "create": {
      const shipmentIds = some(3);
      if (shipmentIds.length === 0) return null;
      const id = crypto.randomUUID();
      const courierId = random.next() < 0.6 ? random.pick(couriers) : undefined;
      return {
        path: "/api/routes",
        body: {
          id,
          actionId: id,
          serviceDate: today,
          shipmentIds,
          ...(courierId && { courierId }),
        },
      };
    }
    case "courier": {
      // The courier app (feature 003): a pickup or a delivery not blocked by a handover.
      const pickup = random.pick(
        tasks.filter((task) => task.kind === "pickup" && task.status === "pending"),
      );
      const delivery = random.pick(
        tasks.filter(
          (task) =>
            task.kind === "delivery" &&
            task.status === "pending" &&
            !task.blockedByHandoverId &&
            task.shipment.status === "picked_up",
        ),
      );
      if (route?.status !== "in_progress") return null;
      if (delivery && random.next() < 0.5) {
        await finishTask(database.db, delivery.shipmentId, "delivered", now);
        return "delivered a package";
      }
      if (!pickup) return null;
      await pickUp(database.db, pickup.shipmentId, now);
      return "picked up a package";
    }
    case "shipment": {
      const task = random.pick(
        tasks.filter((each) => each.kind === "delivery" && each.status === "pending"),
      );
      if (!route || !task) return null;
      const target = random.pick(open.filter((each) => each.id !== route.id));
      const handover = route.handovers.find((each) => each.status === "pending");
      if (handover && random.next() < 0.5) {
        const verb = random.next() < 0.5 ? "confirm" : "cancel";
        return {
          path: `/api/handovers/${handover.id}/${verb}`,
          body: { actionId: crypto.randomUUID() },
        };
      }
      if (target && random.next() < 0.7) {
        return {
          path: `/api/shipments/${task.shipmentId}/reassign`,
          body: { actionId: crypto.randomUUID(), toRouteId: target.id, reason },
        };
      }
      const shipment = (
        await send<ShipmentDetail>(t, users[0] ?? "", `/api/shipments/${task.shipmentId}`)
      ).body;
      return {
        path: `/api/shipments/${task.shipmentId}/void`,
        body: { actionId: crypto.randomUUID(), version: shipment.version, reason },
      };
    }
    default: {
      if (!route) return null;
      const removable = random.pick(
        tasks.filter((task) => ["assigned", "dispatched"].includes(task.shipment.status)),
      );
      const pending = route.stops.filter((stop) =>
        stop.tasks.some((each) => each.status === "pending"),
      );
      const choices: Request[] = [
        { path: `/api/routes/${route.id}/dispatch`, body: action },
        { path: `/api/routes/${route.id}/undo-dispatch`, body: { ...action, reason } },
        { path: `/api/routes/${route.id}/cancel`, body: { ...action, reason } },
        {
          path: `/api/routes/${route.id}`,
          method: "PATCH",
          body: { ...action, courierId: random.pick(couriers) },
        },
        {
          path: `/api/routes/${route.id}/reassign`,
          body: {
            ...action,
            courierId: random.pick(couriers.filter((each) => each !== route.courier?.id)),
            reason,
          },
        },
      ];
      if (route.stops.length > 0) {
        // The pending deliveries reversed in their places; pickups and done stops stay.
        const movable = pending.filter((stop) => stop.kind === "delivery").reverse();
        choices.push({
          path: `/api/routes/${route.id}/stop-order`,
          method: "PUT",
          body: {
            ...action,
            stopIds: route.stops.map((stop) =>
              stop.kind === "delivery" && pending.includes(stop) ? movable.shift()?.id : stop.id,
            ),
          },
        });
      }
      if (removable) {
        choices.push({
          path: `/api/routes/${route.id}/shipments/${removable.shipmentId}/remove`,
          body: action,
        });
      }
      const extra = some(2);
      if (extra.length > 0) {
        choices.push({
          path: `/api/routes/${route.id}/shipments`,
          body: { ...action, shipmentIds: extra },
        });
      }
      return random.pick(choices) ?? null;
    }
  }
}

describe("route integrity under random actions (SC-002, FR-020, FR-021)", () => {
  it.each([7, 2026, 31337])("holds for seed %i", async (seed) => {
    const random = generator(seed);
    for (let index = 0; index < 8; index++) await registerShipment(t, users[0] ?? "", catalog);
    let applied = 0;
    for (let step = 0; step < 90; step++) {
      const request = await nextStep(random);
      if (request === null) continue;
      const label = `seed ${String(seed)}, step ${String(step)}: ${typeof request === "string" ? request : `${request.method ?? "POST"} ${request.path}`}`;
      if (typeof request !== "string") {
        const cookie = random.pick(users) ?? "";
        const first = await send(t, cookie, request.path, request.body, request.method ?? "POST");
        // A refusal is an answer, never a server error or a malformed request.
        expect([200, 201, 409, 422], `${label} → ${JSON.stringify(first.body)}`).toContain(
          first.status,
        );
        const before = await fingerprint();
        const replay = await send(t, cookie, request.path, request.body, request.method ?? "POST");
        if (first.status < 300) {
          applied++;
          expect(replay.status, `${label} replayed`).toBe(200);
        }
        expect(await fingerprint(), `${label} replayed`).toBe(before);

        // A version the action moved past is stale; one it kept (no change) is not.
        const version = request.body["version"];
        const moved = (first.body as { version?: unknown }).version;
        if (
          first.status < 300 &&
          typeof version === "number" &&
          typeof moved === "number" &&
          moved > version &&
          request.path.startsWith("/api/routes/")
        ) {
          const stale = await send(
            t,
            cookie,
            request.path,
            { ...request.body, actionId: crypto.randomUUID() },
            request.method ?? "POST",
          );
          expect(stale.status, `${label} with a stale version`).toBe(409);
          expect(stale.body, `${label} with a stale version`).toMatchObject({
            error: { code: expect.stringMatching(/^version_conflict$/) },
          });
          expect(await fingerprint(), `${label} with a stale version`).toBe(before);
        }
      }
      await expectInvariants(label);
    }
    // The sequence really exercised the routes, not only refusals.
    expect(applied).toBeGreaterThan(20);
  });
});
