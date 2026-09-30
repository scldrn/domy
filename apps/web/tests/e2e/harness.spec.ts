import { expect, test } from "./fixtures";

test("the seeded owner reaches the empty panel", async ({ ownerPage }) => {
  await ownerPage.goto("/");
  await expect(ownerPage.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
});

test("an anonymous visitor is sent to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ingresar/);
});
