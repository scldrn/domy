import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { createDb } from "../../../server/src/db/client.ts";
import { register } from "./api";
import { dispatch, ownSession } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";

const supportPhone = "3015550123";
const privateName = "DESTINATARIO PRIVADO SEGUIMIENTO";
const privatePhone = "3191234567";
const privateAddress = "DIRECCION PRIVADA SEGUIMIENTO 99";
const fakeNow = "2026-10-01T15:00:00Z";

/** Reads only the generated link of a fixture in the disposable global-setup database. */
async function trackingPath(shipmentId: string): Promise<string> {
  const fixture = z
    .object({ databaseUrl: z.url() })
    .parse(JSON.parse(await readFile(new URL(".auth/database.json", import.meta.url), "utf8")));
  const db = createDb(fixture.databaseUrl);
  try {
    const rows = await db.$client`
      select tracking_code as code from shipments where id = ${shipmentId}::uuid
    `;
    const [row] = z.array(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{22}$/) })).parse(rows);
    if (!row) throw new Error("The tracking fixture shipment is missing");
    return `/seguimiento/${row.code}`;
  } finally {
    await db.$client.end();
  }
}

async function supportFixture(owner: Page) {
  const originalResponse = await owner.request.get("/api/settings");
  expect(originalResponse.ok()).toBe(true);
  const original = z
    .object({ supportPhone: z.string().nullable(), companyName: z.string() })
    .parse(await originalResponse.json());
  const update = async (supportPhone: string | null, companyName: string) => {
    const response = await owner.request.patch("/api/settings", {
      data: { actionId: crypto.randomUUID(), supportPhone, companyName },
    });
    expect(response.ok()).toBe(true);
  };
  await update(supportPhone, "Cohex");
  return () => update(original.supportPhone, original.companyName);
}

async function record(office: Page, shipmentId: string, kind: string, fields = {}) {
  const response = await office.request.post(`/api/shipments/${shipmentId}/records`, {
    data: { id: crypto.randomUUID(), kind, ...fields },
  });
  expect(response.ok()).toBe(true);
}

async function expectNoPrivateDetails(page: Page) {
  for (const value of [privateName, privatePhone, privateAddress]) {
    await expect(page.getByText(value, { exact: false })).toHaveCount(0);
  }
}

async function expectNoEarlierGuideNumbers(page: Page, trackingNumbers: string[]) {
  for (const trackingNumber of trackingNumbers)
    await expect(page.getByText(trackingNumber, { exact: true })).toHaveCount(0);
}

async function expectOnlySupportContact(page: Page) {
  const telephone = page.locator('a[href^="tel:"]');
  await expect(telephone).toHaveCount(1);
  await expect(telephone).toHaveAttribute("href", `tel:+57${supportPhone}`);
  const whatsapp = page.locator('a[href^="https://wa.me/"]');
  await expect(whatsapp).toHaveCount(1);
  await expect(whatsapp).toHaveAttribute("href", `https://wa.me/57${supportPhone}`);
  await expect(page.locator('a[href="tel:+573004445566"]')).toHaveCount(0);
  await expect(page.locator('a[href="https://wa.me/573004445566"]')).toHaveCount(0);
}

test("tracks registration, dispatch, pickup queue and a delivery refreshed within a minute", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
  courierPage: courier,
}) => {
  test.setTimeout(90_000);
  const restoreSupport = await supportFixture(owner);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const account = await ownSession(courier, owner);
    const first = await register(office, { recipientAddress: "Calle 20 # 40-01" });
    const second = await register(office, { recipientAddress: "Calle 21 # 40-01" });
    const target = await register(office, {
      recipientName: privateName,
      recipientPhone: privatePhone,
      recipientAddress: privateAddress,
      window: { preset: "before", end: "11:00" },
    });
    const path = await trackingPath(target.id);
    const visitor = await context.newPage();
    await visitor.goto(path);
    await expect(visitor.getByText("Recibimos tu envío", { exact: true })).toBeVisible();
    await expect(visitor.getByText("Bullish Hype", { exact: true })).toBeVisible();
    await expect(visitor.getByText(target.trackingNumber, { exact: true })).toBeVisible();
    await expect(visitor.getByText(/1 oct 2026/)).toBeVisible();
    await expect(visitor.getByText(/11:00 a\. m\./)).toBeVisible();
    await expectOnlySupportContact(visitor);
    await expectNoEarlierGuideNumbers(visitor, [first.trackingNumber, second.trackingNumber]);
    await expect(visitor.locator('a[href="tel:+573004445566"]')).toHaveCount(0);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    await dispatch(office, [first, second, target], account.courierId);
    await visitor.reload();
    await expect(visitor.getByText("Tu envío va a ser recogido", { exact: true })).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Mensajero: Mensajero" })).toBeVisible();
    await expect(visitor.locator('a[href="tel:+573004445566"]')).toBeVisible();
    await expect(visitor.locator('a[href^="https://wa.me/573004445566"]')).toBeVisible();
    await expectNoEarlierGuideNumbers(visitor, [first.trackingNumber, second.trackingNumber]);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    await record(office, target.id, "pickup");
    await visitor.reload();
    await expect(visitor.getByText("En camino", { exact: true })).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Mensajero: Mensajero" })).toBeVisible();
    await expect(visitor.getByText("2 entregas antes de la tuya", { exact: true })).toBeVisible();
    await expect(visitor.getByText("Valor a pagar al recibir", { exact: true })).toBeVisible();
    await expect(visitor.getByText("$ 85.000", { exact: true })).toBeVisible();
    await expectNoEarlierGuideNumbers(visitor, [first.trackingNumber, second.trackingNumber]);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    await visitor.bringToFront();
    const started = performance.now();
    await record(office, target.id, "delivery", {
      receivedByName: "María Recibe",
      cashAmount: target.codAmount,
    });
    await expect(visitor.getByText(/Entregado a María Recibe a las/)).toBeVisible({
      timeout: 60_000,
    });
    expect(performance.now() - started).toBeLessThanOrEqual(60_000);
    await expect(visitor.getByText(/1 oct 2026/).first()).toBeVisible();
    await expectOnlySupportContact(visitor);
    await expect(visitor.locator('a[href="tel:+573004445566"]')).toHaveCount(0);
    await expect(visitor.locator('a[href^="https://wa.me/573004445566"]')).toHaveCount(0);
    await expectNoEarlierGuideNumbers(visitor, [first.trackingNumber, second.trackingNumber]);
    await expect(visitor.getByText("Valor a pagar al recibir", { exact: true })).toHaveCount(0);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);
  } finally {
    try {
      await context.close();
    } finally {
      await restoreSupport();
    }
  }
});

test("shows a public exception reason and support without recipient or courier details", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
  courierPage: courier,
}) => {
  const restoreSupport = await supportFixture(owner);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const account = await ownSession(courier, owner);
    const target = await register(office, {
      recipientName: privateName,
      recipientPhone: privatePhone,
      recipientAddress: privateAddress,
    });
    await dispatch(office, target, account.courierId);
    await record(office, target.id, "pickup");
    await record(office, target.id, "exception", { reason: "recipient_absent" });
    const visitor = await context.newPage();
    await visitor.goto(await trackingPath(target.id));
    await expect(visitor.getByText("No pudimos entregar tu envío", { exact: true })).toBeVisible();
    await expect(visitor.getByText("No encontramos a nadie", { exact: true })).toBeVisible();
    await expect(visitor.locator(`a[href="tel:+57${supportPhone}"]`)).toBeVisible();
    await expectOnlySupportContact(visitor);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);
  } finally {
    try {
      await context.close();
    } finally {
      await restoreSupport();
    }
  }
});

test("an expired delivered link reveals only its expiry and support, then reactivates after a revert", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
  courierPage: courier,
}) => {
  test.setTimeout(80_000);
  const restoreSupport = await supportFixture(owner);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const account = await ownSession(courier, owner);
    const target = await register(office, {
      recipientName: privateName,
      recipientPhone: privatePhone,
      recipientAddress: privateAddress,
      window: { preset: "before", end: "11:00" },
    });
    await dispatch(office, target, account.courierId);
    await record(office, target.id, "pickup");
    await record(office, target.id, "delivery", {
      receivedByName: "María Recibe",
      cashAmount: target.codAmount,
    });
    expect(
      (await owner.request.post("/api/test/clock", { data: { now: "2026-10-09T15:00:00Z" } })).ok(),
    ).toBe(true);
    const visitor = await context.newPage();
    await visitor.goto(await trackingPath(target.id));
    await expect(visitor.getByText("Este enlace venció", { exact: true })).toBeVisible();
    await expect(visitor.locator(`a[href="tel:+57${supportPhone}"]`)).toBeVisible();
    for (const value of [
      "Bullish Hype",
      target.trackingNumber,
      privateName,
      privatePhone,
      privateAddress,
      "María Recibe",
      "$ 85.000",
      "$ 13.000",
      "Valor a pagar al recibir",
      "Entregado",
      "1 oct 2026",
      "11:00 a. m.",
    ])
      await expect(visitor.getByText(value, { exact: false })).toHaveCount(0);
    await expectOnlySupportContact(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    const detailResponse = await office.request.get(`/api/shipments/${target.id}`);
    expect(detailResponse.ok()).toBe(true);
    const detail = z
      .object({ records: z.array(z.object({ id: z.uuid(), kind: z.string() })) })
      .parse(await detailResponse.json());
    const delivery = detail.records.find((record) => record.kind === "delivery");
    if (!delivery) throw new Error("The delivered fixture has no delivery record");
    const revertResponse = await office.request.post(`/api/courier-records/${delivery.id}/revert`, {
      data: {
        actionId: crypto.randomUUID(),
        reason: "Se registró por equivocación",
      },
    });
    expect(revertResponse.ok()).toBe(true);

    const revertedAt = performance.now();
    await expect(
      visitor.getByText("Reprogramado para 1 de octubre de 2026", { exact: true }),
    ).toBeVisible({
      timeout: 60_000,
    });
    expect(performance.now() - revertedAt).toBeLessThanOrEqual(60_000);
    await expect(visitor.getByText("Este enlace venció", { exact: true })).toHaveCount(0);
    await expect(visitor.getByText(target.trackingNumber, { exact: true })).toBeVisible();
    await expect(visitor.locator(`a[href="tel:+57${supportPhone}"]`)).toBeVisible();
    await expect(visitor.locator('a[href="tel:+573004445566"]')).toHaveCount(0);
    await expectNoPrivateDetails(visitor);
    expect(await accessibilityViolations(visitor)).toEqual([]);
  } finally {
    try {
      expect((await owner.request.post("/api/test/clock", { data: { now: fakeNow } })).ok()).toBe(
        true,
      );
    } finally {
      try {
        await context.close();
      } finally {
        await restoreSupport();
      }
    }
  }
});

test("shows the registered status within three seconds on a cold weak mobile connection", async ({
  browser,
  dispatcherPage: office,
}) => {
  const target = await register(office);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const visitor = await context.newPage();
    const session = await context.newCDPSession(visitor);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 250,
      downloadThroughput: 1_500_000 / 8,
      uploadThroughput: 750_000 / 8,
    });
    const path = await trackingPath(target.id);
    const started = performance.now();
    await visitor.goto(path, { waitUntil: "commit" });
    await visitor.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h2")].find(
          (element) => element.textContent.trim() === "Recibimos tu envío",
        );
        return (
          heading instanceof HTMLElement &&
          heading.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          heading.getClientRects().length > 0
        );
      },
      undefined,
      { polling: "raf", timeout: 3000 },
    );
    const visibleElapsed = performance.now() - started;
    console.info(`cold-public-status-visible-ms=${visibleElapsed.toFixed(1)}`);
    await test.info().attach("cold-status-visible-ms.txt", {
      body: `${visibleElapsed.toFixed(1)} ms`,
      contentType: "text/plain",
    });
    await expect(visitor.getByText("Recibimos tu envío", { exact: true })).toBeVisible({
      timeout: 3000,
    });
    expect(visibleElapsed).toBeLessThanOrEqual(3000);
    expect(await accessibilityViolations(visitor)).toEqual([]);
  } finally {
    await context.close();
  }
});

test("shows an invalid link and then a real public rate-limit message", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const visitor = await context.newPage();
    await visitor.goto("/seguimiento/AAAAAAAAAAAAAAAAAAAAAA");
    await expect(visitor.getByText("Este enlace no es válido", { exact: true })).toBeVisible();
    expect(await accessibilityViolations(visitor)).toEqual([]);
    let limited = false;
    for (let attempt = 0; attempt < 61; attempt++) {
      const response = await context.request.get("/api/public/tracking/AAAAAAAAAAAAAAAAAAAAAA");
      if (response.status() === 429) {
        limited = true;
        break;
      }
      expect(response.status()).toBe(404);
    }
    expect(limited).toBe(true);
    await visitor.reload();
    await expect(visitor.getByText(/demasiadas solicitudes|Espera un minuto/)).toBeVisible();
    expect(await accessibilityViolations(visitor)).toEqual([]);
  } finally {
    await context.close();
  }
});
