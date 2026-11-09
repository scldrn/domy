import { describe, expect, it } from "vitest";
import {
  addHeldShipmentToStops,
  addShipmentToStops,
  buildStops,
  canMoveBetweenRoutes,
  canUndoDispatch,
  isRouteFinished,
  largeRouteThreshold,
  needsLargeRouteConfirmation,
  relocateShipment,
  removeShipmentFromStops,
  routeProgress,
  shipmentPlaces,
  statusOnJoiningRoute,
  validateStopOrder,
  type RoutePlanShipment,
  type RouteStopPlan,
} from "./routes.ts";
import { shipmentStatuses } from "./shipment-lifecycle.ts";
import * as routeModule from "./routes.ts";
import type { ShipmentKind } from "./schemas/enums.ts";

let next = 0;
const newId = () => `stop-${String(++next)}`;

const bodega = { address: "Cra 70 # 45-10", neighborhoodId: "estadio" };
const local = { address: "Cq 1 # 70-20", neighborhoodId: "laureles" };

function delivery(id: string, pickup = bodega, to = `Calle ${id}`): RoutePlanShipment {
  return {
    id,
    kind: "delivery",
    pickup,
    delivery: { address: to, neighborhoodId: "belen" },
  };
}

const order = (stops: RouteStopPlan[]) =>
  stops.map((stop) => `${stop.kind}:${stop.tasks.map((task) => task.shipmentId).join("+")}`);

describe("shipmentPlaces", () => {
  const base = {
    pickupAddress: bodega.address,
    pickupNeighborhoodId: bodega.neighborhoodId,
    recipientAddress: "Calle 10 # 43-12",
    recipientNeighborhoodId: "belen",
    recipientNeighborhoodName: "Belén",
  };

  it("picks up at the merchant and delivers to the recipient", () => {
    expect(shipmentPlaces({ ...base, kind: "delivery" })).toEqual({
      pickup: bodega,
      delivery: { address: "Calle 10 # 43-12", neighborhoodId: "belen" },
    });
  });

  it("reverses the places of a reverse pickup", () => {
    expect(shipmentPlaces({ ...base, kind: "reverse_pickup" })).toEqual({
      pickup: { address: "Calle 10 # 43-12", neighborhoodId: "belen" },
      delivery: bodega,
    });
  });

  it("delivers a carrier handoff at the handoff place", () => {
    const places = shipmentPlaces({
      ...base,
      kind: "carrier_handoff",
      recipientAddress: null,
      recipientNeighborhoodId: "terminal-norte",
      recipientNeighborhoodName: "Terminal del Norte",
    });
    expect(places.delivery).toEqual({
      address: "Terminal del Norte",
      neighborhoodId: "terminal-norte",
    });
  });

  it("gives an errand a single place", () => {
    const places = shipmentPlaces({
      ...base,
      kind: "errand",
      recipientAddress: null,
      recipientNeighborhoodId: null,
      recipientNeighborhoodName: null,
    });
    expect(places).toEqual({ pickup: bodega, delivery: null });
  });
});

describe("buildStops (FR-005)", () => {
  it("groups pickups by place and gives each shipment its own delivery stop", () => {
    const stops = buildStops(
      [
        delivery("a"),
        delivery("b", local),
        delivery("c", { address: "cra 70 #45-10 ", neighborhoodId: "estadio" }),
        delivery("d", bodega, "Calle a"),
      ],
      newId,
    );
    expect(order(stops)).toEqual([
      "pickup:a+c+d",
      "pickup:b",
      "delivery:a",
      "delivery:b",
      "delivery:c",
      "delivery:d",
    ]);
    expect(stops.every((stop) => stop.tasks.every((task) => task.status === "pending"))).toBe(true);
    expect(stops[0]).toMatchObject({ address: bodega.address, neighborhoodId: "estadio" });
  });

  it("keeps two deliveries to the same place as two stops", () => {
    const stops = buildStops(
      [delivery("a", bodega, "Calle 1"), delivery("b", bodega, "Calle 1")],
      newId,
    );
    expect(order(stops)).toEqual(["pickup:a+b", "delivery:a", "delivery:b"]);
  });

  it("makes an errand a single stop among the deliveries", () => {
    const errand: RoutePlanShipment = { id: "e", kind: "errand", pickup: local, delivery: null };
    const stops = buildStops([delivery("a"), errand, delivery("b")], newId);
    expect(order(stops)).toEqual(["pickup:a+b", "delivery:a", "errand:e", "delivery:b"]);
  });
});

describe("addShipmentToStops (FR-011)", () => {
  it("joins the pending pickup stop of its place", () => {
    const stops = addShipmentToStops(buildStops([delivery("a")], newId), delivery("b"), newId);
    expect(order(stops)).toEqual(["pickup:a+b", "delivery:a", "delivery:b"]);
  });

  it("gets a new pickup stop at the end, right before its delivery, when none is pending", () => {
    const built = buildStops([delivery("a")], newId);
    const done = built.map((stop, index) =>
      index === 0
        ? { ...stop, tasks: stop.tasks.map((task) => ({ ...task, status: "completed" as const })) }
        : stop,
    );
    expect(order(addShipmentToStops(done, delivery("b"), newId))).toEqual([
      "pickup:a",
      "delivery:a",
      "pickup:b",
      "delivery:b",
    ]);
    expect(order(addShipmentToStops(built, delivery("c", local), newId))).toEqual([
      "pickup:a",
      "delivery:a",
      "pickup:c",
      "delivery:c",
    ]);
  });

  it("adds a picked-up shipment with its delivery stop only", () => {
    const stops = addShipmentToStops(buildStops([delivery("a")], newId), delivery("b"), newId, {
      deliveryOnly: true,
    });
    expect(order(stops)).toEqual(["pickup:a", "delivery:a", "delivery:b"]);
  });
});

describe("addHeldShipmentToStops (feature 003: FR-029, FR-031, FR-041)", () => {
  const office = { address: "Cl 50 # 40-20", neighborhoodId: "centro" };
  const reverse: RoutePlanShipment = {
    id: "r",
    kind: "reverse_pickup",
    pickup: { address: "Calle 10 # 43-12", neighborhoodId: "belen" },
    delivery: bodega,
  };

  it("gives a package a courier holds only its delivery stop", () => {
    const stops = addHeldShipmentToStops(buildStops([delivery("a")], newId), delivery("h"), newId, {
      holder: "courier",
      purpose: "delivery",
    });
    expect(order(stops)).toEqual(["pickup:a", "delivery:a", "delivery:h"]);
  });

  it("returns a package a courier holds where it was picked up", () => {
    const stops = addHeldShipmentToStops([], delivery("h"), newId, {
      holder: "courier",
      purpose: "return",
    });
    expect(stops).toMatchObject([
      { kind: "return", address: bodega.address, tasks: [{ shipmentId: "h", kind: "return" }] },
    ]);
    const back = addHeldShipmentToStops([], reverse, newId, {
      holder: "courier",
      purpose: "return",
    });
    // A reverse pickup goes back to the recipient it was collected from.
    expect(back[0]).toMatchObject({ kind: "return", address: "Calle 10 # 43-12" });
  });

  it("picks a package up at the office before its delivery or return stop", () => {
    const stops = addHeldShipmentToStops(buildStops([delivery("a")], newId), delivery("h"), newId, {
      holder: "office",
      office,
      purpose: "delivery",
    });
    expect(order(stops)).toEqual(["pickup:a", "delivery:a", "pickup:h", "delivery:h"]);
    expect(stops[2]).toMatchObject({ address: office.address, neighborhoodId: "centro" });

    const returned = addHeldShipmentToStops(stops, delivery("j"), newId, {
      holder: "office",
      office,
      purpose: "return",
    });
    // A second package at the office joins its pending pickup stop.
    expect(order(returned)).toEqual([
      "pickup:a",
      "delivery:a",
      "pickup:h+j",
      "delivery:h",
      "return:j",
    ]);
    expect(validateStopOrder(returned, returned)).toBeNull();
  });

  it("keeps a return stop after its office pickup when the stops are reordered", () => {
    const stops = addHeldShipmentToStops([], delivery("h"), newId, {
      holder: "office",
      office,
      purpose: "return",
    });
    const [pickup, back] = stops;
    if (!pickup || !back) throw new Error("expected two stops");
    expect(validateStopOrder(stops, [back, pickup])).toBe(
      "La entrega de un envío debe quedar después de su recogida.",
    );
  });

  it("counts a pending return stop as pending work of the route", () => {
    const stops = addHeldShipmentToStops([], delivery("h"), newId, {
      holder: "courier",
      purpose: "return",
    });
    expect(routeProgress(stops)).toEqual({ completed: 0, total: 1 });
    expect(isRouteFinished(stops, 0)).toBe(false);
  });
});

describe("removeShipmentFromStops (FR-012)", () => {
  it("removes its pending tasks and a pickup stop left empty", () => {
    const stops = buildStops([delivery("a"), delivery("b", local)], newId);
    expect(order(removeShipmentFromStops(stops, "b"))).toEqual(["pickup:a", "delivery:a"]);
    expect(order(removeShipmentFromStops(stops, "a"))).toEqual(["pickup:b", "delivery:b"]);
  });

  it("keeps the pickup stop shared with another shipment", () => {
    const stops = buildStops([delivery("a"), delivery("b")], newId);
    expect(order(removeShipmentFromStops(stops, "a"))).toEqual(["pickup:b", "delivery:b"]);
  });

  it("never removes completed or failed tasks", () => {
    const stops = buildStops([delivery("a")], newId).map((stop) =>
      stop.kind === "pickup"
        ? { ...stop, tasks: stop.tasks.map((task) => ({ ...task, status: "completed" as const })) }
        : stop,
    );
    expect(order(removeShipmentFromStops(stops, "a"))).toEqual(["pickup:a"]);
  });
});

describe("relocateShipment (FR-013)", () => {
  const elsewhere = { address: "Calle 50 # 20-30", neighborhoodId: "belen" };

  it("moves its delivery stop to the new address in place", () => {
    const stops = buildStops([delivery("a"), delivery("b")], newId);
    const moved = relocateShipment(stops, { ...delivery("b"), delivery: elsewhere }, newId);
    expect(order(moved)).toEqual(order(stops));
    expect(moved[2]).toMatchObject({ id: stops[2]?.id, ...elsewhere });
  });

  it("moves a pickup shared with others to a new stop right before its delivery", () => {
    const stops = buildStops([delivery("a"), delivery("b")], newId);
    const moved = relocateShipment(stops, delivery("b", local), newId);
    expect(order(moved)).toEqual(["pickup:a", "delivery:a", "pickup:b", "delivery:b"]);
    expect(moved[2]).toMatchObject(local);
    // The tasks that stay keep their identity, so only the moved one is replaced.
    expect(moved[0]?.tasks[0]).toBe(stops[0]?.tasks[0]);
  });

  it("joins a pending pickup stop of the new place that comes before its delivery", () => {
    const stops = buildStops([delivery("a", local), delivery("b")], newId);
    expect(order(relocateShipment(stops, delivery("b", local), newId))).toEqual([
      "pickup:a+b",
      "delivery:a",
      "delivery:b",
    ]);
  });

  it("moves a pickup stop of its own in place", () => {
    const stops = buildStops([delivery("a"), delivery("b", local)], newId);
    const moved = relocateShipment(stops, delivery("b", elsewhere), newId);
    expect(order(moved)).toEqual(order(stops));
    expect(moved[1]).toMatchObject({ id: stops[1]?.id, ...elsewhere });
  });

  it("moves an errand stop and returns the same stops when nothing changes", () => {
    const errand: RoutePlanShipment = { id: "e", kind: "errand", pickup: local, delivery: null };
    const stops = buildStops([delivery("a"), errand], newId);
    expect(relocateShipment(stops, { ...errand, pickup: elsewhere }, newId)[2]).toMatchObject(
      elsewhere,
    );
    expect(relocateShipment(stops, errand, newId)).toBe(stops);
    expect(relocateShipment(stops, delivery("a"), newId)).toBe(stops);
  });
});

/** The order after dragging one stop to a new position, as the route screen does. */
function moveStop(stops: RouteStopPlan[], stopId: string, toIndex: number): RouteStopPlan[] {
  const moving = stops.find((existing) => existing.id === stopId);
  if (!moving) return stops;
  const rest = stops.filter((existing) => existing !== moving);
  return [...rest.slice(0, toIndex), moving, ...rest.slice(toIndex)];
}

describe("validateStopOrder (FR-006)", () => {
  const stops = buildStops([delivery("a"), delivery("b", local)], newId);
  // pickup:a, pickup:b, delivery:a, delivery:b

  it("moves a stop to a new position", () => {
    expect(order(moveStop(stops, stops[3]?.id ?? "", 2))).toEqual([
      "pickup:a",
      "pickup:b",
      "delivery:b",
      "delivery:a",
    ]);
  });

  it("accepts any order that keeps each delivery after its pickup", () => {
    const interleaved = moveStop(stops, stops[2]?.id ?? "", 1);
    expect(order(interleaved)).toEqual(["pickup:a", "delivery:a", "pickup:b", "delivery:b"]);
    expect(validateStopOrder(stops, interleaved)).toBeNull();
  });

  it("refuses a delivery before its pickup", () => {
    const wrong = moveStop(stops, stops[3]?.id ?? "", 0);
    expect(validateStopOrder(stops, wrong)).toBe(
      "La entrega de un envío debe quedar después de su recogida.",
    );
  });

  it("leaves errand stops free", () => {
    const withErrand = buildStops(
      [delivery("a"), { id: "e", kind: "errand", pickup: local, delivery: null }],
      newId,
    );
    const moved = moveStop(withErrand, withErrand[2]?.id ?? "", 0);
    expect(validateStopOrder(withErrand, moved)).toBeNull();
  });

  it("refuses moving a completed stop or anything across it", () => {
    const done = stops.map((stop, index) =>
      index === 0
        ? { ...stop, tasks: stop.tasks.map((task) => ({ ...task, status: "completed" as const })) }
        : stop,
    );
    const message = "Las paradas completadas no se mueven.";
    expect(validateStopOrder(done, moveStop(done, done[0]?.id ?? "", 1))).toBe(message);
    expect(validateStopOrder(done, moveStop(done, done[1]?.id ?? "", 0))).toBe(message);
    expect(validateStopOrder(done, moveStop(done, done[3]?.id ?? "", 2))).toBeNull();
  });

  it("refuses an order that is not a permutation of the stops", () => {
    expect(validateStopOrder(stops, stops.slice(1))).toBe(
      "El orden enviado no corresponde a las paradas de la ruta.",
    );
  });
});

describe("route status rules", () => {
  const complete = (stops: RouteStopPlan[], shipmentId: string, status: "completed" | "failed") =>
    stops.map((stop) => ({
      ...stop,
      tasks: stop.tasks.map((task) =>
        task.shipmentId === shipmentId ? { ...task, status } : task,
      ),
    }));

  it("counts progress by stops with no pending task, whatever their position (FR-007)", () => {
    const stops = buildStops([delivery("a"), delivery("b", local)], newId);
    expect(routeProgress(stops)).toEqual({ completed: 0, total: 4 });
    const b = complete(stops, "b", "completed");
    expect(routeProgress(b)).toEqual({ completed: 2, total: 4 });
  });

  it("finishes a route with no pending task and no pending handover (FR-012)", () => {
    const stops = buildStops([delivery("a"), delivery("b", local)], newId);
    expect(isRouteFinished(stops, 0)).toBe(false);
    const all = complete(complete(stops, "a", "completed"), "b", "failed");
    expect(isRouteFinished(all, 0)).toBe(true);
    expect(isRouteFinished(all, 1)).toBe(false);
    expect(isRouteFinished([], 0)).toBe(true);
  });

  it("allows undoing a dispatch only before any work (FR-026)", () => {
    const stops = buildStops([delivery("a")], newId);
    expect(canUndoDispatch(stops, false)).toBe(true);
    expect(canUndoDispatch(stops, true)).toBe(false);
    expect(canUndoDispatch(complete(stops, "a", "failed"), false)).toBe(false);
  });
});

describe("large route confirmation (FR-005)", () => {
  it("asks for confirmation beyond 15 shipments, not at 15", () => {
    expect(largeRouteThreshold).toBe(15);
    expect(needsLargeRouteConfirmation(15)).toBe(false);
    expect(needsLargeRouteConfirmation(16)).toBe(true);
  });
});

type DeliveriesBefore = (
  stops: RouteStopPlan[],
  shipmentId: string,
  kind: ShipmentKind,
) => number | null;

type RoutesWithDeliveriesBefore = typeof routeModule & {
  deliveriesBefore: DeliveriesBefore;
};

function hasDeliveriesBefore(module: typeof routeModule): module is RoutesWithDeliveriesBefore {
  return "deliveriesBefore" in module && typeof module.deliveriesBefore === "function";
}

function countBefore(
  stops: RouteStopPlan[],
  shipmentId: string,
  kind: ShipmentKind,
): number | null | undefined {
  if (!hasDeliveriesBefore(routeModule)) return undefined;
  return routeModule.deliveriesBefore(stops, shipmentId, kind);
}

function queueTask(
  shipmentId: string,
  kind: RouteStopPlan["tasks"][number]["kind"],
  status: RouteStopPlan["tasks"][number]["status"] = "pending",
): RouteStopPlan["tasks"][number] {
  return { shipmentId, kind, status };
}

function queueStop(
  id: string,
  kind: RouteStopPlan["kind"],
  tasks: RouteStopPlan["tasks"],
): RouteStopPlan {
  return { id, kind, address: `Dirección ${id}`, neighborhoodId: null, tasks };
}

describe("deliveriesBefore (FR-006, FR-008, research R4/R17)", () => {
  it("returns zero when the shipment's pending delivery is first", () => {
    const stops = [
      queueStop("shared-pickup", "pickup", [
        queueTask("target", "pickup"),
        queueTask("other-merchant-shipment", "pickup"),
      ]),
      queueStop("target-delivery", "delivery", [queueTask("target", "delivery")]),
    ];

    expect(countBefore(stops, "target", "delivery")).toBe(0);
  });

  it.each(["delivery", "carrier_handoff"] as const)(
    "counts one pending delivery before a %s shipment's own delivery stop",
    (kind) => {
      const stops = [
        queueStop("first-delivery", "delivery", [queueTask("other", "delivery")]),
        queueStop("target-delivery", "delivery", [queueTask("target", "delivery")]),
      ];

      expect(countBefore(stops, "target", kind)).toBe(1);
    },
  );

  it("counts each earlier pending delivery or return stop once and skips ineligible work", () => {
    const stops = [
      queueStop("earlier-delivery", "delivery", [queueTask("other-merchant-a", "delivery")]),
      queueStop("grouped-delivery", "delivery", [
        queueTask("shared-stop-a", "delivery"),
        queueTask("shared-stop-b", "delivery"),
      ]),
      queueStop("pending-return", "return", [queueTask("returning", "return")]),
      queueStop("completed-out-of-order", "delivery", [
        queueTask("already-done", "delivery", "completed"),
      ]),
      queueStop("failed-return", "return", [queueTask("failed", "return", "failed")]),
      queueStop("pickup-only", "pickup", [queueTask("pickup-only", "pickup")]),
      queueStop("errand", "errand", [queueTask("errand", "errand")]),
      queueStop("target-delivery", "delivery", [queueTask("target", "delivery")]),
      queueStop("pending-after-target", "delivery", [queueTask("later", "delivery")]),
    ];

    expect(countBefore(stops, "target", "delivery")).toBe(3);
  });

  it("does not use a shared pickup as the anchor or count the target's own stop", () => {
    const stops = [
      queueStop("shared-pickup", "pickup", [
        queueTask("target", "pickup"),
        queueTask("other-merchant-shipment", "pickup"),
      ]),
      queueStop("other-merchant-delivery", "delivery", [
        queueTask("other-merchant-shipment", "delivery"),
      ]),
      queueStop("shared-target-delivery", "delivery", [
        queueTask("target", "delivery"),
        queueTask("another-shipment", "delivery"),
      ]),
    ];

    expect(countBefore(stops, "target", "delivery")).toBe(1);
  });

  it("counts a reverse pickup up to its pending pickup stop", () => {
    const stops = [
      queueStop("earlier-delivery", "delivery", [queueTask("other", "delivery")]),
      queueStop("earlier-return", "return", [queueTask("returning", "return")]),
      queueStop("target-pickup", "pickup", [queueTask("target", "pickup")]),
      queueStop("target-delivery", "delivery", [queueTask("target", "delivery")]),
    ];

    expect(countBefore(stops, "target", "reverse_pickup")).toBe(2);
  });

  it("returns null for a reverse pickup after pickup even when delivery remains pending", () => {
    const stops = [
      queueStop("earlier-delivery", "delivery", [queueTask("other", "delivery")]),
      queueStop("target-pickup", "pickup", [queueTask("target", "pickup", "completed")]),
      queueStop("target-delivery", "delivery", [queueTask("target", "delivery")]),
    ];

    expect(countBefore(stops, "target", "reverse_pickup")).toBeNull();
  });

  it("returns null for errands, a missing anchor, or a completed own anchor", () => {
    const pendingDelivery = queueStop("other-delivery", "delivery", [
      queueTask("other", "delivery"),
    ]);
    const stopsWithoutErrandAnchor = [
      pendingDelivery,
      queueStop("target-errand", "errand", [queueTask("target", "errand")]),
    ];
    const stopsWithoutPendingDeliveryAnchor = [
      pendingDelivery,
      queueStop("completed-target-delivery", "delivery", [
        queueTask("target", "delivery", "completed"),
      ]),
    ];

    expect(countBefore(stopsWithoutErrandAnchor, "target", "errand")).toBeNull();
    expect(countBefore([pendingDelivery], "missing", "delivery")).toBeNull();
    expect(countBefore(stopsWithoutPendingDeliveryAnchor, "target", "delivery")).toBeNull();
  });
});

describe("joining and moving between routes (feature 002 FR-014; DESIGN-1)", () => {
  it("assigns a shipment joining a route in preparation and dispatches one joining a live route", () => {
    expect(statusOnJoiningRoute("draft")).toBe("assigned");
    expect(statusOnJoiningRoute("in_progress")).toBe("dispatched");
  });

  it("moves with its pending stops only a planned shipment, assigned or in route", () => {
    expect(shipmentStatuses.filter(canMoveBetweenRoutes)).toEqual(["assigned", "dispatched"]);
  });
});
