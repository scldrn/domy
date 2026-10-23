import dns from "node:dns";
import { expect, test } from "./fixtures";

test("local API transport does not depend on hostname resolution (T136)", async ({
  request,
  baseURL,
}) => {
  if (!baseURL) throw new Error("The browser harness must configure its app origin");
  const control = new URL("/api/auth/get-session", baseURL);
  control.hostname = "localhost";
  const nativeLookup = dns.promises.lookup;
  let lookups = 0;
  dns.promises.lookup = (): Promise<never> => {
    lookups++;
    return Promise.reject(new Error("Controlled test hostname lookup refusal"));
  };
  try {
    // Prove the native APIRequestContext uses this failure boundary before asserting
    // that the actual configured app request bypasses it. No response is fabricated.
    await expect(request.get(control.href)).rejects.toThrow(
      "Controlled test hostname lookup refusal",
    );
    expect(lookups).toBeGreaterThan(0);
    lookups = 0;
    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
    expect(lookups).toBe(0);
  } finally {
    dns.promises.lookup = nativeLookup;
  }
});

test("the seeded owner reaches the empty panel", async ({ ownerPage }) => {
  await ownerPage.goto("/");
  await expect(ownerPage.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
});

test("an anonymous visitor is sent to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ingresar/);
});
