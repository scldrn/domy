import type {
  AuditEvent,
  Carrier,
  CarrierCreateInput,
  CarrierUpdateInput,
  Courier,
  CourierCreateInput,
  CourierUpdateInput,
  Merchant,
  MerchantCreateInput,
  MerchantDetail,
  MerchantUpdateInput,
  NeighborhoodDetail,
  NeighborhoodUpdateInput,
  PickupPoint,
  PickupPointCreateInput,
  PickupPointUpdateInput,
  RateCard,
  RateCardEntry,
  RateCardEntryInput,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";
import type { NeighborhoodOption } from "@/features/shipments/api";

/** Calls of the master data screens (User Story 6). */

type Active = "true" | "false" | undefined;

export async function listMerchants(q: string, active?: Active): Promise<Merchant[]> {
  const { items } = await unwrap<{ items: Merchant[] }>(
    api.api.merchants.$get({ query: { q, ...(active && { active }) } }),
  );
  return items;
}
export const getMerchant = (id: string) =>
  unwrap<MerchantDetail>(api.api.merchants[":id"].$get({ param: { id } }));
export const createMerchant = (input: MerchantCreateInput) =>
  unwrap<Merchant>(api.api.merchants.$post({ json: input }));
export const updateMerchant = (id: string, input: MerchantUpdateInput) =>
  unwrap<Merchant & { openShipments: number }>(
    api.api.merchants[":id"].$patch({ param: { id }, json: input }),
  );
export const createPickupPoint = (merchantId: string, input: PickupPointCreateInput) =>
  unwrap<PickupPoint>(
    api.api.merchants[":id"]["pickup-points"].$post({ param: { id: merchantId }, json: input }),
  );
export const updatePickupPoint = (id: string, input: PickupPointUpdateInput) =>
  unwrap<PickupPoint>(api.api["pickup-points"][":id"].$patch({ param: { id }, json: input }));

export async function listCouriers(q: string, active?: Active): Promise<Courier[]> {
  const { items } = await unwrap<{ items: Courier[] }>(
    api.api.couriers.$get({ query: { q, ...(active && { active }) } }),
  );
  return items;
}
export const createCourier = (input: CourierCreateInput) =>
  unwrap<Courier>(api.api.couriers.$post({ json: input }));
/** Answers with the courier's routes in preparation or in progress (feature 002, FR-010). */
export const updateCourier = (id: string, input: CourierUpdateInput) =>
  unwrap<Courier & { openRoutes: number }>(
    api.api.couriers[":id"].$patch({ param: { id }, json: input }),
  );

/** Links an account with the courier role to its courier, or unlinks it (feature 003, FR-002). */
export const linkCourierAccount = (userId: string, courierId: string | null) =>
  unwrap<{ courier: Courier | null }>(
    api.api.couriers.accounts[":userId"].$put({
      param: { userId },
      json: { actionId: crypto.randomUUID(), courierId },
    }),
  );

export async function listAllCarriers(q: string): Promise<Carrier[]> {
  const { items } = await unwrap<{ items: Carrier[] }>(api.api.carriers.$get({ query: { q } }));
  return items;
}
export const createCarrier = (input: CarrierCreateInput) =>
  unwrap<Carrier>(api.api.carriers.$post({ json: input }));
export const updateCarrier = (id: string, input: CarrierUpdateInput) =>
  unwrap<Carrier>(api.api.carriers[":id"].$patch({ param: { id }, json: input }));

export async function listNeighborhoods(query: {
  q: string;
  needsReview?: "true";
  active: "true" | "all";
}): Promise<(NeighborhoodOption & { isActive: boolean })[]> {
  const { items } = await unwrap<{ items: (NeighborhoodOption & { isActive: boolean })[] }>(
    api.api.neighborhoods.$get({ query }),
  );
  return items;
}
export const getNeighborhood = (id: string) =>
  unwrap<NeighborhoodDetail>(api.api.neighborhoods[":id"].$get({ param: { id } }));
export const updateNeighborhood = (id: string, input: NeighborhoodUpdateInput) =>
  unwrap<NeighborhoodDetail>(api.api.neighborhoods[":id"].$patch({ param: { id }, json: input }));

export const getRateCard = (merchantId: string | null) =>
  unwrap<RateCard>(api.api["rate-card"].$get({ query: merchantId ? { merchantId } : {} }));
export async function getRateCardHistory(merchantId: string | null): Promise<RateCardEntry[]> {
  const { items } = await unwrap<{ items: RateCardEntry[] }>(
    api.api["rate-card"].history.$get({ query: merchantId ? { merchantId } : {} }),
  );
  return items;
}
export const addRateCardEntry = (input: RateCardEntryInput) =>
  unwrap<RateCardEntry>(api.api["rate-card"].entries.$post({ json: input }));

export const listAuditEvents = (cursor: string | null) =>
  unwrap<{ items: AuditEvent[]; nextCursor: string | null }>(
    api.api["audit-events"].$get({ query: cursor ? { cursor } : {} }),
  );
