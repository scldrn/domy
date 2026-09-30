import type { Shipment } from "@domy/domain";
import { expect, type Page } from "@playwright/test";

/**
 * Registers a Bullish Hype delivery through the API, as the page's user, to Laureles or to
 * the place named by `neighborhood`.
 */
export async function register(
  page: Page,
  overrides: Record<string, unknown> = {},
  neighborhood = "Laureles",
): Promise<Shipment> {
  const get = async <T>(path: string) => (await (await page.request.get(path)).json()) as T;
  const [merchant] = (await get<{ items: { id: string }[] }>("/api/merchants?q=Bullish")).items;
  const [place] = (
    await get<{ items: { id: string }[] }>(
      `/api/neighborhoods?q=${encodeURIComponent(neighborhood)}`,
    )
  ).items;
  if (!merchant || !place) throw new Error(`The e2e catalog lacks Bullish Hype or ${neighborhood}`);
  const [point] = (
    await get<{ items: { id: string }[] }>(`/api/merchants/${merchant.id}/pickup-points`)
  ).items;
  const response = await page.request.post("/api/shipments", {
    data: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: merchant.id,
      pickupPointId: point?.id,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: place.id,
      paymentMode: "cash_on_delivery",
      codAmount: 85000,
      fee: 13000,
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Shipment;
}
