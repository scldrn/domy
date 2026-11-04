import { bulkColumns, bulkConfirmInput, shipmentCreateInput } from "@domy/domain";
import { randomInt, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { emptyShipmentForm } from "../../src/features/shipments/form-values";
import { expect, test } from "./fixtures";

const shipmentDraftKey = "domy:draft:shipment";
const draftId = "a75b7a0a-1e5f-4b20-a76a-453d50d402b4";

function line(values: Partial<Record<(typeof bulkColumns)[number], string>>): string {
  return bulkColumns.map((column) => values[column] ?? "").join("\t");
}

async function chooseMerchant(page: Page, name: string) {
  const field = page.getByRole("combobox", { name: "Cliente" });
  await field.click();
  await field.fill(name.slice(0, 4));
  await page
    .getByRole("option", { name: new RegExp(name) })
    .first()
    .click();
}

async function exactDuplicateTrackingNumbers(
  page: Page,
  query: { merchantId: string; serviceDate: string; merchantReference: string },
): Promise<string[]> {
  const response: unknown = await page.evaluate(async (input) => {
    const params = new URLSearchParams(input);
    const result = await fetch(`/api/shipments/duplicates?${params.toString()}`);
    const body: unknown = await result.json();
    return body;
  }, query);
  return z.object({ trackingNumbers: z.array(z.string()) }).parse(response).trackingNumbers;
}

async function findMerchant(page: Page, query: string) {
  const response: unknown = await page.evaluate(async (name) => {
    const result = await fetch(`/api/merchants?q=${encodeURIComponent(name)}&active=true`);
    const body: unknown = await result.json();
    return body;
  }, query);
  const parsed = z
    .object({
      items: z.array(z.object({ id: z.uuid(), name: z.string(), aliases: z.array(z.string()) })),
    })
    .parse(response);
  const merchant = parsed.items[0];
  if (!merchant) throw new Error("Expected a seeded merchant for the legacy draft test");
  return merchant;
}

test("keeps a valid-JSON draft with the wrong shape for explicit recovery", async ({
  dispatcherPage: page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`.slice(0, 160)));
  await page.goto("/envios/nuevo");
  await expect(page.getByRole("heading", { name: "Nuevo envío" })).toBeVisible();
  const raw = JSON.stringify({ id: draftId, values: {} });
  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    {
      key: shipmentDraftKey,
      value: raw,
    },
  );

  await page.reload();

  expect(pageErrors).toEqual([]);
  await expect(page.getByRole("alert")).toContainText(/borrador guardado/i);
  await expect(page.getByRole("button", { name: "Descargar copia local" })).toBeVisible();
  const download = page.waitForEvent("download");
  const discard = page.getByRole("button", { name: "Descartar borrador" });
  await expect(discard).toBeDisabled();
  await page.getByRole("button", { name: "Descargar copia local" }).click();
  await download;
  await expect(discard).toBeEnabled();
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), shipmentDraftKey))
    .toBe(raw);
});

test("does not replay a bulk request for a different merchant than the visible draft", async ({
  dispatcherPage: page,
}) => {
  let confirmationRequests = 0;
  await page.route("**/api/bulk/confirm", async (route) => {
    confirmationRequests += 1;
    await route.abort();
  });
  const visibleMerchantId = randomUUID();
  const pendingMerchantId = randomUUID();
  const row = shipmentCreateInput.parse({
    id: randomUUID(),
    merchantId: pendingMerchantId,
    pickupPointId: randomUUID(),
    kind: "errand",
    errandDescription: "Recoger un documento",
    serviceDate: "2026-10-20",
    serviceLevel: "standard",
    fee: 85000,
    paymentMode: "merchant_account",
    confirmed: true,
  });
  const pending = bulkConfirmInput.parse({
    batchId: randomUUID(),
    merchantId: pendingMerchantId,
    rows: [row],
  });
  const values = {
    form: {
      merchant: { id: visibleMerchantId, name: "Cliente visible", aliases: [] },
      pickupPointId: null,
      text: "Borrador visible",
    },
    pending: { input: pending, remainingText: "" },
    needsIntentAcknowledgement: false,
  };
  const raw = JSON.stringify({ id: randomUUID(), values });

  await page.goto("/envios/masivo");
  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    { key: "domy:draft:bulk", value: raw },
  );
  await page.reload();

  await expect(page.getByRole("alert")).toContainText(/formato válido/i);
  await expect(page.getByRole("button", { name: "Descargar copia local" })).toBeVisible();
  expect(confirmationRequests).toBe(0);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("domy:draft:bulk"))).toBe(raw);
});

test("does not overwrite malformed draft data during mount or recovery", async ({
  dispatcherPage: page,
}) => {
  await page.goto("/envios/nuevo");
  await expect(page.getByRole("heading", { name: "Nuevo envío" })).toBeVisible();
  const raw = "{malformed-draft";
  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    {
      key: shipmentDraftKey,
      value: raw,
    },
  );

  await page.reload();

  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), shipmentDraftKey))
    .toBe(raw);
  await expect(page.getByRole("button", { name: "Descargar copia local" })).toBeVisible();
});

test("keeps valid legacy shipment values until informed recovery starts a new intent", async ({
  dispatcherPage: page,
}) => {
  await page.goto("/envios/nuevo");
  const merchant = await findMerchant(page, "Amy Tecnology");
  const id = randomUUID();
  const values = {
    ...emptyShipmentForm("2026-10-20"),
    merchant,
    recipientName: "Borrador anterior",
    recipientPhone: "3001234567",
    recipientAddress: "Calle 10 # 43-12",
    merchantReference: `T137-legado-${String(randomInt(1_000_000, 10_000_000))}`,
  };
  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    {
      key: shipmentDraftKey,
      value: JSON.stringify({ id, values }),
    },
  );

  await page.reload();

  await expect(page.getByRole("alert")).toContainText(/versión anterior/i);
  await expect(page.getByRole("button", { name: "Preparar un intento nuevo" })).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia local" }).click();
  await download;
  await page.getByLabel("Ya descargué la copia y revisé el historial de envíos.").check();
  await page.getByRole("button", { name: "Preparar un intento nuevo" }).click();

  await expect(page.getByLabel("Nombre del destinatario")).toHaveValue("Borrador anterior");
  const savedRaw = await page.evaluate((key) => sessionStorage.getItem(key), shipmentDraftKey);
  const saved: unknown = JSON.parse(savedRaw ?? "null");
  const modern = z
    .object({
      id: z.uuid(),
      values: z.object({
        form: z.object({ recipientName: z.string(), merchantReference: z.string() }),
        pending: z.null(),
        needsIntentAcknowledgement: z.literal(false),
      }),
    })
    .parse(saved);
  expect(modern.id).not.toBe(id);
  expect(modern.values.form).toEqual({
    recipientName: "Borrador anterior",
    merchantReference: values.merchantReference,
  });
});

test("keeps valid legacy bulk rows behind informed recovery", async ({ dispatcherPage: page }) => {
  await page.goto("/envios/masivo");
  const merchant = await findMerchant(page, "Amy Tecnology");
  const id = randomUUID();
  const raw = line({
    Destinatario: "Borrador anterior",
    Teléfono: "3001234567",
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Referencia: `T137-legado-${String(randomInt(1_000_000, 10_000_000))}`,
  });
  const key = "domy:draft:bulk";
  await page.evaluate(
    ({ storageKey, value }) => {
      sessionStorage.setItem(storageKey, value);
    },
    {
      storageKey: key,
      value: JSON.stringify({ id, values: { merchant, pickupPointId: null, text: raw } }),
    },
  );

  await page.reload();

  await expect(page.getByRole("alert")).toContainText(/lote viene de una versión anterior/i);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia local" }).click();
  await download;
  await page.getByLabel("Ya descargué la copia y revisé el historial de envíos.").check();
  await page.getByRole("button", { name: "Preparar un intento nuevo" }).click();

  await expect(page.getByLabel("Filas", { exact: true })).toHaveValue(raw);
  const savedRaw = await page.evaluate((storageKey) => sessionStorage.getItem(storageKey), key);
  const saved: unknown = JSON.parse(savedRaw ?? "null");
  const modern = z
    .object({
      id: z.uuid(),
      values: z.object({
        form: z.object({ text: z.string() }),
        pending: z.null(),
        needsIntentAcknowledgement: z.literal(false),
      }),
    })
    .parse(saved);
  expect(modern.id).not.toBe(id);
  expect(modern.values.form.text).toBe(raw);
});

test("freezes the exact shipment mutation after its committed response is lost", async ({
  dispatcherPage: page,
}) => {
  const run = String(randomInt(1_000_000, 10_000_000));
  const firstReference = `T137-replay-${run}`;
  const changedReference = `T137-changed-${run}`;
  const requests: unknown[] = [];
  const statuses: number[] = [];
  const committedIds: string[] = [];
  await page.route("**/api/shipments", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    if (requests.length === 1) {
      const ack = z.object({ id: z.uuid() }).safeParse(body);
      if ((response.status() !== 200 && response.status() !== 201) || !ack.success) {
        await route.fulfill({ response, json: body });
        return;
      }
      committedIds.push(ack.data.id);
      await route.abort();
      return;
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/nuevo");
  await chooseMerchant(page, "Bullish Hype");
  await page.getByLabel("Nombre del destinatario").fill("T137 recuperación");
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByLabel("Dirección de entrega").fill("Calle 10 # 43-12");
  const neighborhood = page.getByRole("combobox", { name: "Barrio" });
  await neighborhood.click();
  await neighborhood.fill("Laureles");
  await page
    .getByRole("option", { name: /Laureles/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await page.getByLabel("Referencia del cliente").fill(firstReference);
  await page.getByRole("button", { name: "Registrar envío" }).click();
  await expect(page.getByRole("alert")).toContainText(/no hay conexión/i);
  await page.reload();

  await expect(
    page.getByRole("status").filter({ hasText: /exactamente la misma solicitud/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Referencia del cliente")).toHaveValue(firstReference);
  await expect(page.getByLabel("Referencia del cliente")).toBeDisabled();
  await page.getByRole("button", { name: "Reintentar solicitud pendiente" }).click();
  await expect(page.getByText(/registrado/)).toBeVisible();

  const first = shipmentCreateInput.safeParse(requests[0]);
  const second = shipmentCreateInput.safeParse(requests[1]);
  if (!first.success || !second.success) throw new Error("Captured shipment input was invalid");
  const serviceDate = first.data.serviceDate;
  if (!serviceDate) throw new Error("Captured shipment input did not include a service date");
  const firstItems = await exactDuplicateTrackingNumbers(page, {
    merchantId: first.data.merchantId,
    serviceDate,
    merchantReference: firstReference,
  });
  const changedItems = await exactDuplicateTrackingNumbers(page, {
    merchantId: first.data.merchantId,
    serviceDate,
    merchantReference: changedReference,
  });

  const observation = {
    statuses,
    acknowledgedIdMatchesIntent: first.data.id === committedIds[0],
    sameId: first.data.id === second.data.id,
    samePayload: JSON.stringify(first.data) === JSON.stringify(second.data),
    firstReferenceCount: firstItems.length,
    changedReferenceCount: changedItems.length,
  };
  expect(observation).toEqual({
    statuses: [201, 200],
    acknowledgedIdMatchesIntent: true,
    sameId: true,
    samePayload: true,
    firstReferenceCount: 1,
    changedReferenceCount: 0,
  });
});

test("retries the exact bulk payload after its committed response is lost", async ({
  dispatcherPage: page,
}) => {
  const run = String(randomInt(1_000_000, 10_000_000));
  const raw = line({
    Destinatario: `T137 ${run}`,
    Teléfono: `300${run}`,
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Referencia: `T137-${run}`,
  });
  const requests: unknown[] = [];
  const statuses: number[] = [];
  const responseBodies: unknown[] = [];
  await page.route("**/api/bulk/confirm", async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    responseBodies.push(body);
    if (requests.length === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page.getByLabel("Filas", { exact: true }).fill(raw);
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("1 lista · 0 por confirmar · 0 con errores")).toBeVisible();
  await page.getByRole("button", { name: "Crear 1 envío" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("status")).toContainText(/mismo lote y las mismas filas/i);
  const pendingRetry = page.getByRole("button", { name: "Reintentar creación pendiente" });
  await expect(pendingRetry).toBeVisible();
  await pendingRetry.click();
  await expect(page.getByText("1 envío creado")).toBeVisible();

  const requestSchema = bulkConfirmInput;
  const resultSchema = z.strictObject({
    batchId: z.uuid(),
    created: z.array(
      z.strictObject({ row: z.number().int(), id: z.uuid(), trackingNumber: z.string() }),
    ),
  });
  const firstRequest = requestSchema.safeParse(requests[0]);
  const secondRequest = requestSchema.safeParse(requests[1]);
  const firstResponse = resultSchema.safeParse(responseBodies[0]);
  const secondResponse = resultSchema.safeParse(responseBodies[1]);
  expect(firstRequest.success && secondRequest.success).toBe(true);
  expect(firstResponse.success && secondResponse.success).toBe(true);
  if (!firstRequest.success || !secondRequest.success) throw new Error("Invalid captured request");
  if (!firstResponse.success || !secondResponse.success)
    throw new Error("Invalid captured confirmation response");

  const searchResult: unknown = await page.evaluate(async (reference) => {
    const response = await fetch(`/api/shipments/search?q=${encodeURIComponent(reference)}`);
    const body: unknown = await response.json();
    return body;
  }, `T137-${run}`);
  const searched = z.object({ items: z.array(z.unknown()) }).parse(searchResult);
  expect({
    requestCount: requests.length,
    samePayload: JSON.stringify(firstRequest.data) === JSON.stringify(secondRequest.data),
    sameBatch: firstResponse.data.batchId === secondResponse.data.batchId,
    sameRows:
      JSON.stringify(firstResponse.data.created.map((item) => item.id)) ===
      JSON.stringify(secondResponse.data.created.map((item) => item.id)),
    statuses,
    matchingRows: searched.items.length,
  }).toEqual({
    requestCount: 2,
    samePayload: true,
    sameBatch: true,
    sameRows: true,
    statuses: [201, 200],
    matchingRows: 1,
  });
});

test("restores only unconfirmed bulk rows after an uncertain partial confirmation", async ({
  dispatcherPage: page,
}) => {
  const run = String(randomInt(1_000_000, 10_000_000));
  const createdReference = `T137-partial-${run}`;
  const remainingReference = `T137-remaining-${run}`;
  const createdRow = line({
    Destinatario: `T137 ${run}`,
    Teléfono: `300${run}`,
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Referencia: createdReference,
  });
  const remainingRow = line({
    Destinatario: "Referencia pendiente sin coincidencias de búsqueda",
    Teléfono: "300",
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Referencia: remainingReference,
  });
  const requests: unknown[] = [];
  const statuses: number[] = [];
  const responseBodies: unknown[] = [];
  await page.route("**/api/bulk/confirm", async (route) => {
    requests.push(route.request().postDataJSON());
    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    responseBodies.push(body);
    if (requests.length === 1) {
      await route.abort();
      return;
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/masivo");
  await chooseMerchant(page, "Amy Tecnology");
  await page.getByLabel("Filas", { exact: true }).fill([createdRow, remainingRow].join("\n"));
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("1 lista · 0 por confirmar · 1 con errores")).toBeVisible();
  await page.getByRole("button", { name: "Crear 1 envío" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Reintentar creación pendiente" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar creación pendiente" }).click();

  await expect(page.getByLabel("Filas", { exact: true })).toHaveValue(remainingRow);
  await expect(page.getByText("0 listas · 0 por confirmar · 1 con errores")).toBeVisible();
  const first = bulkConfirmInput.safeParse(requests[0]);
  const second = bulkConfirmInput.safeParse(requests[1]);
  const firstAck = z
    .object({
      batchId: z.uuid(),
      created: z.array(z.object({ id: z.uuid(), trackingNumber: z.string() })),
    })
    .safeParse(responseBodies[0]);
  const secondAck = z
    .object({
      batchId: z.uuid(),
      created: z.array(z.object({ id: z.uuid(), trackingNumber: z.string() })),
    })
    .safeParse(responseBodies[1]);
  expect(first.success && second.success && firstAck.success && secondAck.success).toBe(true);
  if (!first.success || !second.success || !firstAck.success || !secondAck.success)
    throw new Error("Invalid captured bulk retry evidence");

  const createdResponse: unknown = await page.evaluate(async (trackingNumber) => {
    const response = await fetch(
      `/api/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`,
    );
    const body: unknown = await response.json();
    return body;
  }, firstAck.data.created[0]?.trackingNumber ?? "");
  const createdShipment = z
    .object({
      id: z.uuid(),
      serviceDate: z.iso.date(),
      merchant: z.object({ id: z.uuid() }),
    })
    .parse(createdResponse);
  const exactReferences: unknown = await page.evaluate(
    async ({ merchantId, serviceDate, reference }) => {
      const query = new URLSearchParams({ merchantId, serviceDate, merchantReference: reference });
      const response = await fetch(`/api/shipments/duplicates?${query.toString()}`);
      const body: unknown = await response.json();
      return body;
    },
    {
      merchantId: createdShipment.merchant.id,
      serviceDate: createdShipment.serviceDate,
      reference: createdReference,
    },
  );
  const remainingExactReferences: unknown = await page.evaluate(
    async ({ merchantId, serviceDate, reference }) => {
      const query = new URLSearchParams({ merchantId, serviceDate, merchantReference: reference });
      const response = await fetch(`/api/shipments/duplicates?${query.toString()}`);
      const body: unknown = await response.json();
      return body;
    },
    {
      merchantId: createdShipment.merchant.id,
      serviceDate: createdShipment.serviceDate,
      reference: remainingReference,
    },
  );
  const createdItems = z.object({ trackingNumbers: z.array(z.string()) }).parse(exactReferences);
  const remainingItems = z
    .object({ trackingNumbers: z.array(z.string()) })
    .parse(remainingExactReferences);

  expect({
    statuses,
    samePayload: JSON.stringify(first.data) === JSON.stringify(second.data),
    sameBatch: firstAck.data.batchId === secondAck.data.batchId,
    sameRows: JSON.stringify(firstAck.data.created) === JSON.stringify(secondAck.data.created),
    createdIdMatchesAck: createdShipment.id === firstAck.data.created[0]?.id,
    createdCount: createdItems.trackingNumbers.length,
    remainingCount: remainingItems.trackingNumbers.length,
  }).toEqual({
    statuses: [201, 200],
    samePayload: true,
    sameBatch: true,
    sameRows: true,
    createdIdMatchesAck: true,
    createdCount: 1,
    remainingCount: 0,
  });
});
