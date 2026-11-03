import { formatTrackingNumber } from "@domy/domain";
import { register } from "./api";
import { boardRow, showEveryShipment } from "./board";
import { expect, test } from "./fixtures";

/** How the panel feels to use: keyboard, the board's day, its stages, and motion (design-system.md §8). */

test("the keyboard reaches the content first and the search with '/'", async ({
  dispatcherPage: page,
  browserName,
}) => {
  await page.goto("/historial");
  await expect(page.getByRole("heading", { level: 1, name: "Historial" })).toBeVisible();

  // Safari moves between links with Option+Tab unless the person turns on Tab for links.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();

  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Buscar envíos" });
  await expect(search).toBeFocused();
  await search.fill("Laura");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/historial\?q=Laura/);

  // Inside a field, "/" is just a character.
  const field = page.getByLabel("Buscar", { exact: true });
  await field.fill("");
  await field.press("/");
  await expect(field).toHaveValue("/");
});

test("the board names its day and steps between days", async ({ dispatcherPage: page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/Tablero de despacho, Jueves 1 de octubre/);
  await expect(page.getByText(/^Hoy (hay|no hay)/)).toBeVisible();

  await page.getByRole("button", { name: "Día siguiente" }).click();
  await expect(page).toHaveURL(/date=2026-10-02/);
  await expect(heading).toHaveText(/Viernes 2 de octubre/);
  await expect(page.getByText(/^Este día (tiene|no tiene)/)).toBeVisible();

  await page.getByRole("button", { name: "Ir a hoy" }).click();
  await expect(page).not.toHaveURL(/date=/);
  await expect(heading).toHaveText(/Jueves 1 de octubre/);

  await page.getByRole("button", { name: "Día anterior" }).click();
  await expect(heading).toHaveText(/Miércoles 30 de septiembre/);
});

test("a stage on the day summary filters the list and takes you there", async ({
  dispatcherPage: page,
}) => {
  const shipment = await register(page, { window: { preset: "morning" } });
  await page.goto("/");
  const stages = page.getByRole("group", { name: "Filtrar los envíos por etapa" });
  const open = stages.getByRole("button", { name: /^Por salir/ });

  await open.click();
  await expect(open).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#envios")).toBeInViewport();
  await showEveryShipment(page);
  await expect(
    boardRow(page, shipment).getByRole("button", {
      name: formatTrackingNumber(shipment.trackingNumber),
    }),
  ).toBeVisible();

  await open.click();
  await expect(open).toHaveAttribute("aria-pressed", "false");
  await expect(page).not.toHaveURL(/stage=/);
});

test("the stage bar does not animate for people who ask for less motion", async ({
  dispatcherPage: page,
}) => {
  await register(page, { window: { preset: "afternoon" } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .getByRole("region", { name: /Tablero de despacho/ })
    .locator("[aria-hidden=true] > span")
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(0.001);
});
