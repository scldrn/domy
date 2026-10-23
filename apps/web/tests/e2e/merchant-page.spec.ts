import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { formatTrackingNumber } from "@domy/domain";
import { createDb } from "../../../server/src/db/client.ts";
import { deliver, openStop, ownSession, workerControls } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";
import { webPort } from "./ports";

const serviceDay = "2026-10-01";
const serviceDayInstant = "2026-10-01T15:00:00Z";
const photoUnavailableInstant = "2026-10-02T16:00:00Z";
const pickupAddress = "Calle 55 # 44-12 Torre Álamo";
const recipientAddress = "Carrera 66 # 31-09 Torre Níspero";
const deliveredAddress = "Carrera 67 # 31-10 Torre Níspero";
const courierPhone = "3004445566";
const supportPhone = "3015550123";
const supportNotice = "Para conocer más detalles, contacta con soporte.";
const viewport = { width: 320, height: 800 };
const publicOrigin = `http://localhost:${String(webPort)}`;

type MerchantFixture = { id: string; pickupPointId: string };
type CreatedShipment = { id: string; trackingNumber: string; codAmount: number };
type MerchantLink = { pagePath: string; apiPath: string };

const createdShipmentSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string().trim().min(1),
  codAmount: z.number().int().nonnegative(),
});

async function createMerchant(page: Page, label: string): Promise<MerchantFixture> {
  const id = crypto.randomUUID();
  const merchant = await page.request.post("/api/merchants", {
    data: { id, name: label },
  });
  expect(merchant.status()).toBe(201);

  const neighborhoodsResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(neighborhoodsResponse.ok()).toBe(true);
  const neighborhoods = z
    .object({ items: z.array(z.object({ id: z.uuid(), name: z.string() })) })
    .parse(await neighborhoodsResponse.json()).items;
  const neighborhood = neighborhoods.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("The e2e catalog lacks Laureles");

  const pickupPointId = crypto.randomUUID();
  const pickup = await page.request.post(`/api/merchants/${id}/pickup-points`, {
    data: {
      id: pickupPointId,
      label: "Punto privado T025",
      address: pickupAddress,
      neighborhoodId: neighborhood.id,
      isDefault: true,
    },
  });
  expect(pickup.status()).toBe(201);
  return { id, pickupPointId };
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

async function createShipment(
  page: Page,
  merchant: MerchantFixture,
  options: {
    recipientName: string;
    recipientPhone: string;
    recipientAddress?: string;
    codAmount?: number;
    serviceDate?: string;
    merchantReference?: string;
  },
): Promise<CreatedShipment> {
  const neighborhoodResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  expect(neighborhoodResponse.ok()).toBe(true);
  const neighborhoods = z
    .object({ items: z.array(z.object({ id: z.uuid(), name: z.string() })) })
    .parse(await neighborhoodResponse.json()).items;
  const neighborhood = neighborhoods.find((item) => item.name === "Laureles");
  if (!neighborhood) throw new Error("The e2e catalog lacks Laureles");

  const codAmount = options.codAmount ?? 0;
  const response = await page.request.post("/api/shipments", {
    data: {
      id: crypto.randomUUID(),
      kind: "delivery",
      serviceDate: options.serviceDate ?? serviceDay,
      merchantId: merchant.id,
      pickupPointId: merchant.pickupPointId,
      recipientName: options.recipientName,
      recipientPhone: options.recipientPhone,
      recipientAddress: options.recipientAddress ?? recipientAddress,
      recipientNeighborhoodId: neighborhood.id,
      paymentMode: codAmount > 0 ? "cash_on_delivery" : "merchant_account",
      codAmount,
      fee: 13000,
      ...(options.merchantReference ? { merchantReference: options.merchantReference } : {}),
    },
  });
  expect(response.status()).toBe(201);
  return createdShipmentSchema.parse(await response.json());
}

async function dispatchShipments(page: Page, shipments: CreatedShipment[], courierId: string) {
  const id = crypto.randomUUID();
  const response = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: serviceDay,
      shipmentIds: shipments.map((shipment) => shipment.id),
      courierId,
    },
  });
  expect(response.status()).toBe(201);
  const route = z
    .object({ id: z.uuid(), version: z.number().int().positive() })
    .parse(await response.json());
  const dispatched = await page.request.post(`/api/routes/${route.id}/dispatch`, {
    data: { actionId: crypto.randomUUID(), version: route.version },
  });
  expect(dispatched.status()).toBe(200);
}

/** Reads only the generated merchant bearer from the disposable, mode-0600 E2E database file. */
async function merchantLink(merchantId: string): Promise<MerchantLink> {
  const fixture = z
    .object({ databaseUrl: z.url() })
    .parse(JSON.parse(await readFile(new URL(".auth/database.json", import.meta.url), "utf8")));
  const db = createDb(fixture.databaseUrl);
  try {
    const rows = await db.$client`
      select link_code as code from merchants where id = ${merchantId}::uuid
    `;
    const [row] = z.array(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) })).parse(rows);
    if (!row) throw new Error("The merchant link fixture is missing");
    return {
      pagePath: `/cliente/${row.code}`,
      apiPath: `/api/public/merchant/${row.code}`,
    };
  } finally {
    await db.$client.end();
  }
}

const shipmentCard = (page: Page, shipment: CreatedShipment) =>
  page.getByRole("listitem").filter({ hasText: formatTrackingNumber(shipment.trackingNumber) });

const courierShipmentCard = (page: Page, shipment: CreatedShipment) =>
  page
    .getByRole("list", { name: "Envíos de la parada" })
    .getByRole("listitem")
    .filter({ hasText: formatTrackingNumber(shipment.trackingNumber) });

function includesAny(value: string, privateValues: readonly string[]): boolean {
  return privateValues.some((privateValue) => value.includes(privateValue));
}

function isExpectedClipboardLink(value: string, path: string): boolean {
  return value === `${publicOrigin}${path}`;
}

test("shows one merchant's daily work, proof, totals and support notices in exception details", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
  courierPage: courier,
}) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(office, `Cliente T025 ${suffix}`);
  const otherMerchant = await createMerchant(office, `Otro cliente T025 ${suffix}`);
  const delivered = await createShipment(office, merchant, {
    recipientName: `RECIBE PRIVADO T025 ${suffix}`,
    recipientPhone: "3109876543",
    recipientAddress: deliveredAddress,
    codAmount: 50000,
  });
  const exception = await createShipment(office, merchant, {
    recipientName: `PERSONA NOVEDAD T025 ${suffix}`,
    recipientPhone: "3123456789",
    codAmount: 30000,
    merchantReference: `REF-${suffix}`,
  });
  const foreign = await createShipment(office, otherMerchant, {
    recipientName: `OTRO COMERCIO T025 ${suffix}`,
    recipientPhone: "3137778899",
  });
  const account = await ownSession(courier, owner);
  await dispatchShipments(office, [delivered, exception], account.courierId);
  await courier.goto("/mensajero");
  await expect(courier.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(courier);

  await openStop(courier, deliveredAddress);
  const deliveredCard = courierShipmentCard(courier, delivered);
  await deliveredCard.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(deliveredCard).toContainText("Recogido");
  await deliver(courier, true);
  await expect(deliveredCard).toContainText("Entregado");

  await openStop(courier, recipientAddress);
  const exceptionCard = courierShipmentCard(courier, exception);
  await exceptionCard.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(exceptionCard).toContainText("Recogido");
  await exceptionCard.getByRole("button", { name: "Destinatario ausente" }).click();
  const exceptionDialog = courier.getByRole("dialog");
  await exceptionDialog.getByRole("button", { name: "Corregir" }).click();
  const privateNote =
    `Contactar +57 312 345 6789, 0057 (312) 345-6789 y https://wa.me/57${courierPhone}. ` +
    "Llegar a CALLE55#44-12 TORRE Álamo y entregar en CARRERA66 #31-09 TORRE Níspero.";
  await exceptionDialog.getByLabel("Nota (opcional)").fill(privateNote);
  await exceptionDialog.getByRole("button", { name: "Revisar" }).click();
  await exceptionDialog.getByRole("button", { name: "Guardar novedad" }).click();
  await expect(exceptionDialog).not.toBeVisible();

  const link = await merchantLink(merchant.id);
  const restoreSupport = await supportFixture(owner);
  const context = await browser.newContext({
    baseURL: publicOrigin,
    viewport,
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  try {
    const visitor = await context.newPage();
    await visitor.clock.install({ time: new Date(serviceDayInstant) });
    await visitor.goto(link.pagePath);
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Envíos del cliente" }),
    ).toBeVisible();
    await expect(visitor.getByText(`Cliente T025 ${suffix}`, { exact: true })).toBeVisible();
    await expect(
      visitor.getByText(formatTrackingNumber(delivered.trackingNumber), { exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByText(formatTrackingNumber(exception.trackingNumber), { exact: true }),
    ).toBeVisible();
    await expect(visitor.getByText(`RECIBE PRIVADO T025 ${suffix}`, { exact: true })).toBeVisible();
    await expect(
      visitor.getByText(`PERSONA NOVEDAD T025 ${suffix}`, { exact: true }),
    ).toBeVisible();
    await expect(visitor.getByText(`OTRO COMERCIO T025 ${suffix}`, { exact: true })).toHaveCount(0);
    const dailyTotals = visitor.getByRole("region", { name: "Totales del día" });
    await expect(dailyTotals.getByText("Entregado", { exact: true })).toBeVisible();
    await expect(dailyTotals.getByText("Novedad", { exact: true })).toBeVisible();
    await expect(
      shipmentCard(visitor, delivered).getByText("Entregado", { exact: true }),
    ).toBeVisible();
    await expect(
      shipmentCard(visitor, exception).getByText("Novedad", { exact: true }),
    ).toBeVisible();
    await expect(dailyTotals.getByText("$ 26.000", { exact: true })).toBeVisible();
    await expect(dailyTotals.getByText("$ 30.000", { exact: true })).toBeVisible();
    await expect(dailyTotals.getByText("Efectivo: $ 50.000", { exact: true })).toBeVisible();
    expect(await accessibilityViolations(visitor)).toEqual([]);

    await shipmentCard(visitor, delivered).click();
    await expect(
      visitor
        .getByRole("term")
        .filter({ hasText: /^Recibido por$/u })
        .locator("..")
        .getByRole("definition"),
    ).toHaveText(`RECIBE PRIVADO T025 ${suffix}`);
    const proof = visitor.getByRole("img", { name: "Prueba de entrega" });
    await expect(proof).toBeVisible();
    await expect
      .poll(() =>
        proof.evaluate((element) =>
          element instanceof HTMLImageElement ? element.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    await visitor.reload();
    await shipmentCard(visitor, exception).click();
    const visibleSupportNotices = visitor.getByText(supportNotice, { exact: true });
    await expect.poll(() => visibleSupportNotices.count()).toBeGreaterThan(0);
    for (const notice of await visibleSupportNotices.all()) await expect(notice).toBeVisible();
    await expect(visitor.locator(`a[href="tel:+57${supportPhone}"]`)).toBeVisible();
    await expect(visitor.locator(`a[href="https://wa.me/57${supportPhone}"]`)).toBeVisible();
    await expect(visitor.locator('a[href^="tel:"]')).toHaveCount(1);
    await expect(visitor.locator('a[href^="https://wa.me/"]')).toHaveCount(1);
    await expect(visitor.locator('a[href="tel:+573004445566"]')).toHaveCount(0);
    await expect(visitor.locator('a[href="https://wa.me/573004445566"]')).toHaveCount(0);
    for (const value of [
      privateNote,
      "3123456789",
      "573004445566",
      "00573123456789",
      pickupAddress,
      recipientAddress,
      deliveredAddress,
      "CALLE55#44-12",
      "CARRERA66 #31-09",
    ]) {
      await expect(visitor.getByText(value, { exact: false })).toHaveCount(0);
    }
    expect(await accessibilityViolations(visitor)).toEqual([]);

    const detailResponse = await visitor.request.get(`${link.apiPath}/shipments/${exception.id}`);
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.text();
    const detail = z
      .object({
        exception: z.object({
          note: z.literal(supportNotice),
          attempts: z.array(z.object({ note: z.literal(supportNotice) })).min(1),
        }),
      })
      .parse(JSON.parse(detailBody) as unknown);
    expect(detail.exception.attempts).toHaveLength(1);
    expect(detail.exception.attempts[0]?.note).toBe(supportNotice);
    expect(
      includesAny(detailBody, [
        privateNote,
        "3123456789",
        "573004445566",
        "00573123456789",
        pickupAddress,
        recipientAddress,
        deliveredAddress,
        "CALLE55#44-12",
        "CARRERA66 #31-09",
        '"recipientPhone"',
        '"recipientAddress"',
        '"courierId"',
        '"authorUserId"',
        '"storageKey"',
      ]),
    ).toBe(false);
    const dayResponse = await visitor.request.get(link.apiPath);
    expect(dayResponse.status()).toBe(200);
    const dayBody = await dayResponse.text();
    expect(
      includesAny(dayBody, [
        foreign.trackingNumber,
        `OTRO COMERCIO T025 ${suffix}`,
        '"trackingCode"',
        '"recipientPhone"',
        '"recipientAddress"',
        '"storageKey"',
      ]),
    ).toBe(false);
  } finally {
    try {
      await context.close();
    } finally {
      await restoreSupport();
    }
  }
});

test("keeps the Bogotá date window and turns an unuploaded proof unavailable after 24 hours", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
  courierPage: courier,
  setServerNow,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(office, `Fechas T025 ${suffix}`);
  const current = await createShipment(office, merchant, {
    recipientName: `FOTO PENDIENTE T025 ${suffix}`,
    recipientPhone: "3112223344",
    codAmount: 0,
  });
  const yesterday = await createShipment(office, merchant, {
    recipientName: `AYER T025 ${suffix}`,
    recipientPhone: "3112223345",
    serviceDate: "2026-09-30",
  });
  const account = await ownSession(courier, owner);
  await dispatchShipments(office, [current], account.courierId);
  await courier.goto("/mensajero");
  await expect(courier.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(courier);
  await openStop(courier, recipientAddress);
  await courierShipmentCard(courier, current)
    .getByRole("button", { name: "Confirmar recogida" })
    .click();
  await expect(courierShipmentCard(courier, current)).toContainText("Recogido");

  const photoId = crypto.randomUUID();
  const recordId = crypto.randomUUID();
  const deliveryResponse = await courier.request.post("/api/courier/records", {
    data: {
      deviceNow: serviceDayInstant,
      records: [
        {
          id: recordId,
          shipmentId: current.id,
          kind: "delivery",
          occurredAt: serviceDayInstant,
          receivedByName: `RECIBE FOTO T025 ${suffix}`,
          photos: [{ id: photoId, kind: "proof" }],
        },
      ],
    },
  });
  expect(deliveryResponse.status()).toBe(200);

  const link = await merchantLink(merchant.id);
  const context = await browser.newContext({
    baseURL: publicOrigin,
    viewport,
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  try {
    const visitor = await context.newPage();
    await visitor.clock.install({ time: new Date(serviceDayInstant) });
    await visitor.goto(link.pagePath);
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Envíos del cliente" }),
    ).toBeVisible();
    await expect(
      visitor.getByText(formatTrackingNumber(current.trackingNumber), { exact: true }),
    ).toBeVisible();
    await expect(visitor.getByText(`AYER T025 ${suffix}`, { exact: true })).toHaveCount(0);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    const dateInput = visitor.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveAttribute("min", "2026-09-02");
    await expect(dateInput).toHaveAttribute("max", serviceDay);
    await dateInput.fill("2026-09-30");
    await expect(
      visitor.getByText(formatTrackingNumber(yesterday.trackingNumber), { exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByText(formatTrackingNumber(current.trackingNumber), { exact: true }),
    ).toHaveCount(0);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    const invalidDateResponse = await visitor.request.get(
      `${link.apiPath}?${new URLSearchParams({ date: "2026-09-01" }).toString()}`,
    );
    const oldestIncludedResponse = await visitor.request.get(
      `${link.apiPath}?${new URLSearchParams({ date: "2026-09-02" }).toString()}`,
    );
    expect(oldestIncludedResponse.status()).toBe(200);
    expect(invalidDateResponse.status()).toBe(422);

    await dateInput.fill(serviceDay);
    await shipmentCard(visitor, current).click();
    await expect(visitor.getByText("Foto pendiente", { exact: true })).toBeVisible();
    const pendingResponse = await visitor.request.get(`${link.apiPath}/shipments/${current.id}`);
    expect(pendingResponse.status()).toBe(200);
    const pendingDetail = z
      .object({
        photos: z.array(
          z.object({ id: z.uuid(), status: z.enum(["pending", "uploaded", "unavailable"]) }),
        ),
      })
      .parse(await pendingResponse.json());
    expect(
      pendingDetail.photos.some((photo) => photo.id === photoId && photo.status === "pending"),
    ).toBe(true);
    expect(await accessibilityViolations(visitor)).toEqual([]);

    try {
      await setServerNow(photoUnavailableInstant);
      await visitor.reload();
      await visitor.locator('input[type="date"]').fill(serviceDay);
      await shipmentCard(visitor, current).click();
      await expect(visitor.getByText(/no disponible/i)).toBeVisible();
      await expect(visitor.getByRole("img", { name: "Prueba de entrega" })).toHaveCount(0);
      const unavailableResponse = await visitor.request.get(
        `${link.apiPath}/shipments/${current.id}`,
      );
      expect(unavailableResponse.status()).toBe(200);
      const unavailableDetail = z
        .object({
          photos: z.array(
            z.object({ id: z.uuid(), status: z.enum(["pending", "uploaded", "unavailable"]) }),
          ),
        })
        .parse(await unavailableResponse.json());
      expect(
        unavailableDetail.photos.some(
          (photo) => photo.id === photoId && photo.status === "unavailable",
        ),
      ).toBe(true);
      expect(await accessibilityViolations(visitor)).toEqual([]);
    } finally {
      await setServerNow(serviceDayInstant);
    }
  } finally {
    await context.close();
  }
});

test("copies, cancels and replaces only the selected merchant link", async ({
  browser,
  ownerPage: owner,
  dispatcherPage: office,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const merchant = await createMerchant(office, `Rotación T025 ${suffix}`);
  const otherMerchant = await createMerchant(office, `Conservado T025 ${suffix}`);
  const originalLink = await merchantLink(merchant.id);
  const otherLink = await merchantLink(otherMerchant.id);

  const context = await browser.newContext({
    baseURL: publicOrigin,
    viewport,
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  try {
    const oldVisitor = await context.newPage();
    const otherVisitor = await context.newPage();
    await oldVisitor.goto(originalLink.pagePath);
    await otherVisitor.goto(otherLink.pagePath);
    await expect(oldVisitor.getByText(`Rotación T025 ${suffix}`, { exact: true })).toBeVisible();
    await expect(
      otherVisitor.getByText(`Conservado T025 ${suffix}`, { exact: true }),
    ).toBeVisible();
    expect(await accessibilityViolations(oldVisitor)).toEqual([]);
    expect(await accessibilityViolations(otherVisitor)).toEqual([]);

    await owner.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: publicOrigin,
    });
    await owner.goto(`/clientes/${merchant.id}`);
    await expect(owner.getByRole("heading", { name: `Rotación T025 ${suffix}` })).toBeVisible();
    await owner.getByRole("button", { name: "Copiar enlace del cliente" }).click();
    const copiedOriginal = await owner.evaluate(() => navigator.clipboard.readText());
    expect(isExpectedClipboardLink(copiedOriginal, originalLink.pagePath)).toBe(true);

    await owner.getByRole("button", { name: "Reemplazar enlace" }).click();
    const cancelDialog = owner.getByRole("alertdialog");
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole("button", { name: "Volver" }).click();
    await expect(cancelDialog).not.toBeVisible();
    const unchangedLink = await merchantLink(merchant.id);
    expect(unchangedLink.pagePath === originalLink.pagePath).toBe(true);
    await oldVisitor.reload();
    await expect(oldVisitor.getByText(`Rotación T025 ${suffix}`, { exact: true })).toBeVisible();
    await otherVisitor.reload();
    await expect(
      otherVisitor.getByText(`Conservado T025 ${suffix}`, { exact: true }),
    ).toBeVisible();

    await owner.getByRole("button", { name: "Reemplazar enlace" }).click();
    const confirmDialog = owner.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    const rotationResponse = owner.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "POST" &&
        url.pathname === `/api/merchants/${merchant.id}/replace-link`
      );
    });
    await confirmDialog.getByRole("button", { name: "Reemplazar enlace" }).click();
    expect((await rotationResponse).status()).toBe(200);

    const replacementLink = await merchantLink(merchant.id);
    expect(replacementLink.pagePath !== originalLink.pagePath).toBe(true);
    await owner.getByRole("button", { name: "Copiar enlace del cliente" }).click();
    const copiedReplacement = await owner.evaluate(() => navigator.clipboard.readText());
    expect(isExpectedClipboardLink(copiedReplacement, replacementLink.pagePath)).toBe(true);

    await oldVisitor.reload();
    await expect(oldVisitor.getByText("Este enlace no es válido", { exact: true })).toBeVisible();
    const replacementVisitor = await context.newPage();
    await replacementVisitor.goto(replacementLink.pagePath);
    await expect(
      replacementVisitor.getByRole("heading", { level: 1, name: "Envíos del cliente" }),
    ).toBeVisible();
    await expect(
      replacementVisitor.getByText(`Rotación T025 ${suffix}`, { exact: true }),
    ).toBeVisible();
    await otherVisitor.reload();
    await expect(
      otherVisitor.getByText(`Conservado T025 ${suffix}`, { exact: true }),
    ).toBeVisible();
    expect(await accessibilityViolations(oldVisitor)).toEqual([]);
    expect(await accessibilityViolations(replacementVisitor)).toEqual([]);
    expect(await accessibilityViolations(otherVisitor)).toEqual([]);
  } finally {
    await context.close();
  }
});
