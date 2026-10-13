import type {
  Courier,
  Handover,
  HandoverActionInput,
  RouteActionInput,
  RouteAddShipmentsInput,
  RouteCourierInput,
  RouteCreateInput,
  RouteDetail,
  RouteReasonInput,
  RouteReassignInput,
  RoutesBoard,
  Shipment,
  ShipmentReassignInput,
  StopOrderInput,
  UnassignedShipment,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Calls of the routes screens (feature 002). */

export async function listUnassigned(date: string): Promise<UnassignedShipment[]> {
  const { shipments } = await unwrap<{ shipments: UnassignedShipment[] }>(
    api.api.shipments.unassigned.$get({ query: { date } }),
  );
  return shipments;
}

export const getRoutesBoard = (date: string) =>
  unwrap<RoutesBoard>(api.api.routes.board.$get({ query: { date } }));

export const createRoute = (input: RouteCreateInput) =>
  unwrap<RouteDetail>(api.api.routes.$post({ json: input }));

export const getRoute = (id: string) =>
  unwrap<RouteDetail>(api.api.routes[":id"].$get({ param: { id } }));

export const setRouteCourier = (id: string, input: RouteCourierInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"].$patch({ param: { id }, json: input }));

export const setStopOrder = (id: string, input: StopOrderInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"]["stop-order"].$put({ param: { id }, json: input }));

export const addRouteShipments = (id: string, input: RouteAddShipmentsInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"].shipments.$post({ param: { id }, json: input }));

export const removeRouteShipment = (id: string, shipmentId: string, input: RouteActionInput) =>
  unwrap<RouteDetail>(
    api.api.routes[":id"].shipments[":shipmentId"].remove.$post({
      param: { id, shipmentId },
      json: input,
    }),
  );

export const reassignRoute = (id: string, input: RouteReassignInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"].reassign.$post({ param: { id }, json: input }));

export const reassignShipment = (id: string, input: ShipmentReassignInput) =>
  unwrap<{ shipment: Shipment; handover: Handover | null }>(
    api.api.shipments[":id"].reassign.$post({ param: { id }, json: input }),
  );

export const confirmHandover = (id: string, input: HandoverActionInput) =>
  unwrap<Handover>(api.api.handovers[":id"].confirm.$post({ param: { id }, json: input }));

export const cancelHandover = (id: string, input: HandoverActionInput) =>
  unwrap<Handover>(api.api.handovers[":id"].cancel.$post({ param: { id }, json: input }));

export const dispatchRoute = (id: string, input: RouteActionInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"].dispatch.$post({ param: { id }, json: input }));

export const undoDispatch = (id: string, input: RouteReasonInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"]["undo-dispatch"].$post({ param: { id }, json: input }));

export const cancelRoute = (id: string, input: RouteReasonInput) =>
  unwrap<RouteDetail>(api.api.routes[":id"].cancel.$post({ param: { id }, json: input }));

export async function listActiveCouriers(): Promise<Courier[]> {
  const { items } = await unwrap<{ items: Courier[] }>(
    api.api.couriers.$get({ query: { active: "true" } }),
  );
  return items;
}
