import { queryOptions } from "@tanstack/react-query";
import type { MerchantDay, MerchantShipment, PublicTracking } from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

export function publicTrackingQuery(code: string) {
  return queryOptions({
    queryKey: ["public-tracking", code] as const,
    queryFn: async (): Promise<PublicTracking> =>
      unwrap(api.api.public.tracking[":code"].$get({ param: { code } })),
  });
}

export function publicMerchantDayQuery(code: string, date?: string) {
  return queryOptions({
    queryKey: ["public-merchant-day", code, date ?? null] as const,
    queryFn: async (): Promise<MerchantDay> =>
      unwrap(
        api.api.public.merchant[":code"].$get({
          param: { code },
          query: date === undefined ? {} : { date },
        }),
      ),
  });
}

export function publicMerchantShipmentQuery(code: string, id: string) {
  return queryOptions({
    queryKey: ["public-merchant-shipment", code, id] as const,
    queryFn: async (): Promise<MerchantShipment> =>
      unwrap(api.api.public.merchant[":code"].shipments[":id"].$get({ param: { code, id } })),
  });
}

export function publicMerchantPhotoUrl(code: string, photoId: string): string {
  return api.api.public.merchant[":code"].photos[":photoId"].$path({
    param: { code, photoId },
  });
}
