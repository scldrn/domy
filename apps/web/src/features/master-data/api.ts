import type {
  CompanySettingsInput,
  Carrier,
  CarrierCreateInput,
  CarrierUpdateInput,
  Courier,
  CourierCreateInput,
  CourierUpdateInput,
  MerchantLinkReplacementInput,
  MerchantListItem,
  MerchantCreateInput,
  MerchantUpdateInput,
  NeighborhoodUpdateInput,
  PickupPointCreateInput,
  PickupPointUpdateInput,
  RateCardEntry,
  RateCardEntryInput,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";
import type { NeighborhoodOption } from "@/features/shipments/api";

/** Calls of the master data screens (User Story 6). */

type Active = "true" | "false" | undefined;

/** US4 FR-041: the office is read by dispatch and configured by its owner. */
export const getCompanySettings = () => unwrap(api.api.settings.$get());
export const updateCompanySettings = (input: CompanySettingsInput) =>
  unwrap(api.api.settings.$patch({ json: input }));

export async function listMerchants(q: string, active?: Active): Promise<MerchantListItem[]> {
  const { items } = await unwrap(
    api.api.merchants.$get({ query: { q, ...(active && { active }) } }),
  );
  return items;
}
export const getMerchant = (id: string) => unwrap(api.api.merchants[":id"].$get({ param: { id } }));
export const replaceMerchantLink = (
  id: string,
  input: MerchantLinkReplacementInput,
  expectedActorId: string,
) =>
  unwrap(
    api.api.merchants[":id"]["replace-link"].$post(
      { param: { id }, json: input },
      { headers: { "X-Domy-Actor-Id": expectedActorId } },
    ),
  );
export const createMerchant = (input: MerchantCreateInput) =>
  unwrap(api.api.merchants.$post({ json: input }));
export const updateMerchant = (id: string, input: MerchantUpdateInput) =>
  unwrap(api.api.merchants[":id"].$patch({ param: { id }, json: input }));
export const createPickupPoint = (merchantId: string, input: PickupPointCreateInput) =>
  unwrap(
    api.api.merchants[":id"]["pickup-points"].$post({ param: { id: merchantId }, json: input }),
  );
export const updatePickupPoint = (id: string, input: PickupPointUpdateInput) =>
  unwrap(api.api["pickup-points"][":id"].$patch({ param: { id }, json: input }));

export async function listCouriers(q: string, active?: Active): Promise<Courier[]> {
  const { items } = await unwrap(
    api.api.couriers.$get({ query: { q, ...(active && { active }) } }),
  );
  return items;
}
export const createCourier = (input: CourierCreateInput) =>
  unwrap(api.api.couriers.$post({ json: input }));
/** Answers with the courier's routes in preparation or in progress (feature 002, FR-010). */
export const updateCourier = (id: string, input: CourierUpdateInput) =>
  unwrap(api.api.couriers[":id"].$patch({ param: { id }, json: input }));

/** Links an account with the courier role to its courier, or unlinks it (feature 003, FR-002). */
export const linkCourierAccount = (
  userId: string,
  courierId: string | null,
  expectedActorId: string,
  actionId: string = crypto.randomUUID(),
) =>
  unwrap(
    api.api.couriers.accounts[":userId"].$put(
      {
        param: { userId },
        json: { actionId, courierId },
      },
      { headers: { "X-Domy-Actor-Id": expectedActorId } },
    ),
  );

export async function listAllCarriers(q: string): Promise<Carrier[]> {
  const { items } = await unwrap(api.api.carriers.$get({ query: { q } }));
  return items;
}
export const createCarrier = (input: CarrierCreateInput) =>
  unwrap(api.api.carriers.$post({ json: input }));
export const updateCarrier = (id: string, input: CarrierUpdateInput) =>
  unwrap(api.api.carriers[":id"].$patch({ param: { id }, json: input }));

export async function listNeighborhoods(query: {
  q: string;
  needsReview?: "true";
  active: "true" | "all";
}): Promise<(NeighborhoodOption & { isActive: boolean })[]> {
  const { items } = await unwrap(api.api.neighborhoods.$get({ query }));
  return items;
}
export const getNeighborhoodSummary = () => unwrap(api.api.neighborhoods.summary.$get());
export const getNeighborhood = (id: string) =>
  unwrap(api.api.neighborhoods[":id"].$get({ param: { id } }));
export const updateNeighborhood = (id: string, input: NeighborhoodUpdateInput) =>
  unwrap(api.api.neighborhoods[":id"].$patch({ param: { id }, json: input }));

export const getRateCard = (merchantId: string | null) =>
  unwrap(api.api["rate-card"].$get({ query: merchantId ? { merchantId } : {} }));
export async function getRateCardHistory(merchantId: string | null): Promise<RateCardEntry[]> {
  const { items } = await unwrap(
    api.api["rate-card"].history.$get({ query: merchantId ? { merchantId } : {} }),
  );
  return items;
}
export const addRateCardEntry = (input: RateCardEntryInput) =>
  unwrap(api.api["rate-card"].entries.$post({ json: input }));

export const listAuditEvents = (cursor: string | null) =>
  unwrap(api.api["audit-events"].$get({ query: cursor ? { cursor } : {} }));
