import type {
  FeeConfirmInput,
  FeeQuote,
  FeeQuoteInput,
  NeighborhoodKind,
  Shipment,
  ShipmentCreateInput,
  ShipmentDetail,
  ShipmentUpdateInput,
  ShipmentVoidInput,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Calls of the registration form and the shipment detail. */

export type MerchantOption = { id: string; name: string; aliases: string[] };
export type PickupPointOption = {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
  neighborhood: { id: string; name: string };
};
export type RecipientOption = {
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientNeighborhood: { id: string; name: string };
};
export type NeighborhoodOption = {
  id: string;
  name: string;
  kind: NeighborhoodKind;
  needsReview: boolean;
  municipality: { id: string; name: string };
  rateZone: { id: string; name: string };
};
export type NamedOption = { id: string; name: string };

export async function searchMerchants(q: string): Promise<MerchantOption[]> {
  const { items } = await unwrap<{ items: MerchantOption[] }>(
    api.api.merchants.$get({ query: { q, active: "true" } }),
  );
  return items;
}

export async function listPickupPoints(merchantId: string): Promise<PickupPointOption[]> {
  const { items } = await unwrap<{ items: PickupPointOption[] }>(
    api.api.merchants[":id"]["pickup-points"].$get({ param: { id: merchantId } }),
  );
  return items;
}

export async function searchRecipients(merchantId: string, q: string): Promise<RecipientOption[]> {
  const { items } = await unwrap<{ items: RecipientOption[] }>(
    api.api.merchants[":id"].recipients.$get({ param: { id: merchantId }, query: { q } }),
  );
  return items;
}

export async function searchNeighborhoods(q: string): Promise<NeighborhoodOption[]> {
  const { items } = await unwrap<{ items: NeighborhoodOption[] }>(
    api.api.neighborhoods.$get({ query: { q } }),
  );
  return items;
}

export async function addNeighborhood(input: {
  id: string;
  name: string;
  municipalityId: string;
  rateZoneId: string;
}): Promise<NeighborhoodOption> {
  return unwrap<NeighborhoodOption>(
    api.api.neighborhoods.$post({ json: { ...input, kind: "neighborhood" } }),
  );
}

export async function listCarriers(): Promise<NamedOption[]> {
  const { items } = await unwrap<{ items: NamedOption[] }>(
    api.api.carriers.$get({ query: { active: "true" } }),
  );
  return items;
}

export async function listMunicipalities(): Promise<NamedOption[]> {
  const { items } = await unwrap<{ items: NamedOption[] }>(api.api.municipalities.$get());
  return items;
}

export async function listRateZones(): Promise<NamedOption[]> {
  const { items } = await unwrap<{ items: NamedOption[] }>(api.api["rate-zones"].$get());
  return items;
}

export async function quoteFee(input: FeeQuoteInput): Promise<FeeQuote> {
  return unwrap<FeeQuote>(api.api.shipments["fee-quote"].$post({ json: input }));
}

export async function findDuplicates(query: {
  merchantId: string;
  serviceDate: string;
  merchantReference?: string;
  recipientPhone?: string;
}): Promise<string[]> {
  const { trackingNumbers } = await unwrap<{ trackingNumbers: string[] }>(
    api.api.shipments.duplicates.$get({ query }),
  );
  return trackingNumbers;
}

export async function createShipment(input: ShipmentCreateInput): Promise<Shipment> {
  return unwrap<Shipment>(api.api.shipments.$post({ json: input }));
}

export async function getShipmentByTrackingNumber(trackingNumber: string): Promise<ShipmentDetail> {
  return unwrap<ShipmentDetail>(api.api.shipments.$get({ query: { trackingNumber } }));
}

export async function updateShipment(id: string, input: ShipmentUpdateInput): Promise<Shipment> {
  return unwrap<Shipment>(api.api.shipments[":id"].$patch({ param: { id }, json: input }));
}

export async function voidShipment(id: string, input: ShipmentVoidInput): Promise<Shipment> {
  return unwrap<Shipment>(api.api.shipments[":id"].void.$post({ param: { id }, json: input }));
}

export async function confirmFee(id: string, input: FeeConfirmInput): Promise<Shipment> {
  return unwrap<Shipment>(
    api.api.shipments[":id"]["confirm-fee"].$post({ param: { id }, json: input }),
  );
}
