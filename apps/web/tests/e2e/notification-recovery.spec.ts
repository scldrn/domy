import type { Page } from "@playwright/test";
import { z } from "zod";
import { accessibilityViolations, expect, test } from "./fixtures";
import { webPort } from "./ports";

const serviceDate = "2026-10-01";
const origin = `http://localhost:${String(webPort)}`;
const identifier = z.object({ id: z.uuid() });
const detailSchema = z.object({ notifiedAt: z.iso.datetime().nullable() });
const sessionSchema = z.object({ user: identifier });
const markSchema = z.object({ actionId: z.uuid(), shipmentIds: z.array(z.uuid()) });

async function fixture(page: Page) {
  const name = `Recuperación local ${crypto.randomUUID().slice(0, 8)}`;
  const merchantId = crypto.randomUUID();
  const merchant = await page.request.post("/api/merchants", {
    data: { id: merchantId, name, whatsappPhone: "3015550199" },
  });
  expect(merchant.status()).toBe(201);
  const neighborhoods = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(neighborhoods.status()).toBe(200);
  const catalog = z
    .object({ items: z.array(identifier.extend({ name: z.string() })) })
    .parse(await neighborhoods.json());
  const neighborhood = catalog.items.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("Missing Laureles fixture");
  const pickupPointId = crypto.randomUUID();
  const pickup = await page.request.post(`/api/merchants/${merchantId}/pickup-points`, {
    data: {
      id: pickupPointId,
      label: "Recuperación",
      address: "Calle 40 # 70-10",
      neighborhoodId: neighborhood.id,
      isDefault: true,
    },
  });
  expect(pickup.status()).toBe(201);
  const shipmentId = crypto.randomUUID();
  const shipment = await page.request.post("/api/shipments", {
    data: {
      id: shipmentId,
      kind: "delivery",
      serviceDate,
      merchantId,
      pickupPointId,
      recipientName: "Destinatario recuperación local",
      recipientPhone: "3109876543",
      recipientAddress: "Carrera 66 # 31-09",
      recipientNeighborhoodId: neighborhood.id,
      paymentMode: "merchant_account",
      codAmount: 0,
      fee: 13000,
    },
  });
  expect(shipment.status()).toBe(201);
  return { name, merchantId, shipmentId };
}

for (const failure of ["storage", "popup", "clipboard"] as const) {
  test(`does not mark or lose an action when ${failure} prevents sharing`, async ({
    dispatcherPage: page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const data = await fixture(page);
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/notifications")
        posts += 1;
    });
    await page.addInitScript((mode) => {
      if (mode === "storage") {
        const original: unknown = Object.getOwnPropertyDescriptor(
          Storage.prototype,
          "setItem",
        )?.value;
        if (typeof original !== "function") throw new Error("Storage method unavailable");
        Storage.prototype.setItem = function (key: string, value: string) {
          if (key.startsWith("domy:notification-intent:"))
            throw new DOMException("Storage denied by test", "QuotaExceededError");
          Reflect.apply(original, this, [key, value]);
        };
        Object.defineProperty(navigator.clipboard, "writeText", {
          configurable: true,
          value: () => {
            document.documentElement.dataset["notificationCopyAttempted"] = "true";
            return Promise.resolve();
          },
        });
      } else if (mode === "popup") {
        window.open = () => null;
      } else {
        Object.defineProperty(navigator.clipboard, "writeText", {
          configurable: true,
          value: () =>
            Promise.reject(new DOMException("Clipboard denied by test", "NotAllowedError")),
        });
      }
    }, failure);
    await page.goto("/notificar");
    await expect(
      page.getByRole("heading", { name: "Notificar clientes", exact: true }),
    ).toBeVisible();
    const card = page.getByRole("article").filter({ hasText: data.name });
    await expect(card).toContainText("1 envío sin notificar");
    await card
      .getByRole("button", {
        name: failure === "popup" ? "Enviar por WhatsApp" : "Copiar mensaje",
        exact: true,
      })
      .click();
    await expect(card.getByRole("alert")).toBeVisible();
    await expect(card.getByRole("button", { name: "Copiar mensaje", exact: true })).toBeEnabled();
    await expect(card).toContainText("1 envío sin notificar");
    const response = await page.request.get(`/api/shipments/${data.shipmentId}`);
    expect(response.status()).toBe(200);
    expect(detailSchema.parse(await response.json()).notifiedAt).toBeNull();
    expect(posts).toBe(0);
    if (failure === "storage")
      expect(
        await page.evaluate(
          () => document.documentElement.dataset["notificationCopyAttempted"] ?? "false",
        ),
      ).toBe("false");
    const intents = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("domy:notification-intent:")),
    );
    expect(intents).toEqual([]);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}

test("rediscovers a prepared action after reload without marking until the user shares again", async ({
  dispatcherPage: page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const data = await fixture(page);
  const session = await page.request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  const actorId = sessionSchema.parse(await session.json()).user.id;
  const preparedId = crypto.randomUUID();
  const preparedKey = `domy:notification-intent:${actorId}:${preparedId}`;
  const prepared = {
    actorId,
    actionId: preparedId,
    merchantId: data.merchantId,
    serviceDate,
    shipmentIds: [data.shipmentId],
    phase: "prepared",
  };
  const requests: z.infer<typeof markSchema>[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/notifications")
      requests.push(markSchema.parse(request.postDataJSON()));
  });
  await page.goto("/clientes");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: preparedKey,
      value: prepared,
    },
  );
  await page.goto("/notificar");
  await expect(
    page.getByRole("heading", { name: "Notificar clientes", exact: true }),
  ).toBeVisible();
  await page.reload();
  const card = page.getByRole("article").filter({ hasText: data.name });
  await expect(card).toContainText("1 envío sin notificar");
  await expect(card.getByRole("status")).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), preparedKey)).toBe(
    JSON.stringify(prepared),
  );
  expect(await accessibilityViolations(page)).toEqual([]);
  const acknowledgment = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/notifications" &&
      response.status() === 204,
  );
  await card.getByRole("button", { name: "Copiar mensaje", exact: true }).click();
  await acknowledgment;
  await expect(card).toContainText("Notificado");
  expect(requests).toHaveLength(1);
  expect(requests[0]?.actionId).not.toBe(preparedId);
  expect(requests[0]?.shipmentIds).toEqual([data.shipmentId]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith("domy:notification-intent:")),
      ),
    )
    .toEqual([]);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test("updates an already-open second tab after the first tab acknowledges a notification", async ({
  dispatcherPage: page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const data = await fixture(page);
  await page.goto("/notificar");
  const firstCard = page.getByRole("article").filter({ hasText: data.name });
  await expect(firstCard).toContainText("1 envío sin notificar");
  const secondPage = await page.context().newPage();
  try {
    await secondPage.goto("/notificar");
    const secondCard = secondPage.getByRole("article").filter({ hasText: data.name });
    await expect(secondCard).toContainText("1 envío sin notificar");
    await page.bringToFront();
    const acknowledgment = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/notifications" &&
        response.status() === 204,
    );
    await firstCard.getByRole("button", { name: "Copiar mensaje", exact: true }).click();
    await acknowledgment;
    await expect(firstCard).toContainText("Notificado");
    // No second-tab focus, reload, navigation or 30-second periodic refresh can heal this assertion.
    await expect(secondCard).toContainText("Notificado");
    await expect(
      secondCard.getByRole("button", { name: "Copiar mensaje", exact: true }),
    ).toBeDisabled();
    expect(await accessibilityViolations(secondPage)).toEqual([]);
  } finally {
    await secondPage.close();
  }
});
