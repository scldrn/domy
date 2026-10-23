import { expect, test } from "./fixtures";
import { apiPort } from "./ports";

const violationStorageKey = "domy-csp-violated-directives";

test("keeps bundled styles CSP-clean while keyboard selecting a carrier", async ({
  dispatcherPage: page,
}) => {
  const health = await fetch(`http://127.0.0.1:${String(apiPort)}/health/live`);
  expect(health.status).toBe(200);
  const appPolicy = health.headers.get("content-security-policy");
  if (!appPolicy) throw new Error("The app health response must provide its CSP");
  expect(appPolicy).toContain("style-src-elem 'self'");

  const originalViewport = page.viewportSize();
  if (!originalViewport) throw new Error("The CSP test needs a fixed browser viewport");
  await page.setViewportSize({ width: originalViewport.width, height: 420 });
  await page.addInitScript((key: string) => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const recorded = window.sessionStorage.getItem(key);
      const directives = recorded ? recorded.split(",") : [];
      directives.push(event.violatedDirective);
      window.sessionStorage.setItem(key, directives.join(","));
    });
  }, violationStorageKey);
  await page.route("**/envios/nuevo", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": appPolicy },
    });
  });

  const documentResponse = await page.goto("/envios/nuevo");
  expect(documentResponse?.headers()["content-security-policy"]).toBe(appPolicy);
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo envío" })).toBeVisible();
  await page.getByRole("button", { name: "Entrega a transportadora" }).click();

  const carrier = page.getByRole("combobox", { name: "Transportadora", exact: true });
  await expect(carrier).toBeVisible();
  await carrier.press("ArrowDown");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const scrollArea = page.locator(".base-ui-disable-scrollbar").first();
  await expect(scrollArea).toBeVisible();
  const scrollbarWidth = await scrollArea.evaluate((element) =>
    window.getComputedStyle(element).getPropertyValue("scrollbar-width"),
  );
  const options = listbox.getByRole("option");
  await expect(options).toHaveCount(11);
  const firstLabel = (await options.first().innerText()).trim();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(carrier).toContainText(firstLabel);
  await page.setViewportSize(originalViewport);

  const violations = await page.evaluate(
    (key) => window.sessionStorage.getItem(key) ?? "",
    violationStorageKey,
  );
  expect(violations, "the app shell and Select must not violate their CSP").toBe("");
  expect(scrollbarWidth).toBe("none");
});
