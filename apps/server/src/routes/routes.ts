import {
  addShipmentToStops,
  bogotaToday,
  buildStops,
  canUndoDispatch,
  needsLargeRouteConfirmation,
  routeActionInput,
  routeAddShipmentsInput,
  routeCourierInput,
  routeCreateInput,
  routeJoinInput,
  routeReasonInput,
  routeReassignInput,
  routesBoardQuery,
  shipmentStatusLabels,
  stopOrderInput,
  validateStopOrder,
  type RoutesBoard,
  type RouteStopPlan,
} from "@domy/domain";
import { and, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { couriers, routes, shipmentEvents, shipments } from "../db/schema/index.ts";
import { findRouteAction } from "../lib/action-id.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  claimVersion,
  loadPlan,
  loadRouteDetail,
  loadRouteRow,
  loadRouteSummaries,
  planShipments,
  recordRouteEvents,
  removeFromPlan,
  savePlan,
  transitionShipments,
  unassignedUpTo,
  type NewRouteEvent,
  type RouteRow,
} from "../lib/route-store.ts";
import {
  blockDelivery,
  cancelPendingHandover,
  handoverEvent,
  lockRoutes,
  moveShipment,
  requestHandover,
} from "../lib/reassignment.ts";
import { refreshRouteStatus } from "../lib/route-status.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const idParam = z.object({ id: z.uuid() });
async function requireActiveCourier(db: Executor, courierId: string) {
  const [courier] = await db
    .select({ id: couriers.id, isActive: couriers.isActive })
    .from(couriers)
    .where(eq(couriers.id, courierId));
  if (!courier?.isActive) {
    throw new AppError("invalid_request", { fields: { courierId: "Elige un mensajero activo." } });
  }
}

/** The courier's route in progress, for the `courier_busy` answer (FR-009). */
async function courierBusy(db: Executor, courierId: string): Promise<AppError> {
  const [current] = await db
    .select({ id: routes.id, number: routes.number, courier: couriers.name })
    .from(routes)
    .innerJoin(couriers, eq(couriers.id, routes.courierId))
    .where(and(eq(routes.courierId, courierId), eq(routes.status, "in_progress")));
  return new AppError("courier_busy", {
    message: current
      ? `${current.courier} ya tiene la Ruta ${String(current.number)} en curso.`
      : "Ese mensajero ya tiene una ruta en curso.",
    details: { routeId: current?.id, routeNumber: current?.number },
  });
}

/** Rolls back an action that changed nothing (setting the courier a route already has). */
class Unchanged extends Error {}

/**
 * Applies one action on an existing route exactly once (FR-020) and only on the version the
 * user saw (FR-021). `apply` changes the route and returns its events; the first one stores
 * the action identifier. A route in progress left with nothing pending then finishes
 * (FR-012, research R9).
 */
async function applyRouteAction(
  c: Context<AppEnv>,
  routeId: string,
  input: { actionId: string; version: number },
  apply: (tx: Executor, route: RouteRow, now: Date) => Promise<NewRouteEvent[]>,
  /** Another route the action changes, locked with this one in the shared order. */
  alsoLock?: string,
): Promise<Response> {
  const db = c.get("db");
  if (await findRouteAction(db, input.actionId)) return c.json(await loadRouteDetail(db, routeId));
  const now = c.get("clock")();
  await db
    .transaction(async (tx) => {
      await loadRouteRow(tx, routeId);
      if (alsoLock) await lockRoutes(tx, [routeId, alsoLock]);
      await claimVersion(tx, routeId, input.version, now);
      const events = await apply(tx, await loadRouteRow(tx, routeId), now);
      // An action that changes nothing keeps the version, so repeating it answers the same.
      if (events.length === 0) throw new Unchanged();
      const [first, ...rest] = events;
      if (first)
        await recordRouteEvents(tx, [{ ...first, clientEventId: input.actionId }, ...rest]);
      await refreshRouteStatus(tx, routeId, { actorUserId: c.get("user").id, now });
    })
    .catch((error: unknown) => {
      if (error instanceof Unchanged) return;
      if (isUniqueViolation(error, "route_events_client_event_id_key")) return;
      throw error;
    });
  return c.json(await loadRouteDetail(db, routeId));
}

/** A shipment joins a route up to the later of the route's date and today (FR-003). */
const latestDate = (serviceDate: string, today: string) =>
  serviceDate > today ? serviceDate : today;

const notRegisteredMessage =
  "Algún envío ya no está «Registrado», ya está en una ruta o tiene una fecha posterior a la de la ruta. Actualiza la lista.";

function requireStatus(route: RouteRow, allowed: RouteRow["status"][], message: string) {
  if (!allowed.includes(route.status)) {
    throw new AppError(
      route.status === "in_progress" ? "route_in_progress" : "route_not_in_progress",
      {
        message,
      },
    );
  }
}

export const routeRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  // A route from selected shipments, today or later (FR-002–FR-005, FR-020).
  .post("/", validate("json", routeCreateInput), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("db");
    const user = c.get("user");
    const [existing] = await db
      .select({ id: routes.id })
      .from(routes)
      .where(eq(routes.id, input.id));
    if (existing || (await findRouteAction(db, input.actionId))) {
      return c.json(await loadRouteDetail(db, input.id), 200);
    }
    const now = c.get("clock")();
    const today = bogotaToday(now);
    if (input.serviceDate < today) throw new AppError("past_service_date");
    const shipmentIds = [...new Set(input.shipmentIds)];
    if (needsLargeRouteConfirmation(shipmentIds.length) && !input.confirmed) {
      throw new AppError("confirmation_required", {
        message: `La ruta tendría ${String(shipmentIds.length)} envíos; confirma para crearla.`,
      });
    }
    if (input.courierId) await requireActiveCourier(db, input.courierId);

    for (let attempt = 0; ; attempt++) {
      try {
        await db.transaction(async (tx) => {
          await tx.insert(routes).values({
            id: input.id,
            serviceDate: input.serviceDate,
            number: sql`(select coalesce(max(${routes.number}), 0) + 1 from ${routes} where ${routes.serviceDate} = ${input.serviceDate})`,
            courierId: input.courierId ?? null,
            createdBy: user.id,
          });
          const moved = await transitionShipments(tx, {
            ids: shipmentIds,
            from: ["registered"],
            to: "assigned",
            routeId: input.id,
            eventRouteId: input.id,
            actorUserId: user.id,
            occurredAt: now,
            extraWhere: and(
              isNull(shipments.routeId),
              lte(shipments.serviceDate, latestDate(input.serviceDate, today)),
            ),
          });
          if (moved.length !== shipmentIds.length) {
            throw new AppError("shipment_not_registered", { message: notRegisteredMessage });
          }
          await savePlan(
            tx,
            input.id,
            [],
            buildStops(await planShipments(tx, shipmentIds), () => crypto.randomUUID()),
          );
          await recordRouteEvents(tx, [
            {
              routeId: input.id,
              type: "created",
              actorUserId: user.id,
              occurredAt: now,
              changes: { shipmentIds },
              clientEventId: input.actionId,
            },
            ...(input.courierId
              ? [
                  {
                    routeId: input.id,
                    type: "courier_set" as const,
                    actorUserId: user.id,
                    occurredAt: now,
                    toCourierId: input.courierId,
                  },
                ]
              : []),
          ]);
        });
        return c.json(await loadRouteDetail(db, input.id), 201);
      } catch (error) {
        if (isUniqueViolation(error, "routes_pkey")) {
          return c.json(await loadRouteDetail(db, input.id), 200);
        }
        if (attempt < 5 && isUniqueViolation(error, "routes_service_date_number_key")) continue;
        throw error;
      }
    }
  })
  // The routes of a date and, on today's board, those still in progress from earlier days
  // (FR-018, clarification Q1); flags use the server clock.
  .get("/board", validate("query", routesBoardQuery), async (c) => {
    const db = c.get("db");
    const now = c.get("clock")();
    const today = bogotaToday(now);
    const date = c.req.valid("query").date ?? today;
    const [unassigned] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(shipments)
      .where(unassignedUpTo(date));
    return c.json({
      date,
      serverTime: now.toISOString(),
      routes: await loadRouteSummaries(db, eq(routes.serviceDate, date), now),
      routesFromPreviousDays:
        date === today
          ? await loadRouteSummaries(
              db,
              and(eq(routes.status, "in_progress"), lt(routes.serviceDate, today)),
              now,
            )
          : [],
      unassignedCount: unassigned?.count ?? 0,
    } satisfies RoutesBoard);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    return c.json(await loadRouteDetail(c.get("db"), c.req.valid("param").id));
  })
  // The courier of a route in preparation; no reason needed (FR-008).
  .patch("/:id", validate("param", idParam), validate("json", routeCourierInput), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    await requireActiveCourier(c.get("db"), input.courierId);
    return applyRouteAction(c, id, input, async (tx, route, now) => {
      requireStatus(
        route,
        ["draft"],
        "Solo se cambia el mensajero de una ruta en preparación; una ruta en curso se reasigna.",
      );
      if (route.courierId === input.courierId) return [];
      await tx.update(routes).set({ courierId: input.courierId }).where(eq(routes.id, id));
      return [
        {
          routeId: id,
          type: "courier_set",
          actorUserId: c.get("user").id,
          occurredAt: now,
          fromCourierId: route.courierId,
          toCourierId: input.courierId,
        },
      ];
    });
  })
  // The dispatcher's order of the stops (FR-006, FR-007).
  .put(
    "/:id/stop-order",
    validate("param", idParam),
    validate("json", stopOrderInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      return applyRouteAction(c, id, input, async (tx, route, now) => {
        requireStatus(
          route,
          ["draft", "in_progress"],
          "Solo se ordenan rutas en preparación o en curso.",
        );
        const before = await loadPlan(tx, id);
        const after = input.stopIds.flatMap((stopId) =>
          before.filter((stop) => stop.id === stopId),
        );
        const problem = validateStopOrder(before, after);
        if (problem) throw new AppError("invalid_stop_order", { message: problem });
        await savePlan(tx, id, before, after);
        return [
          {
            routeId: id,
            type: "reordered",
            actorUserId: c.get("user").id,
            occurredAt: now,
            changes: { before: before.map((stop) => stop.id), after: input.stopIds },
          },
        ];
      });
    },
  )
  // Shipments added to a route in preparation or in progress (FR-003, FR-005, FR-011).
  .post(
    "/:id/shipments",
    validate("param", idParam),
    validate("json", routeAddShipmentsInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const shipmentIds = [...new Set(input.shipmentIds)];
      return applyRouteAction(c, id, input, async (tx, route, now) => {
        requireStatus(
          route,
          ["draft", "in_progress"],
          "Solo se agregan envíos a rutas en preparación o en curso.",
        );
        const [carried] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(shipments)
          .where(eq(shipments.routeId, id));
        const total = (carried?.count ?? 0) + shipmentIds.length;
        if (needsLargeRouteConfirmation(total) && !input.confirmed) {
          throw new AppError("confirmation_required", {
            message: `La ruta quedaría con ${String(total)} envíos; confirma para agregarlos.`,
          });
        }
        const today = bogotaToday(now);
        const user = c.get("user");
        const moved = await transitionShipments(tx, {
          ids: shipmentIds,
          from: ["registered"],
          to: route.status === "draft" ? "assigned" : "dispatched",
          routeId: id,
          eventRouteId: id,
          actorUserId: user.id,
          occurredAt: now,
          extraWhere: and(
            isNull(shipments.routeId),
            lte(shipments.serviceDate, latestDate(route.serviceDate, today)),
          ),
        });
        if (moved.length !== shipmentIds.length) {
          throw new AppError("shipment_not_registered", { message: notRegisteredMessage });
        }
        const before = await loadPlan(tx, id);
        const after = (await planShipments(tx, shipmentIds)).reduce<RouteStopPlan[]>(
          (stops, shipment) => addShipmentToStops(stops, shipment, () => crypto.randomUUID()),
          before,
        );
        await savePlan(tx, id, before, after);
        return shipmentIds.map((shipmentId) => ({
          routeId: id,
          type: "shipment_added" as const,
          actorUserId: user.id,
          occurredAt: now,
          shipmentId,
        }));
      });
    },
  )
  // A shipment not picked up leaves the route and is "Registrado" again (FR-012).
  .post(
    "/:id/shipments/:shipmentId/remove",
    validate("param", z.object({ id: z.uuid(), shipmentId: z.uuid() })),
    validate("json", routeActionInput),
    async (c) => {
      const { id, shipmentId } = c.req.valid("param");
      const input = c.req.valid("json");
      return applyRouteAction(c, id, input, async (tx, route, now) => {
        requireStatus(
          route,
          ["draft", "in_progress"],
          "Solo se quitan envíos de rutas en preparación o en curso.",
        );
        const [shipment] = await tx
          .select({ status: shipments.status, routeId: shipments.routeId })
          .from(shipments)
          .where(eq(shipments.id, shipmentId))
          .for("update");
        if (shipment?.routeId !== id) {
          throw new AppError("not_found", { message: "Ese envío no está en esta ruta." });
        }
        if (shipment.status === "picked_up") throw new AppError("shipment_picked_up");
        if (shipment.status !== "assigned" && shipment.status !== "dispatched") {
          throw new AppError("shipment_not_movable", {
            message: `Un envío «${shipmentStatusLabels[shipment.status]}» no se quita de la ruta.`,
          });
        }
        const user = c.get("user");
        await transitionShipments(tx, {
          ids: [shipmentId],
          from: ["assigned", "dispatched"],
          to: "registered",
          routeId: null,
          eventRouteId: id,
          actorUserId: user.id,
          occurredAt: now,
        });
        return [
          await removeFromPlan(tx, id, shipmentId, { actorUserId: user.id, occurredAt: now }),
        ];
      });
    },
  )
  // A route in progress passes to another courier with a reason (FR-015, FR-016, FR-025).
  .post(
    "/:id/reassign",
    validate("param", idParam),
    validate("json", routeReassignInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      await requireActiveCourier(c.get("db"), input.courierId);
      try {
        return await applyRouteAction(c, id, input, async (tx, route, now) => {
          requireStatus(
            route,
            ["in_progress"],
            "Solo se reasigna una ruta en curso; en una ruta en preparación, cambia el mensajero.",
          );
          if (route.courierId === input.courierId) {
            throw new AppError("invalid_request", {
              fields: { courierId: "La ruta ya es de ese mensajero." },
            });
          }
          const by = { actorUserId: c.get("user").id, now };
          await tx.update(routes).set({ courierId: input.courierId }).where(eq(routes.id, id));
          const events: NewRouteEvent[] = [
            {
              routeId: id,
              type: "reassigned",
              actorUserId: by.actorUserId,
              occurredAt: now,
              fromCourierId: route.courierId,
              toCourierId: input.courierId,
              reason: input.reason,
            },
          ];
          // Pending stops pass with the route; completed ones keep who did them. A package
          // someone else holds waits for its handover, replacing a pending one (FR-025).
          const carried = await tx
            .select({
              id: shipments.id,
              status: shipments.status,
              custodyCourierId: shipments.custodyCourierId,
            })
            .from(shipments)
            .where(
              and(
                eq(shipments.routeId, id),
                inArray(shipments.status, ["dispatched", "picked_up"]),
              ),
            );
          for (const shipment of carried.filter((each) => each.status === "picked_up")) {
            const cancelled = await cancelPendingHandover(tx, shipment.id, by);
            if (cancelled) events.push(handoverEvent("handover_cancelled", id, cancelled, by));
            const holder = shipment.custodyCourierId;
            if (holder && holder !== input.courierId) {
              const handover = await requestHandover(
                tx,
                {
                  shipmentId: shipment.id,
                  fromCourierId: holder,
                  toCourierId: input.courierId,
                  fromRouteId: cancelled?.fromRouteId ?? id,
                  toRouteId: id,
                  reason: input.reason,
                },
                by,
              );
              events.push(handoverEvent("handover_requested", id, handover, by));
            } else if (cancelled) {
              await blockDelivery(tx, shipment.id, null);
            }
          }
          if (carried.length > 0) {
            await tx.insert(shipmentEvents).values(
              carried.map((shipment) => ({
                shipmentId: shipment.id,
                type: "reassigned" as const,
                fromStatus: shipment.status,
                toStatus: shipment.status,
                reason: input.reason,
                actorUserId: by.actorUserId,
                occurredAt: now,
                routeId: id,
                changes: { courierId: [route.courierId, input.courierId] },
              })),
            );
          }
          return events;
        });
      } catch (error) {
        if (isUniqueViolation(error, "routes_one_in_progress_per_courier")) {
          throw await courierBusy(c.get("db"), input.courierId);
        }
        throw error;
      }
    },
  )
  // Dispatch: the route goes to its courier and its shipments are on the way (FR-009).
  .post(
    "/:id/dispatch",
    validate("param", idParam),
    validate("json", routeActionInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        return await applyRouteAction(c, id, input, async (tx, route, now) => {
          requireStatus(route, ["draft"], "Solo se despachan rutas en preparación.");
          if (!route.courierId) throw new AppError("courier_required");
          if ((await loadPlan(tx, id)).length === 0) throw new AppError("route_empty");
          const user = c.get("user");
          await tx
            .update(routes)
            .set({ status: "in_progress", dispatchedAt: now, dispatchedBy: user.id })
            .where(eq(routes.id, id));
          await transitionShipments(tx, {
            ids: (
              await tx
                .select({ id: shipments.id })
                .from(shipments)
                .where(and(eq(shipments.routeId, id), eq(shipments.status, "assigned")))
            ).map((row) => row.id),
            from: ["assigned"],
            to: "dispatched",
            routeId: id,
            eventRouteId: id,
            actorUserId: user.id,
            occurredAt: now,
          });
          return [
            {
              routeId: id,
              type: "dispatched",
              actorUserId: user.id,
              occurredAt: now,
              toCourierId: route.courierId,
            },
          ];
        });
      } catch (error) {
        if (isUniqueViolation(error, "routes_one_in_progress_per_courier")) {
          const route = await loadRouteRow(c.get("db"), id);
          throw await courierBusy(c.get("db"), route.courierId ?? "");
        }
        throw error;
      }
    },
  )
  // A dispatch made by mistake, while nothing is done or picked up: the route is in
  // preparation again and its courier is free (FR-026).
  .post(
    "/:id/undo-dispatch",
    validate("param", idParam),
    validate("json", routeReasonInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      return applyRouteAction(c, id, input, async (tx, route, now) => {
        requireStatus(route, ["in_progress"], "Solo se deshace el despacho de una ruta en curso.");
        const carried = await tx
          .select({ id: shipments.id, status: shipments.status })
          .from(shipments)
          .where(eq(shipments.routeId, id))
          .for("update");
        // A package received through a handover counts as picked up on this route.
        const anyPickedUp = carried.some((shipment) => shipment.status === "picked_up");
        if (!canUndoDispatch(await loadPlan(tx, id), anyPickedUp)) {
          throw new AppError("route_has_completed_stops");
        }
        const user = c.get("user");
        await tx
          .update(routes)
          .set({ status: "draft", dispatchedAt: null, dispatchedBy: null })
          .where(eq(routes.id, id));
        await transitionShipments(tx, {
          ids: carried.map((shipment) => shipment.id),
          from: ["dispatched"],
          to: "assigned",
          routeId: id,
          eventRouteId: id,
          actorUserId: user.id,
          occurredAt: now,
          reason: input.reason,
        });
        return [
          {
            routeId: id,
            type: "dispatch_undone",
            actorUserId: user.id,
            occurredAt: now,
            fromCourierId: route.courierId,
            reason: input.reason,
          },
        ];
      });
    },
  )
  // A route in preparation built by mistake: its shipments are "Registrado" again, its stops
  // go, and the route stays in history as "Cancelada" with its number (FR-017, research R10).
  .post(
    "/:id/cancel",
    validate("param", idParam),
    validate("json", routeReasonInput),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      return applyRouteAction(c, id, input, async (tx, route, now) => {
        // A route in progress is emptied or undone first (US5 scenario 2).
        if (route.status === "in_progress") throw new AppError("route_in_progress");
        requireStatus(route, ["draft"], "Solo se cancela una ruta en preparación.");
        const user = c.get("user");
        const released = await transitionShipments(tx, {
          ids: (
            await tx.select({ id: shipments.id }).from(shipments).where(eq(shipments.routeId, id))
          ).map((row) => row.id),
          from: ["assigned"],
          to: "registered",
          routeId: null,
          eventRouteId: id,
          actorUserId: user.id,
          occurredAt: now,
          reason: input.reason,
        });
        await savePlan(tx, id, await loadPlan(tx, id), []);
        await tx
          .update(routes)
          .set({ status: "cancelled", cancelReason: input.reason })
          .where(eq(routes.id, id));
        return [
          {
            routeId: id,
            type: "cancelled",
            actorUserId: user.id,
            occurredAt: now,
            reason: input.reason,
            changes: { shipmentIds: released.map((shipment) => shipment.id) },
          },
        ];
      });
    },
  )
  // A route its courier cannot take yet (they have one in progress) joins that route: its
  // shipments are added there, and the emptied route is cancelled (FR-009, US1 scenario 5).
  .post("/:id/join", validate("param", idParam), validate("json", routeJoinInput), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    return applyRouteAction(
      c,
      id,
      input,
      async (tx, route, now) => {
        requireStatus(route, ["draft"], "Solo se une a otra una ruta en preparación.");
        const target = await loadRouteRow(tx, input.toRouteId);
        if (target.status !== "in_progress") {
          throw new AppError("route_not_in_progress", {
            message: `La Ruta ${String(target.number)} ya no está en curso.`,
          });
        }
        const carried = await tx
          .select()
          .from(shipments)
          .where(eq(shipments.routeId, id))
          .for("update");
        if (carried.length === 0) throw new AppError("route_empty");
        const [onTarget] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(shipments)
          .where(eq(shipments.routeId, target.id));
        const total = (onTarget?.count ?? 0) + carried.length;
        if (needsLargeRouteConfirmation(total) && !input.confirmed) {
          throw new AppError("confirmation_required", {
            message: `La Ruta ${String(target.number)} quedaría con ${String(total)} envíos; confirma para agregarlos.`,
          });
        }
        const reason = `Sus envíos pasaron a la Ruta ${String(target.number)}, que su mensajero ya tenía en curso.`;
        const by = { actorUserId: c.get("user").id, now, reason };
        for (const shipment of carried) await moveShipment(tx, shipment, target.id, by);
        await tx
          .update(routes)
          .set({ status: "cancelled", cancelReason: reason })
          .where(eq(routes.id, id));
        return [
          {
            routeId: id,
            type: "cancelled",
            actorUserId: by.actorUserId,
            occurredAt: now,
            reason,
            changes: {
              shipmentIds: carried.map((shipment) => shipment.id),
              toRouteId: target.id,
            },
          },
        ];
      },
      input.toRouteId,
    );
  });
