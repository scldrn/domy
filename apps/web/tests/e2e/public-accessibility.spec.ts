import { formatTrackingNumber } from "@domy/domain";
import { z } from "zod";
import type { BrowserContext, Page, Route } from "@playwright/test";
import { accessibilityViolations, expect, test } from "./fixtures";
import { webPort } from "./ports";

const serviceDate = "2026-10-01";
const emptyNotificationDate = "2026-08-15";
const viewportHeight = 800;
const publicOrigin = `http://127.0.0.1:${String(webPort)}`;
const supportPhone = "3015550123";
const municipalityCatalog = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
const createdShipment = z.object({ id: z.uuid(), trackingNumber: z.string().min(1) });
const merchantDetail = z.object({ linkCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) });
const shipmentDetail = z.object({ trackingCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) });

type MerchantFixture = { id: string; pickupPointId: string; name: string };
type ShipmentFixture = { id: string; trackingNumber: string; recipientName: string };

async function createMerchant(
  page: Page,
  name: string,
  whatsappPhone: string | null,
): Promise<MerchantFixture> {
  const id = crypto.randomUUID();
  const response = await page.request.post("/api/merchants", {
    data: { id, name, whatsappPhone },
  });
  expect(response.status()).toBe(201);

  const catalogResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(catalogResponse.ok()).toBe(true);
  const neighborhoods = municipalityCatalog.parse(await catalogResponse.json()).items;
  const neighborhood = neighborhoods.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("The e2e catalog lacks Laureles");

  const pickupPointId = crypto.randomUUID();
  const pickupResponse = await page.request.post(`/api/merchants/${id}/pickup-points`, {
    data: {
      id: pickupPointId,
      label: "Punto de accesibilidad T032",
      address: "Calle 55 # 44-12",
      neighborhoodId: neighborhood.id,
      isDefault: true,
    },
  });
  expect(pickupResponse.status()).toBe(201);
  return { id, pickupPointId, name };
}

async function createShipment(
  page: Page,
  merchant: MerchantFixture,
  recipientName: string,
): Promise<ShipmentFixture> {
  const catalogResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(catalogResponse.ok()).toBe(true);
  const neighborhoods = municipalityCatalog.parse(await catalogResponse.json()).items;
  const neighborhood = neighborhoods.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("The e2e catalog lacks Laureles");

  const response = await page.request.post("/api/shipments", {
    data: {
      id: crypto.randomUUID(),
      kind: "delivery",
      serviceDate,
      merchantId: merchant.id,
      pickupPointId: merchant.pickupPointId,
      recipientName,
      recipientPhone: "3109876543",
      recipientAddress: "Carrera 66 # 31-09",
      recipientNeighborhoodId: neighborhood.id,
      paymentMode: "merchant_account",
      codAmount: 0,
      fee: 13000,
    },
  });
  expect(response.status()).toBe(201);
  return { ...createdShipment.parse(await response.json()), recipientName };
}

async function merchantPath(page: Page, merchantId: string): Promise<string> {
  const response = await page.request.get(`/api/merchants/${merchantId}`);
  expect(response.ok()).toBe(true);
  return `/cliente/${merchantDetail.parse(await response.json()).linkCode}`;
}

/** Reads the generated public code through the authenticated shipment detail API. */
async function trackingPath(page: Page, shipmentId: string): Promise<string> {
  const response = await page.request.get(`/api/shipments/${shipmentId}`);
  expect(response.ok()).toBe(true);
  const detail = shipmentDetail.parse(await response.json());
  return `/seguimiento/${detail.trackingCode}`;
}

async function supportFixture(owner: Page): Promise<() => Promise<void>> {
  const originalResponse = await owner.request.get("/api/settings");
  expect(originalResponse.ok()).toBe(true);
  const original = z
    .object({ supportPhone: z.string().nullable(), companyName: z.string() })
    .parse(await originalResponse.json());
  const update = async (phone: string | null, companyName: string) => {
    const response = await owner.request.patch("/api/settings", {
      data: { actionId: crypto.randomUUID(), supportPhone: phone, companyName },
    });
    expect(response.ok()).toBe(true);
  };
  await update(supportPhone, "Cohex");
  return () => update(original.supportPhone, original.companyName);
}

async function responsiveProblems(page: Page, width: number): Promise<string[]> {
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  const targetProblems = await page.evaluate(() => {
    const selector = [
      "a[href]",
      "button",
      'input:not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
      "textarea",
      "select",
      "summary",
      'label:has(input[type="checkbox"])',
      'label:has(input[type="radio"])',
    ].join(",");
    return [...document.querySelectorAll<HTMLElement>(selector)].flatMap((element) => {
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return [];
      if (element.classList.contains("sr-only") && !element.matches(":focus")) return [];
      const { width: targetWidth, height: targetHeight } = element.getBoundingClientRect();
      if (targetWidth >= 48 && targetHeight >= 48) return [];
      const name = (element.getAttribute("aria-label") ?? element.innerText)
        .replace(/\s+/gu, " ")
        .trim();
      return [
        `${name || element.tagName}: ${String(Math.round(targetWidth))}×${String(Math.round(targetHeight))} px`,
      ];
    });
  });
  const problems = [...targetProblems];
  if (horizontalOverflow > 0)
    problems.push(`horizontal overflow ${String(horizontalOverflow)} px at ${String(width)} px`);
  return problems;
}

async function tabUntilFocused(page: Page, target: ReturnType<Page["getByRole"]>, limit = 60) {
  for (let step = 0; step < limit; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("The action could not be reached in the keyboard order");
}

async function expectVisibleFocus(target: ReturnType<Page["getByRole"]>) {
  await expect(target).toBeFocused();
  const focus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focus.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
}

test("public tracking and merchant screens stay usable on phone and desktop in light and dark", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
}) => {
  test.setTimeout(180_000);
  const restoreSupport = await supportFixture(owner);
  try {
    const suffix = crypto.randomUUID().slice(0, 8);
    const merchant = await createMerchant(office, `Accesibilidad T032 ${suffix}`, "3001234567");
    const shipment = await createShipment(office, merchant, `Destinatario T032 ${suffix}`);
    const merchantUrl = await merchantPath(office, merchant.id);
    const trackingUrl = await trackingPath(office, shipment.id);
    const trackingCode = new URL(trackingUrl, publicOrigin).pathname.split("/").at(-1);
    if (!trackingCode) throw new Error("The tracking link fixture is missing");
    const trackingApiPath = `/api/public/tracking/${trackingCode}`;

    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        baseURL: publicOrigin,
        colorScheme,
        locale: "es-CO",
        timezoneId: "America/Bogota",
        viewport: { width: 320, height: viewportHeight },
      });
      try {
        const visitor = await context.newPage();
        if (colorScheme === "light") {
          await visitor.setViewportSize({ width: 320, height: viewportHeight });
          const trackingRoutePattern = "**/api/public/tracking/**";
          let releaseTrackingResponse: (() => void) | undefined;
          let finishTrackingResponse: (() => void) | undefined;
          let trackingResponseFinished = Promise.resolve();
          const trackingResponseGate = new Promise<void>((resolve) => {
            releaseTrackingResponse = resolve;
          });
          let realTrackingResponseHeld = false;
          const holdTrackingResponse = async (route: Route) => {
            if (new URL(route.request().url()).pathname !== trackingApiPath) {
              await route.continue();
              return;
            }
            trackingResponseFinished = new Promise<void>((resolve) => {
              finishTrackingResponse = resolve;
            });
            try {
              const response = await route.fetch();
              realTrackingResponseHeld = true;
              await trackingResponseGate;
              await route.fulfill({ response });
            } finally {
              finishTrackingResponse?.();
            }
          };
          await visitor.route(trackingRoutePattern, holdTrackingResponse);
          try {
            await visitor.goto(trackingUrl);
            await expect.poll(() => realTrackingResponseHeld).toBe(true);
            await expect(visitor.getByRole("status")).toContainText("Cargando seguimiento");
            expect(await accessibilityViolations(visitor), "tracking loading at 320 px").toEqual(
              [],
            );
            expect(await responsiveProblems(visitor, 320), "tracking loading at 320 px").toEqual(
              [],
            );
          } finally {
            releaseTrackingResponse?.();
            await trackingResponseFinished;
          }
          await expect(visitor.getByText("Recibimos tu envío", { exact: true })).toBeVisible();
          await visitor.unroute(trackingRoutePattern, holdTrackingResponse);

          let blockTrackingRequests = true;
          const failTrackingRequests = async (route: Route) => {
            if (new URL(route.request().url()).pathname !== trackingApiPath) {
              await route.continue();
              return;
            }
            if (blockTrackingRequests) await route.abort("failed");
            else await route.continue();
          };
          await visitor.route(trackingRoutePattern, failTrackingRequests);
          await visitor.reload();
          await expect(visitor.getByRole("alert")).toContainText("No hay conexión con el servidor");
          expect(
            await accessibilityViolations(visitor),
            "tracking transport error at 320 px",
          ).toEqual([]);
          expect(
            await responsiveProblems(visitor, 320),
            "tracking transport error at 320 px",
          ).toEqual([]);
          blockTrackingRequests = false;
          await visitor.getByRole("button", { name: "Reintentar", exact: true }).click();
          await expect(visitor.getByText("Recibimos tu envío", { exact: true })).toBeVisible();
          expect(
            await accessibilityViolations(visitor),
            "tracking transport recovery at 320 px",
          ).toEqual([]);
          await visitor.unroute(trackingRoutePattern, failTrackingRequests);
        }
        for (const width of [320, 1280] as const) {
          await visitor.setViewportSize({ width, height: viewportHeight });
          await visitor.goto(trackingUrl);
          await expect(
            visitor.getByRole("heading", { level: 1, name: "Seguimiento de envío" }),
          ).toBeVisible();
          await expect(visitor.getByText("Recibimos tu envío", { exact: true })).toBeVisible();
          await expect(visitor.locator(`a[href="tel:+57${supportPhone}"]`)).toBeVisible();
          expect(
            await accessibilityViolations(visitor),
            `tracking ${String(width)} ${colorScheme}`,
          ).toEqual([]);
          expect(
            await responsiveProblems(visitor, width),
            `tracking ${String(width)} ${colorScheme}`,
          ).toEqual([]);

          if (width === 320 && colorScheme === "light") {
            const supportCall = visitor.locator(`a[href="tel:+57${supportPhone}"]`);
            const supportWhatsApp = visitor.locator(`a[href="https://wa.me/57${supportPhone}"]`);
            await tabUntilFocused(visitor, supportCall);
            await expectVisibleFocus(supportCall);
            await visitor.keyboard.press("Tab");
            await expectVisibleFocus(supportWhatsApp);
          }

          await visitor.goto(merchantUrl);
          await expect(
            visitor.getByRole("heading", { level: 1, name: "Envíos del cliente" }),
          ).toBeVisible();
          const shipmentButton = visitor
            .getByRole("button")
            .filter({ hasText: formatTrackingNumber(shipment.trackingNumber) });
          await expect(shipmentButton).toBeVisible();
          expect(
            await accessibilityViolations(visitor),
            `merchant list ${String(width)} ${colorScheme}`,
          ).toEqual([]);
          expect(
            await responsiveProblems(visitor, width),
            `merchant list ${String(width)} ${colorScheme}`,
          ).toEqual([]);

          await tabUntilFocused(visitor, shipmentButton);
          await expectVisibleFocus(shipmentButton);
          await visitor.keyboard.press("Enter");
          await expect(
            visitor.getByRole("heading", { level: 2, name: shipment.recipientName }),
          ).toBeVisible();
          expect(
            await accessibilityViolations(visitor),
            `merchant detail ${String(width)} ${colorScheme}`,
          ).toEqual([]);
          expect(
            await responsiveProblems(visitor, width),
            `merchant detail ${String(width)} ${colorScheme}`,
          ).toEqual([]);

          const backButton = visitor.getByRole("button", {
            name: "Volver a los envíos",
            exact: true,
          });
          await tabUntilFocused(visitor, backButton);
          await expectVisibleFocus(backButton);
          await visitor.keyboard.press("Enter");
          await expect(shipmentButton).toBeVisible();
          expect(
            await accessibilityViolations(visitor),
            `merchant return ${String(width)} ${colorScheme}`,
          ).toEqual([]);
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await restoreSupport();
  }
});

test("merchant loading, empty, and transport-error states remain announced and recoverable", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
}) => {
  test.setTimeout(90_000);
  const restoreSupport = await supportFixture(owner);
  let context: BrowserContext | undefined;
  let releaseResponse: (() => void) | undefined;
  let finishResponse: (() => void) | undefined;
  let responseFinished = Promise.resolve();
  try {
    const merchant = await createMerchant(
      office,
      `Vacío T032 ${crypto.randomUUID().slice(0, 8)}`,
      null,
    );
    const merchantUrl = await merchantPath(office, merchant.id);
    const merchantCode = new URL(merchantUrl, publicOrigin).pathname.split("/").at(-1);
    if (!merchantCode) throw new Error("The merchant link fixture is missing");
    const apiPath = `/api/public/merchant/${merchantCode}`;
    context = await browser.newContext({
      baseURL: publicOrigin,
      viewport: { width: 320, height: viewportHeight },
      colorScheme: "light",
      locale: "es-CO",
      timezoneId: "America/Bogota",
    });
    const visitor = await context.newPage();
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let realResponseHeld = false;
    const holdResponse = async (route: import("@playwright/test").Route) => {
      if (new URL(route.request().url()).pathname !== apiPath) {
        await route.continue();
        return;
      }
      responseFinished = new Promise<void>((resolve) => {
        finishResponse = resolve;
      });
      try {
        const response = await route.fetch();
        realResponseHeld = true;
        await responseGate;
        await route.fulfill({ response });
      } finally {
        finishResponse?.();
      }
    };

    try {
      await visitor.route("**/api/public/merchant/**", holdResponse);
      await visitor.goto(merchantUrl);
      await expect.poll(() => realResponseHeld).toBe(true);
      await expect(visitor.getByRole("status")).toContainText("Cargando los envíos");
      expect(await accessibilityViolations(visitor), "merchant loading at 320 px").toEqual([]);
      expect(await responsiveProblems(visitor, 320), "merchant loading at 320 px").toEqual([]);
    } finally {
      releaseResponse?.();
      await responseFinished;
    }

    await expect(visitor.getByRole("status")).toContainText("No hay envíos para esta fecha.");
    const dateControl = visitor.getByLabel("Fecha de los envíos", { exact: true });
    await tabUntilFocused(visitor, dateControl);
    await expectVisibleFocus(dateControl);
    expect(await accessibilityViolations(visitor), "merchant empty at 320 px").toEqual([]);
    expect(await responsiveProblems(visitor, 320), "merchant empty at 320 px").toEqual([]);
    await visitor.unroute("**/api/public/merchant/**", holdResponse);

    let blockRequests = true;
    const publicNetworkFailure = async (route: import("@playwright/test").Route) => {
      if (new URL(route.request().url()).pathname === apiPath) {
        if (blockRequests) await route.abort("failed");
        else await route.continue();
        return;
      }
      await route.continue();
    };
    await visitor.route("**/api/public/merchant/**", publicNetworkFailure);
    await visitor.reload();
    await expect(visitor.getByRole("alert")).toContainText(
      "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    );
    await expect(visitor.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
    expect(await accessibilityViolations(visitor), "merchant transport error at 320 px").toEqual(
      [],
    );
    expect(await responsiveProblems(visitor, 320), "merchant transport error at 320 px").toEqual(
      [],
    );

    blockRequests = false;
    await visitor.getByRole("button", { name: "Reintentar", exact: true }).click();
    await expect(visitor.getByRole("status")).toContainText("No hay envíos para esta fecha.");
    expect(await accessibilityViolations(visitor), "merchant error recovery at 320 px").toEqual([]);

    for (const colorScheme of ["light", "dark"] as const) {
      await visitor.emulateMedia({ colorScheme });
      for (const width of [320, 1280] as const) {
        await visitor.setViewportSize({ width, height: viewportHeight });
        await visitor.reload();
        await expect(visitor.getByRole("status")).toContainText("No hay envíos para esta fecha.");
        expect(
          await accessibilityViolations(visitor),
          `merchant empty ${String(width)} ${colorScheme}`,
        ).toEqual([]);
        expect(
          await responsiveProblems(visitor, width),
          `merchant empty ${String(width)} ${colorScheme}`,
        ).toEqual([]);
      }
    }
  } finally {
    try {
      await context?.close();
    } finally {
      await restoreSupport();
    }
  }
});

test("notification screens include announced loading, empty and error states plus keyboard actions", async ({
  dispatcherPage: page,
}) => {
  test.setTimeout(150_000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(page, `Teclado T032 ${suffix}`, "3001234567");
  await createShipment(page, merchant, `Envío T032 ${suffix}`);
  await createShipment(page, merchant, `Segundo envío T032 ${suffix}`);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: publicOrigin,
  });

  await page.context().route("https://wa.me/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>WhatsApp aislado para la prueba</title>",
    });
  });

  let releaseList: (() => void) | undefined;
  let finishList: (() => void) | undefined;
  let listResponseFinished = Promise.resolve();
  const listGate = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  let realListResponseHeld = false;
  const holdListResponse = async (route: import("@playwright/test").Route) => {
    if (
      route.request().method() !== "GET" ||
      new URL(route.request().url()).pathname !== "/api/notifications"
    ) {
      await route.continue();
      return;
    }
    listResponseFinished = new Promise<void>((resolve) => {
      finishList = resolve;
    });
    try {
      const response = await route.fetch();
      realListResponseHeld = true;
      await listGate;
      await route.fulfill({ response });
    } finally {
      finishList?.();
    }
  };

  const notificationRoutePattern = "**/api/notifications**";
  await page.route(notificationRoutePattern, holdListResponse);
  await page.setViewportSize({ width: 320, height: viewportHeight });
  await page.emulateMedia({ colorScheme: "light" });
  try {
    await page.goto("/notificar");
    await expect.poll(() => realListResponseHeld).toBe(true);
    const skipLink = page.getByRole("link", { name: "Saltar al contenido", exact: true });
    await tabUntilFocused(page, skipLink);
    await expectVisibleFocus(skipLink);
    const skipLinkBounds = await skipLink.boundingBox();
    if (!skipLinkBounds) throw new Error("The skip link has no visible keyboard target");
    expect(skipLinkBounds.width).toBeGreaterThanOrEqual(48);
    expect(skipLinkBounds.height).toBeGreaterThanOrEqual(48);
    await expect(
      page.getByRole("status", { name: "Cargando envíos para notificar", exact: true }),
    ).toBeVisible();
    expect(await accessibilityViolations(page), "notifications loading at 320 px").toEqual([]);
    expect(await responsiveProblems(page, 320), "notifications loading at 320 px").toEqual([]);
  } finally {
    releaseList?.();
    await listResponseFinished;
    await page.unroute(notificationRoutePattern, holdListResponse);
  }

  const card = page.getByRole("article", { name: merchant.name, exact: true });
  await expect(card).toContainText("2 envíos sin notificar");
  expect(await accessibilityViolations(page), "notifications loaded at 320 px").toEqual([]);

  const dateInput = page.getByLabel("Fecha de los envíos", { exact: true });
  await dateInput.fill(emptyNotificationDate);
  await expect(
    page.getByText("No hay envíos para notificar en esta fecha", { exact: true }),
  ).toBeVisible();
  expect(await accessibilityViolations(page), "notifications empty at 320 px").toEqual([]);
  expect(await responsiveProblems(page, 320), "notifications empty at 320 px").toEqual([]);

  let blockListRequests = true;
  const notificationNetworkFailure = async (route: import("@playwright/test").Route) => {
    if (
      route.request().method() === "GET" &&
      new URL(route.request().url()).pathname === "/api/notifications"
    ) {
      if (blockListRequests) await route.abort("failed");
      else await route.continue();
      return;
    }
    await route.continue();
  };
  await page.route(notificationRoutePattern, notificationNetworkFailure);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("No hay conexión con el servidor");
  expect(await accessibilityViolations(page), "notifications transport error at 320 px").toEqual(
    [],
  );
  expect(await responsiveProblems(page, 320), "notifications transport error at 320 px").toEqual(
    [],
  );
  blockListRequests = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByText("No hay envíos para notificar en esta fecha", { exact: true }),
  ).toBeVisible();
  expect(await accessibilityViolations(page), "notifications error recovery at 320 px").toEqual([]);
  await page.unroute(notificationRoutePattern, notificationNetworkFailure);

  await dateInput.fill(serviceDate);
  await expect(card).toContainText("2 envíos sin notificar");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 1280] as const) {
      await page.setViewportSize({ width, height: viewportHeight });
      await page.goto("/notificar");
      await expect(card).toContainText("2 envíos sin notificar");
      expect(
        await accessibilityViolations(page),
        `notifications ${String(width)} ${colorScheme}`,
      ).toEqual([]);
      expect(
        await responsiveProblems(page, width),
        `notifications ${String(width)} ${colorScheme}`,
      ).toEqual([]);
    }
  }

  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 320, height: viewportHeight });
  await page.goto("/notificar");
  const sendButton = card.getByRole("button", { name: "Enviar por WhatsApp", exact: true });
  let actualStatus: number | undefined;
  let posts = 0;
  let allowRetry = false;
  await page.route("**/api/notifications", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posts += 1;
    if (posts === 1) {
      const response = await route.fetch();
      actualStatus = response.status();
      await route.abort("failed");
      return;
    }
    if (!allowRetry) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await tabUntilFocused(page, sendButton);
  await expectVisibleFocus(sendButton);
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await expect.poll(() => popup.url().startsWith("https://wa.me/")).toBe(true);
  await expect.poll(() => actualStatus).toBe(204);
  await expect(
    card.getByText("El mensaje se abrió o copió, pero falta registrar la notificación.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await accessibilityViolations(page), "notification recovery pending at 320 px").toEqual(
    [],
  );

  const retryButton = card.getByRole("button", { name: "Reintentar registro", exact: true });
  await tabUntilFocused(page, retryButton);
  await expectVisibleFocus(retryButton);
  allowRetry = true;
  const retryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications" &&
      response.status() === 204,
  );
  await page.keyboard.press("Enter");
  expect((await retryResponse).status()).toBe(204);
  await expect(card).toContainText("Notificado");
  expect(
    await accessibilityViolations(page),
    "notification recovery acknowledged at 320 px",
  ).toEqual([]);

  const includeAll = card.getByRole("checkbox", {
    name: "Incluir todos los envíos del día",
    exact: true,
  });
  await tabUntilFocused(page, includeAll);
  await expectVisibleFocus(includeAll);
  await page.keyboard.press("Space");
  await expect(includeAll).toBeChecked();
  const copyButton = card.getByRole("button", { name: "Copiar mensaje", exact: true });
  await tabUntilFocused(page, copyButton);
  await expectVisibleFocus(copyButton);
  const copyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications" &&
      response.status() === 204,
  );
  await page.keyboard.press("Enter");
  expect((await copyResponse).status()).toBe(204);
  const copiedMessage = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedMessage.length).toBeGreaterThan(0);
  expect(copiedMessage.includes(merchant.name)).toBe(true);
  expect(await accessibilityViolations(page), "notification copied by keyboard at 320 px").toEqual(
    [],
  );
});
