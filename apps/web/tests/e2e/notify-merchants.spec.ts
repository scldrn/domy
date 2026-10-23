import type { Page } from "@playwright/test";
import { z } from "zod";
import { formatTrackingNumber } from "@domy/domain";
import { accessibilityViolations, expect, test } from "./fixtures";
import { apiPort, webPort } from "./ports";
import { formatDateTime } from "../../src/lib/format";

const serviceDate = "2026-10-01";
const viewport = { width: 320, height: 800 };
const publicOrigin = `http://127.0.0.1:${String(webPort)}`;
const apiOrigin = `http://127.0.0.1:${String(apiPort)}`;

type MerchantFixture = { id: string; name: string; pickupPointId: string };
type ShipmentFixture = { id: string; trackingNumber: string; recipientName: string };

const neighborhoodListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
const merchantDetailSchema = z.object({ linkCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) });
const createdShipmentSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string().trim().min(1),
});
const shipmentNotificationSchema = z.object({ notifiedAt: z.iso.datetime().nullable() });
const notificationRequestSchema = z.object({
  actionId: z.uuid(),
  shipmentIds: z.array(z.uuid()).min(1),
});
const trackingViewSchema = z.object({ trackingNumber: z.string() });

async function createMerchant(
  page: Page,
  name: string,
  whatsappPhone: string | null,
): Promise<MerchantFixture> {
  const id = crypto.randomUUID();
  const merchantResponse = await page.request.post("/api/merchants", {
    data: { id, name, whatsappPhone },
  });
  expect(merchantResponse.status()).toBe(201);

  const neighborhoodResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(neighborhoodResponse.ok()).toBe(true);
  const neighborhoods = neighborhoodListSchema.safeParse(await neighborhoodResponse.json());
  if (!neighborhoods.success) throw new Error("The e2e neighborhood fixture is invalid");
  const neighborhood = neighborhoods.data.items.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("The e2e catalog lacks Laureles");

  const pickupPointId = crypto.randomUUID();
  const pickupResponse = await page.request.post(`/api/merchants/${id}/pickup-points`, {
    data: {
      id: pickupPointId,
      label: "Punto privado T019",
      address: "Calle 55 # 44-12 Torre Álamo",
      neighborhoodId: neighborhood.id,
      isDefault: true,
    },
  });
  expect(pickupResponse.status()).toBe(201);
  return { id, name, pickupPointId };
}

async function createShipment(
  page: Page,
  merchant: MerchantFixture,
  recipientName: string,
): Promise<ShipmentFixture> {
  const neighborhoodResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(neighborhoodResponse.ok()).toBe(true);
  const neighborhoods = neighborhoodListSchema.safeParse(await neighborhoodResponse.json());
  if (!neighborhoods.success) throw new Error("The e2e neighborhood fixture is invalid");
  const neighborhood = neighborhoods.data.items.find((item) => item.name === "Laureles");
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
      recipientAddress: "Carrera 66 # 31-09 Torre Níspero",
      recipientNeighborhoodId: neighborhood.id,
      paymentMode: "merchant_account",
      codAmount: 0,
      fee: 13000,
    },
  });
  expect(response.status()).toBe(201);
  const shipment = createdShipmentSchema.safeParse(await response.json());
  if (!shipment.success) throw new Error("The e2e shipment fixture response is invalid");
  return { ...shipment.data, recipientName };
}

async function getMerchantLinkCode(page: Page, merchantId: string): Promise<string> {
  const response = await page.request.get(`/api/merchants/${merchantId}`);
  expect(response.ok()).toBe(true);
  const detail = merchantDetailSchema.safeParse(await response.json());
  if (!detail.success) throw new Error("The merchant detail did not include its private link");
  return detail.data.linkCode;
}

async function getNotifiedAt(page: Page, shipmentId: string): Promise<string> {
  const response = await page.request.get(`/api/shipments/${shipmentId}`);
  expect(response.ok()).toBe(true);
  const detail = shipmentNotificationSchema.safeParse(await response.json());
  if (!detail.success || detail.data.notifiedAt === null)
    throw new Error("The shipment detail did not include its notification time");
  return detail.data.notifiedAt;
}

function merchantCard(page: Page, name: string) {
  return page.getByRole("article", { name, exact: true });
}

function trackingCodesIn(message: string): string[] {
  return Array.from(
    message.matchAll(/https?:\/\/127\.0\.0\.1:\d+\/seguimiento\/([A-Za-z0-9_-]{22})/gu),
    (match) => match[1],
  ).filter((code): code is string => code !== undefined);
}

async function expectRealTrackingLinks(page: Page, message: string, count: number): Promise<void> {
  const codes = trackingCodesIn(message);
  expect(codes.length === count).toBe(true);
  let allLinksResolve = true;
  for (const code of codes) {
    const response = await page.request.get(`${apiOrigin}/api/public/tracking/${code}`);
    allLinksResolve = allLinksResolve && response.status() === 200;
  }
  expect(allLinksResolve).toBe(true);
}

async function expectRealMerchantLink(
  page: Page,
  message: string,
  linkCode: string,
): Promise<void> {
  expect(message.trimEnd().endsWith(`${publicOrigin}/cliente/${linkCode}`)).toBe(true);
  const response = await page.request.get(`${apiOrigin}/api/public/merchant/${linkCode}`);
  expect(response.status() === 200).toBe(true);
}

async function copyMessage(page: Page, card: ReturnType<typeof merchantCard>): Promise<string> {
  const markResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications",
  );
  await card.getByRole("button", { name: "Copiar mensaje", exact: true }).click();
  expect((await markResponse).status()).toBe(204);
  return page.evaluate(() => navigator.clipboard.readText());
}

test("opens WhatsApp in one tap, marks included shipments, and copies new-only or all-date messages", async ({
  dispatcherPage: page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(viewport);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: publicOrigin,
  });

  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(page, `Comercio T019 ${suffix}`, "3015550123");
  const otherMerchant = await createMerchant(page, `Otro comercio T019 ${suffix}`, "3015550124");
  const first = await createShipment(page, merchant, `Destinatario inicial T019 ${suffix}`);
  const second = await createShipment(page, merchant, `Destinatario dos T019 ${suffix}`);
  const otherShipments: ShipmentFixture[] = [];
  for (let index = 1; index <= 3; index++) {
    otherShipments.push(
      await createShipment(
        page,
        otherMerchant,
        `Destinatario otro comercio ${String(index)} T019 ${suffix}`,
      ),
    );
  }
  const linkCode = await getMerchantLinkCode(page, merchant.id);

  let interceptedWhatsApp = false;
  await page.context().route("https://wa.me/**", async (route) => {
    interceptedWhatsApp = true;
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>WhatsApp aislado para la prueba</title>",
    });
  });
  await page.goto("/notificar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notificar clientes", exact: true }),
  ).toBeVisible();
  const card = merchantCard(page, merchant.name);
  const otherCard = merchantCard(page, otherMerchant.name);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("2 envíos sin notificar");
  await expect(otherCard).toHaveCount(1);
  await expect(otherCard).toContainText("3 envíos sin notificar");
  expect(await accessibilityViolations(page)).toEqual([]);

  const notificationGate = Promise.withResolvers<boolean>();
  let notificationRequestReached = false;
  await page.route("**/api/notifications", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    notificationRequestReached = true;
    await notificationGate.promise;
    await route.continue();
  });
  const popupPromise = page.waitForEvent("popup");
  const notificationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications",
  );
  const { message, recipientIsCorrect, popupOpenedBeforeRelease } = await (async () => {
    try {
      await card.getByRole("button", { name: "Enviar por WhatsApp", exact: true }).click();
      const popup = await popupPromise;
      await expect.poll(() => popup.url().startsWith("https://wa.me/")).toBe(true);
      await expect.poll(() => interceptedWhatsApp).toBe(true);
      await expect.poll(() => notificationRequestReached).toBe(true);
      const whatsappUrl = new URL(popup.url());
      return {
        message: whatsappUrl.searchParams.get("text") ?? "",
        recipientIsCorrect:
          whatsappUrl.hostname === "wa.me" && whatsappUrl.pathname === "/573015550123",
        // The gate is released only in finally, after this snapshot is taken.
        popupOpenedBeforeRelease: notificationRequestReached,
      };
    } finally {
      notificationGate.resolve(true);
    }
  })();
  const marked = await notificationResponse;
  expect(marked.status()).toBe(204);
  expect(popupOpenedBeforeRelease).toBe(true);
  expect(recipientIsCorrect).toBe(true);
  const includesBothShipments = [first, second].every(
    (shipment) =>
      message.includes(shipment.recipientName) &&
      message.includes(formatTrackingNumber(shipment.trackingNumber)),
  );
  expect(includesBothShipments).toBe(true);
  const excludesOtherMerchant = otherShipments.every(
    (shipment) => !message.includes(shipment.recipientName),
  );
  expect(excludesOtherMerchant).toBe(true);
  await expectRealTrackingLinks(page, message, 2);
  await expectRealMerchantLink(page, message, linkCode);
  await expect(card).toContainText("Notificado");
  const notifiedAt = await getNotifiedAt(page, first.id);

  const newShipment = await createShipment(page, merchant, `Nuevo destinatario T019 ${suffix}`);
  await page.reload();
  const refreshedCard = merchantCard(page, merchant.name);
  await expect(refreshedCard).toContainText("1 envío sin notificar");
  const newOnlyMessage = await copyMessage(page, refreshedCard);
  const includesOnlyNewShipment =
    newOnlyMessage.includes(newShipment.recipientName) &&
    !newOnlyMessage.includes(first.recipientName) &&
    !newOnlyMessage.includes(second.recipientName);
  expect(includesOnlyNewShipment).toBe(true);
  await expectRealTrackingLinks(page, newOnlyMessage, 1);
  await expectRealMerchantLink(page, newOnlyMessage, linkCode);
  await expect(refreshedCard).toContainText("Notificado");

  await refreshedCard
    .getByRole("checkbox", { name: "Incluir todos los envíos del día", exact: true })
    .check();
  const allDateMessage = await copyMessage(page, refreshedCard);
  const includesAllShipments = [first, second, newShipment].every((shipment) =>
    allDateMessage.includes(shipment.recipientName),
  );
  expect(includesAllShipments).toBe(true);
  await expectRealTrackingLinks(page, allDateMessage, 3);
  await expectRealMerchantLink(page, allDateMessage, linkCode);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.goto(`/envios/${first.trackingNumber}`);
  await expect(
    page.getByRole("heading", { name: formatTrackingNumber(first.trackingNumber) }),
  ).toBeVisible();
  await expect(page.getByRole("term").filter({ hasText: /^Notificado$/u })).toBeVisible();
  const notifiedAtField = page
    .getByRole("term")
    .filter({ hasText: /^Notificado$/u })
    .locator("..")
    .getByRole("definition");
  await expect(notifiedAtField).toHaveText(formatDateTime(notifiedAt));
  await page.getByRole("button", { name: "Copiar enlace de seguimiento", exact: true }).click();
  const copiedTrackingLink = await page.evaluate(() => navigator.clipboard.readText());
  const copiedCode = trackingCodesIn(copiedTrackingLink);
  expect(copiedCode.length === 1).toBe(true);
  const copiedTrackingResponse = copiedCode[0]
    ? await page.request.get(`${apiOrigin}/api/public/tracking/${copiedCode[0]}`)
    : null;
  expect(copiedTrackingResponse?.status() === 200).toBe(true);
  const copiedTrackingView = copiedTrackingResponse
    ? trackingViewSchema.safeParse(await copiedTrackingResponse.json())
    : null;
  expect(
    copiedTrackingView?.success === true &&
      copiedTrackingView.data.trackingNumber === first.trackingNumber,
  ).toBe(true);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test("offers copy-only for a merchant without WhatsApp and compacts 21 eligible shipments", async ({
  dispatcherPage: page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(viewport);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: publicOrigin,
  });

  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(page, `Sin WhatsApp T019 ${suffix}`, null);
  const shipments: ShipmentFixture[] = [];
  for (let index = 1; index <= 21; index++) {
    shipments.push(await createShipment(page, merchant, `Lote T019 ${String(index)} ${suffix}`));
  }
  const linkCode = await getMerchantLinkCode(page, merchant.id);

  await page.goto("/notificar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notificar clientes", exact: true }),
  ).toBeVisible();
  const card = merchantCard(page, merchant.name);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("21 envíos sin notificar");
  await expect(card.getByRole("button", { name: "Enviar por WhatsApp" })).toHaveCount(0);
  await expect(card.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  await expect(card.getByText(/agregar.*(?:número|WhatsApp)|configurar.*WhatsApp/iu)).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  const message = await copyMessage(page, card);
  expect(/\b21\b/u.test(message)).toBe(true);
  expect(message.includes("Lote T019")).toBe(false);
  expect(trackingCodesIn(message).length === 0).toBe(true);
  await expectRealMerchantLink(page, message, linkCode);
  await expect(card).toContainText("Notificado");
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(shipments.length === 21).toBe(true);
});

test("replays a committed notification with the same action after navigation and reload loses its acknowledgment", async ({
  dispatcherPage: page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(viewport);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: publicOrigin,
  });

  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(page, `Recuperación T019 ${suffix}`, "3015550125");
  await createShipment(page, merchant, `Destinatario recuperación T019 ${suffix}`);
  const actionIds: string[] = [];
  let committed = false;
  let firstResponseDropped = false;
  let allowRecovery = false;

  await page.route("**/api/notifications", async (route) => {
    const request = notificationRequestSchema.safeParse(route.request().postDataJSON());
    if (!request.success) {
      await route.continue();
      return;
    }
    actionIds.push(request.data.actionId);
    if (!firstResponseDropped) {
      const actualResponse = await route.fetch();
      committed = actualResponse.status() === 204;
      firstResponseDropped = true;
      await route.abort("failed");
      return;
    }
    if (!allowRecovery) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/notificar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notificar clientes", exact: true }),
  ).toBeVisible();
  const card = merchantCard(page, merchant.name);
  await expect(card).toHaveCount(1);
  expect(await accessibilityViolations(page)).toEqual([]);
  await card.getByRole("button", { name: "Copiar mensaje", exact: true }).click();
  await expect.poll(() => committed && firstResponseDropped).toBe(true);

  await page.goto("/clientes");
  await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  await page.goto("/notificar");
  const recoveryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications" &&
      response.status() === 204,
  );
  const reload = page.reload();
  allowRecovery = true;
  await reload;
  await recoveryResponse;
  await expect.poll(() => actionIds.length >= 2).toBe(true);
  const firstActionId = actionIds[0];
  if (!firstActionId) throw new Error("The notification action fixture was not captured");
  expect(actionIds.every((actionId) => actionId === firstActionId)).toBe(true);
  await expect(merchantCard(page, merchant.name)).toContainText("Notificado");
  expect(await accessibilityViolations(page)).toEqual([]);
});
