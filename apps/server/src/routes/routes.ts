import {
  bogotaToday,
  buildStops,
  needsLargeRouteConfirmation,
  routeActionInput,
  routeCourierInput,
  routeCreateInput,
  stopOrderInput,
  validateStopOrder,
} from "@domy/domain";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { couriers, routes, shipments } from "../db/schema/index.ts";
import { findRouteAction } from "../lib/action-id.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import {
  claimVersion,
  loadPlan,
  loadRouteDetail,
  loadRouteRow,
  planShipments,
  recordRouteEvents,
  savePlan,
  transitionShipments,
  type NewRouteEvent,
  type RouteRow,
} from "../lib/route-store.ts";
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

/**
 * Applies one action on an existing route exactly once (FR-020) and only on the version the
 * user saw (FR-021). `apply` changes the route and returns its events; the first one stores
 * the action identifier.
 */
async function applyRouteAction(
  c: Context<AppEnv>,
  routeId: string,
  input: { actionId: string; version: number },
  apply: (tx: Executor, route: RouteRow, now: Date) => Promise<NewRouteEvent[]>,
): Promise<Response> {
  const db = c.get("db");
  if (await findRouteAction(db, input.actionId)) return c.json(await loadRouteDetail(db, routeId));
  const now = c.get("clock")();
  await db
    .transaction(async (tx) => {
      await loadRouteRow(tx, routeId);
      await claimVersion(tx, routeId, input.version, now);
      const events = await apply(tx, await loadRouteRow(tx, routeId), now);
      const [first, ...rest] = events;
      if (first)
        await recordRouteEvents(tx, [{ ...first, clientEventId: input.actionId }, ...rest]);
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error, "route_events_client_event_id_key")) return;
      throw error;
    });
  return c.json(await loadRouteDetail(db, routeId));
}

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
    // A shipment joins a route up to the later of the route's date and today (FR-003).
    const latestDate = input.serviceDate > today ? input.serviceDate : today;

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
            extraWhere: and(isNull(shipments.routeId), lte(shipments.serviceDate, latestDate)),
          });
          if (moved.length !== shipmentIds.length) {
            throw new AppError("shipment_not_registered", {
              message:
                "Algún envío ya no está «Registrado», ya está en una ruta o tiene una fecha posterior a la de la ruta. Actualiza la lista.",
            });
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
  );
