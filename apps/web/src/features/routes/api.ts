import type {
  Courier,
  HandoverActionInput,
  RouteActionInput,
  RouteAddShipmentsInput,
  RouteCourierInput,
  RouteCreateInput,
  RouteJoinInput,
  RouteReasonInput,
  RouteReassignInput,
  ShipmentReassignInput,
  StopOrderInput,
  UnassignedShipment,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Calls of the routes screens (feature 002). */

export async function listUnassigned(date: string): Promise<UnassignedShipment[]> {
  const { shipments } = await unwrap(api.api.shipments.unassigned.$get({ query: { date } }));
  return shipments;
}

export const getRoutesBoard = (date: string) =>
  unwrap(api.api.routes.board.$get({ query: { date } }));

export const createRoute = (input: RouteCreateInput) =>
  unwrap(api.api.routes.$post({ json: input }));

export const getRoute = (id: string) => unwrap(api.api.routes[":id"].$get({ param: { id } }));

export const setRouteCourier = (id: string, input: RouteCourierInput) =>
  unwrap(api.api.routes[":id"].$patch({ param: { id }, json: input }));

export const setStopOrder = (id: string, input: StopOrderInput) =>
  unwrap(api.api.routes[":id"]["stop-order"].$put({ param: { id }, json: input }));

export const addRouteShipments = (id: string, input: RouteAddShipmentsInput) =>
  unwrap(api.api.routes[":id"].shipments.$post({ param: { id }, json: input }));

export const removeRouteShipment = (id: string, shipmentId: string, input: RouteActionInput) =>
  unwrap(
    api.api.routes[":id"].shipments[":shipmentId"].remove.$post({
      param: { id, shipmentId },
      json: input,
    }),
  );

export const reassignRoute = (id: string, input: RouteReassignInput) =>
  unwrap(api.api.routes[":id"].reassign.$post({ param: { id }, json: input }));

export const reassignShipment = (id: string, input: ShipmentReassignInput) =>
  unwrap(api.api.shipments[":id"].reassign.$post({ param: { id }, json: input }));

export const confirmHandover = (id: string, input: HandoverActionInput) =>
  unwrap(api.api.handovers[":id"].confirm.$post({ param: { id }, json: input }));

export const cancelHandover = (id: string, input: HandoverActionInput) =>
  unwrap(api.api.handovers[":id"].cancel.$post({ param: { id }, json: input }));

export const dispatchRoute = (id: string, input: RouteActionInput) =>
  unwrap(api.api.routes[":id"].dispatch.$post({ param: { id }, json: input }));

export const undoDispatch = (id: string, input: RouteReasonInput) =>
  unwrap(api.api.routes[":id"]["undo-dispatch"].$post({ param: { id }, json: input }));

export const cancelRoute = (id: string, input: RouteReasonInput) =>
  unwrap(api.api.routes[":id"].cancel.$post({ param: { id }, json: input }));

export async function listActiveCouriers(): Promise<Courier[]> {
  const { items } = await unwrap(api.api.couriers.$get({ query: { active: "true" } }));
  return items;
}

export const joinRoute = (id: string, input: RouteJoinInput) =>
  unwrap(api.api.routes[":id"].join.$post({ param: { id }, json: input }));
