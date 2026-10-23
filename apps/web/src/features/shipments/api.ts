import type { InferResponseType } from "hono/client";
import type {
  FeeConfirmInput,
  RecordOnBehalfInput,
  RecordCorrectionInput,
  RecordRevertInput,
  ExceptionDecisionInput,
  OfficeReceiptInput,
  FeeQuote,
  FeeQuoteInput,
  Shipment,
  ShipmentCreateInput,
  ShipmentDetail,
  ShipmentUpdateInput,
  ShipmentVoidInput,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Calls of the registration form and the shipment detail. */

export type MerchantOption = Pick<
  InferResponseType<typeof api.api.merchants.$get>["items"][number],
  "id" | "name" | "aliases"
>;
export type PickupPointOption = InferResponseType<
  (typeof api.api.merchants)[":id"]["pickup-points"]["$get"]
>["items"][number];
export type RecipientOption = InferResponseType<
  (typeof api.api.merchants)[":id"]["recipients"]["$get"]
>["items"][number];
export type NeighborhoodOption = Pick<
  InferResponseType<typeof api.api.neighborhoods.$get>["items"][number],
  "id" | "name" | "kind" | "needsReview" | "municipality" | "rateZone"
>;
export type NamedOption = InferResponseType<typeof api.api.municipalities.$get>["items"][number];

export async function searchMerchants(q: string): Promise<MerchantOption[]> {
  const { items } = await unwrap(api.api.merchants.$get({ query: { q, active: "true" } }));
  return items;
}

export async function listPickupPoints(merchantId: string): Promise<PickupPointOption[]> {
  const { items } = await unwrap(
    api.api.merchants[":id"]["pickup-points"].$get({ param: { id: merchantId } }),
  );
  return items;
}

export async function searchRecipients(merchantId: string, q: string): Promise<RecipientOption[]> {
  const { items } = await unwrap(
    api.api.merchants[":id"].recipients.$get({ param: { id: merchantId }, query: { q } }),
  );
  return items;
}

export async function searchNeighborhoods(q: string): Promise<NeighborhoodOption[]> {
  const { items } = await unwrap(api.api.neighborhoods.$get({ query: { q } }));
  return items;
}

export async function addNeighborhood(input: {
  id: string;
  name: string;
  municipalityId: string;
  rateZoneId: string;
}): Promise<NeighborhoodOption> {
  return unwrap(api.api.neighborhoods.$post({ json: { ...input, kind: "neighborhood" } }));
}

export async function listCarriers(): Promise<NamedOption[]> {
  const { items } = await unwrap(api.api.carriers.$get({ query: { active: "true" } }));
  return items;
}

export async function listMunicipalities(): Promise<NamedOption[]> {
  const { items } = await unwrap(api.api.municipalities.$get());
  return items;
}

/** Active rate zones, for selection lists (FR-029). */
export async function listRateZones(): Promise<NamedOption[]> {
  const { items } = await unwrap(api.api["rate-zones"].$get());
  return items.filter((zone) => zone.isActive);
}

export async function quoteFee(input: FeeQuoteInput): Promise<FeeQuote> {
  return unwrap(api.api.shipments["fee-quote"].$post({ json: input }));
}

export async function findDuplicates(query: {
  merchantId: string;
  serviceDate: string;
  merchantReference?: string;
  recipientPhone?: string;
}): Promise<string[]> {
  const { trackingNumbers } = await unwrap(api.api.shipments.duplicates.$get({ query }));
  return trackingNumbers;
}

export async function createShipment(input: ShipmentCreateInput): Promise<Shipment> {
  return unwrap(api.api.shipments.$post({ json: input }));
}

export async function getShipmentByTrackingNumber(trackingNumber: string): Promise<ShipmentDetail> {
  return unwrap(api.api.shipments.$get({ query: { trackingNumber } }));
}

export async function updateShipment(id: string, input: ShipmentUpdateInput): Promise<Shipment> {
  return unwrap(api.api.shipments[":id"].$patch({ param: { id }, json: input }));
}

export async function voidShipment(id: string, input: ShipmentVoidInput): Promise<Shipment> {
  return unwrap(api.api.shipments[":id"].void.$post({ param: { id }, json: input }));
}

export async function confirmFee(id: string, input: FeeConfirmInput): Promise<Shipment> {
  return unwrap(api.api.shipments[":id"]["confirm-fee"].$post({ param: { id }, json: input }));
}

export const decideException = (id: string, input: ExceptionDecisionInput) =>
  unwrap(api.api.shipments[":id"]["exception-decision"].$post({ param: { id }, json: input }));

export const receiveAtOffice = (id: string, input: OfficeReceiptInput) =>
  unwrap(api.api.shipments[":id"]["office-receipt"].$post({ param: { id }, json: input }));

export const enterCourierRecord = (id: string, input: RecordOnBehalfInput) =>
  unwrap(api.api.shipments[":id"].records.$post({ param: { id }, json: input }));
export const correctCourierRecord = (id: string, input: RecordCorrectionInput) =>
  unwrap(api.api["courier-records"][":id"].correct.$post({ param: { id }, json: input }));
export const revertCourierRecord = (id: string, input: RecordRevertInput) =>
  unwrap(api.api["courier-records"][":id"].revert.$post({ param: { id }, json: input }));
