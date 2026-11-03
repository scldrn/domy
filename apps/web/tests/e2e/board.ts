import { formatTrackingNumber, type Shipment } from "@domy/domain";
import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

/** A shipment's row on the dispatch board, found by its tracking number button. */
export const boardRow = (scope: Page | Locator, shipment: Shipment) =>
  scope.getByRole("row").filter({
    has: scope.getByRole("button", {
      name: formatTrackingNumber(shipment.trackingNumber),
      exact: true,
    }),
  });

/**
 * The board lists eight shipments first (feature 006, FR-008); every spec shares one day of
 * shipments, so one that looks for a row opens the whole list once the board has loaded.
 */
export async function showEveryShipment(page: Page) {
  const list = page.getByRole("table", { name: "Envíos del día" });
  const empty = page.getByText(
    /^(Todavía no hay envíos para hoy|No hay envíos registrados para este día|Ningún envío de este día coincide con los filtros)$/,
  );
  await expect(list.or(empty)).toBeVisible();
  const more = page.getByRole("button", { name: /^Ver los \d+ envíos$/ });
  if ((await more.count()) > 0) await more.click();
}
