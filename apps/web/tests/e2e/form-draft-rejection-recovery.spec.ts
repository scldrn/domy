import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import {
  bulkColumns,
  bulkConfirmInput,
  formatTrackingNumber,
  shipmentCreateInput,
} from "@domy/domain";
import { z } from "zod";
import { bulkDraftSchema } from "../../src/features/shipments/bulk-form-draft";
import { accessibilityViolations, expect, test } from "./fixtures";

const shipmentDraftKey = "domy:draft:shipment";
const bulkDraftKey = "domy:draft:bulk";

const merchantListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

const neighborhoodListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() })),
});

const pickupPointSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  address: z.string(),
  isActive: z.boolean(),
});

const shipmentDraftSchema = z.object({
  id: z.uuid(),
  values: z.object({
    form: z.object({
      merchant: z.object({ id: z.uuid() }).nullable(),
      pickupPointId: z.string().nullable(),
      recipientName: z.string(),
      recipientPhone: z.string(),
      recipientAddress: z.string(),
      recipientNeighborhood: z.object({ id: z.uuid() }).nullable(),
      paymentMode: z.string(),
      codAmount: z.number().nullable(),
      merchantReference: z.string(),
    }),
    pending: z.object({ operation: z.literal("create"), input: shipmentCreateInput }).nullable(),
    needsIntentAcknowledgement: z.boolean(),
    baseVersion: z.null(),
  }),
});

const invalidRequestSchema = z.object({
  error: z.object({
    code: z.literal("invalid_request"),
    fields: z.record(z.string(), z.string()),
  }),
});

const shipmentAckSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string(),
  version: z.number().int().min(1),
});

const bulkAckSchema = z.strictObject({
  batchId: z.uuid(),
  created: z.array(
    z.strictObject({
      row: z.number().int().nonnegative(),
      id: z.uuid(),
      trackingNumber: z.string().min(1),
    }),
  ),
});

const duplicateResponseSchema = z.object({ trackingNumbers: z.array(z.string()) });
const bulkDraftEnvelopeSchema = z.strictObject({ id: z.uuid(), values: bulkDraftSchema });

type BulkConfirmationRequest = z.output<typeof bulkConfirmInput>;

type ShipmentCreateRequest = z.output<typeof shipmentCreateInput>;

async function choose(page: Page, label: string, query: string, option: string) {
  const field = page.getByRole("combobox", { name: label });
  await field.click();
  await field.fill(query);
  await page
    .getByRole("option", { name: new RegExp(option, "i") })
    .first()
    .click();
}

async function storedText(page: Page, key: string) {
  return page.evaluate((storageKey) => sessionStorage.getItem(storageKey), key);
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value;
  } catch {
    return null;
  }
}

async function duplicateCount(
  page: Page,
  input: {
    merchantId: string;
    serviceDate: string;
    merchantReference: string;
  },
) {
  const query = new URLSearchParams(input);
  const response = await page.request.get(`/api/shipments/duplicates?${query.toString()}`);
  if (response.status() !== 200) return -1;
  const body: unknown = await response.json();
  const result = duplicateResponseSchema.safeParse(body);
  return result.success ? result.data.trackingNumbers.length : -1;
}

function duplicateQueryFor(request: ShipmentCreateRequest, reference: string) {
  const serviceDate = request.serviceDate;
  if (!serviceDate) throw new Error("The request is missing its service date");
  return { merchantId: request.merchantId, serviceDate, merchantReference: reference };
}

function bulkLine(values: Partial<Record<(typeof bulkColumns)[number], string>>): string {
  return bulkColumns.map((column) => values[column] ?? "").join("\t");
}

function duplicateQueryForBulk(request: BulkConfirmationRequest) {
  const row = request.rows[0];
  if (!row) throw new Error("The bulk confirmation has no rows");
  const serviceDate = row.serviceDate;
  if (!serviceDate) throw new Error("The bulk row is missing its service date");
  const merchantReference = row.merchantReference;
  if (!merchantReference) throw new Error("The bulk row is missing its merchant reference");
  return { merchantId: request.merchantId, serviceDate, merchantReference };
}

test("reviews a definitively rejected pending create before replacing its identity (001/T137)", async ({
  dispatcherPage: page,
  ownerPage,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const reference = `T137-rejected-${suffix}`;
  const recipient = `T137 destinatario ${suffix}`;
  const recipientAddress = "Calle 10 # 43-12";
  const pickupPointId = randomUUID();
  const pickupLabel = `T137 punto ${suffix}`;

  const merchantsResponse = await ownerPage.request.get("/api/merchants?q=Bullish");
  const merchants = merchantListSchema.safeParse(await merchantsResponse.json());
  if (!merchants.success) throw new Error("The e2e catalog lacks Bullish Hype");
  const merchant = merchants.data.items[0];
  if (!merchant) throw new Error("The e2e catalog lacks Bullish Hype");

  const neighborhoodsResponse = await ownerPage.request.get("/api/neighborhoods?q=Laureles");
  const neighborhoods = neighborhoodListSchema.safeParse(await neighborhoodsResponse.json());
  if (!neighborhoods.success) throw new Error("The e2e catalog lacks Laureles");
  const neighborhood = neighborhoods.data.items.find((item) => item.isActive);
  if (!neighborhood) throw new Error("The e2e catalog lacks an active Laureles neighborhood");

  const pickupCreated = await ownerPage.request.post(
    `/api/merchants/${merchant.id}/pickup-points`,
    {
      data: {
        id: pickupPointId,
        label: pickupLabel,
        address: recipientAddress,
        neighborhoodId: neighborhood.id,
      },
    },
  );
  const pickupPoint = pickupPointSchema.safeParse(await pickupCreated.json());
  expect({
    status: pickupCreated.status(),
    pointMatches: pickupPoint.success && pickupPoint.data.id === pickupPointId,
    active: pickupPoint.success && pickupPoint.data.isActive,
  }).toEqual({ status: 201, pointMatches: true, active: true });

  const requests: ShipmentCreateRequest[] = [];
  const statuses: number[] = [];
  const acknowledgements: string[] = [];
  const rejection: { code: string | null; pickupField: boolean } = {
    code: null,
    pickupField: false,
  };
  const deactivationStatuses: number[] = [];
  const reactivationStatuses: number[] = [];
  const networkPending: { raw: string | null; matchesRequest: boolean } = {
    raw: null,
    matchesRequest: false,
  };
  const pickupState = { mayBeInactive: false };

  await page.route("**/api/shipments", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const parsedRequest = shipmentCreateInput.safeParse(route.request().postDataJSON());
    if (!parsedRequest.success) {
      await route.continue();
      return;
    }
    const request = parsedRequest.data;
    requests.push(request);

    if (requests.length === 1) {
      networkPending.raw = await storedText(page, shipmentDraftKey);
      const pendingDraft = shipmentDraftSchema.safeParse(parseJson(networkPending.raw));
      networkPending.matchesRequest =
        pendingDraft.success &&
        pendingDraft.data.id === request.id &&
        pendingDraft.data.values.pending?.operation === "create" &&
        pendingDraft.data.values.pending.input.id === request.id &&
        JSON.stringify(pendingDraft.data.values.pending.input) === JSON.stringify(request) &&
        pendingDraft.data.values.form.pickupPointId === pickupPointId &&
        pendingDraft.data.values.form.merchantReference === reference;

      pickupState.mayBeInactive = true;
      const deactivated = await ownerPage.request.patch(`/api/pickup-points/${pickupPointId}`, {
        data: { actionId: randomUUID(), isActive: false },
      });
      deactivationStatuses.push(deactivated.status());
      if (deactivated.status() !== 200)
        throw new Error("The test pickup point was not deactivated");
    }

    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    if (requests.length === 1) {
      const error = invalidRequestSchema.safeParse(body);
      rejection.code = error.success ? error.data.error.code : null;
      rejection.pickupField =
        error.success &&
        error.data.error.fields.pickupPointId === "Elige un punto de recogida activo del cliente.";
    } else {
      const acknowledgement = shipmentAckSchema.safeParse(body);
      if (acknowledgement.success) acknowledgements.push(acknowledgement.data.id);
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/nuevo");
  await choose(page, "Cliente", "Bulli", "Bullish Hype");
  const pickup = page.getByRole("combobox", { name: "Punto de recogida" });
  await pickup.click();
  await page
    .getByRole("option", { name: `${pickupLabel} · ${recipientAddress}`, exact: true })
    .click();
  await page.getByLabel("Nombre del destinatario").fill(recipient);
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByLabel("Dirección de entrega").fill(recipientAddress);
  await choose(page, "Barrio", "Laureles", "Laureles");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  await page.getByLabel("Referencia del cliente").fill(reference);

  try {
    await page.getByRole("button", { name: "Registrar envío" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /El servidor rechazó los datos enviados/i }),
    ).toBeVisible();
    await expect(pickup).toBeVisible();
    await expect(pickup).toBeDisabled();
    await expect(page.getByRole("button", { name: "Registrar envío" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar envío" })).toBeDisabled();
    await expect(page.getByLabel("Nombre del destinatario")).toHaveValue(recipient);
    await expect(page.getByLabel("Referencia del cliente")).toHaveValue(reference);
    expect(requests).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Descargar solicitud pendiente" })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  } finally {
    if (pickupState.mayBeInactive) {
      const reactivated = await ownerPage.request.patch(`/api/pickup-points/${pickupPointId}`, {
        data: { actionId: randomUUID(), isActive: true },
      });
      reactivationStatuses.push(reactivated.status());
      pickupState.mayBeInactive = reactivated.status() !== 200;
    }
  }

  const currentRaw = await storedText(page, shipmentDraftKey);
  const storedPending = shipmentDraftSchema.safeParse(parseJson(currentRaw));
  const firstRequest = requests[0];
  if (!firstRequest) throw new Error("The rejected create request was not observed");
  const rejectedIntentPreserved =
    networkPending.raw !== null &&
    currentRaw === networkPending.raw &&
    storedPending.success &&
    storedPending.data.id === firstRequest.id &&
    storedPending.data.values.pending?.operation === "create" &&
    JSON.stringify(storedPending.data.values.pending.input) === JSON.stringify(firstRequest);
  expect({
    deactivationStatuses,
    reactivationStatuses,
    statuses,
    pendingWasPersistedBeforeNetwork: networkPending.matchesRequest,
    rejectedIntentPreserved,
    rejection,
    noEffectBeforeFreshAttempt: await duplicateCount(
      page,
      duplicateQueryFor(firstRequest, reference),
    ),
    pickupWasReactivated: !pickupState.mayBeInactive,
  }).toEqual({
    deactivationStatuses: [200],
    reactivationStatuses: [200],
    statuses: [400],
    pendingWasPersistedBeforeNetwork: true,
    rejectedIntentPreserved: true,
    rejection: { code: "invalid_request", pickupField: true },
    noEffectBeforeFreshAttempt: 0,
    pickupWasReactivated: true,
  });
  if (!storedPending.success) throw new Error("The rejected create was not persisted");

  const review = page
    .getByRole("alert")
    .filter({ hasText: /El servidor rechazó los datos enviados/i });
  await expect(review).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar solicitud pendiente" }).click();
  const copy = await download;
  expect(copy.suggestedFilename()).toBe("domy-solicitud-pendiente.txt");
  const historyAcknowledgement = page.getByLabel(
    "Ya descargué la copia y revisé el historial de envíos.",
  );
  await expect(historyAcknowledgement).toBeEnabled();
  const prepareNewIntent = page.getByRole("button", { name: "Preparar un intento nuevo" });
  await expect(prepareNewIntent).toBeDisabled();
  expect(requests).toHaveLength(1);
  expect(await accessibilityViolations(page)).toEqual([]);

  await historyAcknowledgement.check();
  await prepareNewIntent.click();
  await expect(page.getByLabel("Referencia del cliente")).toHaveValue(reference);
  await expect(page.getByLabel("Nombre del destinatario")).toHaveValue(recipient);
  await expect(pickup).toBeEnabled();
  await expect(page.getByRole("button", { name: "Registrar envío" })).toBeEnabled();

  const preparedRaw = await storedText(page, shipmentDraftKey);
  const preparedDraft = shipmentDraftSchema.safeParse(parseJson(preparedRaw));
  if (!preparedDraft.success) throw new Error("The reviewed attempt was not saved locally");
  if (firstRequest.kind !== "delivery") throw new Error("The e2e request was not a delivery");
  const preparedIntentIsFresh =
    preparedDraft.data.id !== firstRequest.id &&
    preparedDraft.data.values.pending === null &&
    preparedDraft.data.values.form.pickupPointId === firstRequest.pickupPointId &&
    preparedDraft.data.values.form.merchantReference === firstRequest.merchantReference &&
    preparedDraft.data.values.form.recipientName === firstRequest.recipientName &&
    preparedDraft.data.values.form.recipientPhone === firstRequest.recipientPhone &&
    preparedDraft.data.values.form.recipientAddress === firstRequest.recipientAddress;
  expect(preparedIntentIsFresh).toBe(true);
  expect(await accessibilityViolations(page)).toEqual([]);

  const freshResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(response.url()).pathname !== "/api/shipments")
      return false;
    const parsed = shipmentCreateInput.safeParse(request.postDataJSON());
    return parsed.success && parsed.data.id === preparedDraft.data.id;
  });
  await page.getByRole("button", { name: "Registrar envío" }).click();
  const freshResponse = await freshResponsePromise;
  const freshAcknowledgement = shipmentAckSchema.safeParse(await freshResponse.json());
  if (!freshAcknowledgement.success)
    throw new Error("The fresh create did not return a valid acknowledgement");
  const secondRequest = requests[1];
  const freshAckId = acknowledgements[0];
  if (!secondRequest || !freshAckId) throw new Error("The fresh create was not observed");
  if (secondRequest.kind !== "delivery") throw new Error("The fresh request was not a delivery");

  await expect(
    page.getByText(
      `Envío ${formatTrackingNumber(freshAcknowledgement.data.trackingNumber)} registrado`,
      { exact: true },
    ),
  ).toBeVisible();

  const firstPayloadWithoutId = { ...firstRequest, id: "" };
  const freshPayloadWithoutId = { ...secondRequest, id: "" };
  expect({
    statuses,
    firstIdWasRejected: firstRequest.id !== secondRequest.id,
    freshRequestUsesPreparedId: secondRequest.id === preparedDraft.data.id,
    payloadPreservedExceptId:
      JSON.stringify(firstPayloadWithoutId) === JSON.stringify(freshPayloadWithoutId),
    freshAckMatchesId: freshAckId === secondRequest.id,
    effectCount: await duplicateCount(page, duplicateQueryFor(secondRequest, reference)),
  }).toEqual({
    statuses: [400, 201],
    firstIdWasRejected: true,
    freshRequestUsesPreparedId: true,
    payloadPreservedExceptId: true,
    freshAckMatchesId: true,
    effectCount: 1,
  });
});

test("reviews a definitively rejected bulk row before replacing its batch and row identities (001/T137)", async ({
  dispatcherPage: page,
  ownerPage,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const reference = `T137-bulk-rejected-${suffix}`;
  const recipient = `T137 lote ${suffix}`;
  const recipientAddress = "Calle 10 # 43-12";
  const pickupPointId = randomUUID();
  const pickupLabel = `T137 punto lote ${suffix}`;
  const merchantSearch = await ownerPage.request.get("/api/merchants?q=Bullish");
  const merchants = merchantListSchema.safeParse(await merchantSearch.json());
  if (!merchants.success) throw new Error("The e2e catalog lacks Bullish Hype");
  const merchant = merchants.data.items[0];
  if (!merchant) throw new Error("The e2e catalog lacks Bullish Hype");

  const neighborhoodsResponse = await ownerPage.request.get("/api/neighborhoods?q=Laureles");
  const neighborhoods = neighborhoodListSchema.safeParse(await neighborhoodsResponse.json());
  if (!neighborhoods.success) throw new Error("The e2e catalog lacks Laureles");
  const neighborhood = neighborhoods.data.items.find((item) => item.isActive);
  if (!neighborhood) throw new Error("The e2e catalog lacks an active Laureles neighborhood");

  const pickupCreated = await ownerPage.request.post(
    `/api/merchants/${merchant.id}/pickup-points`,
    {
      data: {
        id: pickupPointId,
        label: pickupLabel,
        address: recipientAddress,
        neighborhoodId: neighborhood.id,
      },
    },
  );
  const pickupPoint = pickupPointSchema.safeParse(await pickupCreated.json());
  expect({
    status: pickupCreated.status(),
    pointMatches: pickupPoint.success && pickupPoint.data.id === pickupPointId,
    active: pickupPoint.success && pickupPoint.data.isActive,
  }).toEqual({ status: 201, pointMatches: true, active: true });

  const rawRows = bulkLine({
    Fecha: "01/10/2026",
    Destinatario: recipient,
    Teléfono: "3001234567",
    Dirección: recipientAddress,
    Barrio: "Laureles",
    Modalidad: "Contraentrega",
    "Valor a recaudar": "$ 85.000",
    Referencia: reference,
  });
  const requests: BulkConfirmationRequest[] = [];
  const statuses: number[] = [];
  const acknowledgements: string[] = [];
  const rejection: { code: string | null; pickupField: boolean } = {
    code: null,
    pickupField: false,
  };
  const deactivationStatuses: number[] = [];
  const reactivationStatuses: number[] = [];
  const networkPending: { raw: string | null; matchesRequest: boolean } = {
    raw: null,
    matchesRequest: false,
  };
  const retryPending: { id: string | null; matchesRequest: boolean } = {
    id: null,
    matchesRequest: false,
  };
  const pickupState = { mayBeInactive: false };

  await page.route("**/api/bulk/confirm", async (route) => {
    const parsedRequest = bulkConfirmInput.safeParse(route.request().postDataJSON());
    if (!parsedRequest.success) {
      await route.continue();
      return;
    }
    const request = parsedRequest.data;
    requests.push(request);

    if (requests.length === 1) {
      networkPending.raw = await storedText(page, bulkDraftKey);
      const pendingDraft = bulkDraftEnvelopeSchema.safeParse(parseJson(networkPending.raw));
      const pending = pendingDraft.success ? pendingDraft.data.values.pending : null;
      networkPending.matchesRequest =
        pendingDraft.success &&
        pendingDraft.data.values.form.merchant?.id === request.merchantId &&
        pendingDraft.data.values.form.pickupPointId === pickupPointId &&
        pendingDraft.data.values.form.text === rawRows &&
        pending !== null &&
        pending.input.batchId === request.batchId &&
        JSON.stringify(pending.input) === JSON.stringify(request) &&
        JSON.stringify(pending.input.rows) === JSON.stringify(request.rows);

      const deactivated = await ownerPage.request.patch(`/api/pickup-points/${pickupPointId}`, {
        data: { actionId: randomUUID(), isActive: false },
      });
      deactivationStatuses.push(deactivated.status());
      pickupState.mayBeInactive = deactivated.status() === 200;
    } else {
      const retryRaw = await storedText(page, bulkDraftKey);
      const retryDraft = bulkDraftEnvelopeSchema.safeParse(parseJson(retryRaw));
      const pending = retryDraft.success ? retryDraft.data.values.pending : null;
      retryPending.id = retryDraft.success ? retryDraft.data.id : null;
      retryPending.matchesRequest =
        retryDraft.success &&
        pending !== null &&
        pending.input.batchId === request.batchId &&
        JSON.stringify(pending.input) === JSON.stringify(request);
    }

    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    if (requests.length === 1) {
      const error = invalidRequestSchema.safeParse(body);
      rejection.code = error.success ? error.data.error.code : null;
      rejection.pickupField =
        error.success &&
        Object.entries(error.data.error.fields).some(
          ([field, message]) =>
            field.includes("pickupPointId") &&
            message === "Elige un punto de recogida activo del cliente.",
        );
    } else {
      const acknowledgement = bulkAckSchema.safeParse(body);
      const createdId = acknowledgement.success ? acknowledgement.data.created[0]?.id : undefined;
      if (createdId) acknowledgements.push(createdId);
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/masivo");
  await choose(page, "Cliente", "Bulli", "Bullish Hype");
  const pickup = page.getByRole("combobox", { name: "Punto de recogida" });
  await pickup.click();
  await page
    .getByRole("option", { name: `${pickupLabel} · ${recipientAddress}`, exact: true })
    .click();
  await page.getByLabel("Filas").fill(rawRows);
  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("1 lista · 0 por confirmar · 0 con errores")).toBeVisible();

  try {
    await page.getByRole("button", { name: "Crear 1 envío" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /El servidor rechazó los datos enviados/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar lote pendiente" })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  } finally {
    if (pickupState.mayBeInactive) {
      const reactivated = await ownerPage.request.patch(`/api/pickup-points/${pickupPointId}`, {
        data: { actionId: randomUUID(), isActive: true },
      });
      reactivationStatuses.push(reactivated.status());
      pickupState.mayBeInactive = reactivated.status() !== 200;
    }
  }

  const currentRaw = await storedText(page, bulkDraftKey);
  const storedPending = bulkDraftEnvelopeSchema.safeParse(parseJson(currentRaw));
  const firstRequest = requests[0];
  if (!firstRequest) throw new Error("The rejected bulk confirmation was not observed");
  const firstRow = firstRequest.rows[0];
  if (!firstRow) throw new Error("The rejected bulk confirmation had no row");
  const rejectedIntentPreserved =
    networkPending.raw !== null &&
    currentRaw === networkPending.raw &&
    storedPending.success &&
    storedPending.data.values.pending !== null &&
    storedPending.data.values.pending.input.batchId === firstRequest.batchId &&
    JSON.stringify(storedPending.data.values.pending.input) === JSON.stringify(firstRequest);
  expect({
    deactivationStatuses,
    reactivationStatuses,
    statuses,
    pendingWasPersistedBeforeNetwork: networkPending.matchesRequest,
    rejectedIntentPreserved,
    rejection,
    noEffectBeforeFreshAttempt: await duplicateCount(page, duplicateQueryForBulk(firstRequest)),
    pickupWasReactivated: !pickupState.mayBeInactive,
  }).toEqual({
    deactivationStatuses: [200],
    reactivationStatuses: [200],
    statuses: [400],
    pendingWasPersistedBeforeNetwork: true,
    rejectedIntentPreserved: true,
    rejection: { code: "invalid_request", pickupField: true },
    noEffectBeforeFreshAttempt: 0,
    pickupWasReactivated: true,
  });
  if (!storedPending.success) throw new Error("The rejected bulk intent was not persisted");

  const review = page
    .getByRole("alert")
    .filter({ hasText: /El servidor rechazó los datos enviados/i });
  await expect(review).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar lote pendiente" }).click();
  const copy = await download;
  expect(copy.suggestedFilename()).toBe("domy-lote-pendiente.txt");
  const historyAcknowledgement = page.getByLabel(
    "Ya descargué la copia y revisé el historial de envíos.",
  );
  await expect(historyAcknowledgement).toBeEnabled();
  const prepareNewIntent = page.getByRole("button", { name: "Preparar un intento nuevo" });
  await expect(prepareNewIntent).toBeDisabled();
  expect(requests).toHaveLength(1);
  expect(await accessibilityViolations(page)).toEqual([]);

  await historyAcknowledgement.check();
  await prepareNewIntent.click();
  await expect(page.getByLabel("Filas")).toHaveValue(rawRows);
  await expect(page.getByRole("button", { name: "Revisar lista" })).toBeEnabled();
  const preparedRaw = await storedText(page, bulkDraftKey);
  const preparedDraft = bulkDraftEnvelopeSchema.safeParse(parseJson(preparedRaw));
  if (!preparedDraft.success) throw new Error("The reviewed bulk attempt was not saved locally");
  const preparedIntentIsFresh =
    preparedDraft.data.id !== storedPending.data.id &&
    preparedDraft.data.values.pending === null &&
    preparedDraft.data.values.form.merchant?.id === firstRequest.merchantId &&
    preparedDraft.data.values.form.pickupPointId === pickupPointId &&
    preparedDraft.data.values.form.text === rawRows;
  expect(preparedIntentIsFresh).toBe(true);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Revisar lista" }).click();
  await expect(page.getByText("1 lista · 0 por confirmar · 0 con errores")).toBeVisible();
  const freshPreviewRaw = await storedText(page, bulkDraftKey);
  const freshPreviewDraft = bulkDraftEnvelopeSchema.safeParse(parseJson(freshPreviewRaw));
  if (!freshPreviewDraft.success) throw new Error("The re-reviewed bulk form was not saved");
  const freshResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(response.url()).pathname !== "/api/bulk/confirm")
      return false;
    const parsed = bulkConfirmInput.safeParse(request.postDataJSON());
    return parsed.success && parsed.data.rows[0]?.id !== firstRow.id;
  });
  await page.getByRole("button", { name: "Crear 1 envío" }).click();
  const freshResponse = await freshResponsePromise;
  const freshAcknowledgement = bulkAckSchema.safeParse(await freshResponse.json());
  if (!freshAcknowledgement.success)
    throw new Error("The fresh bulk create did not return a valid acknowledgement");
  const secondRequest = requests[1];
  const freshAckId = acknowledgements[0];
  if (!secondRequest || !freshAckId) throw new Error("The fresh bulk create was not observed");
  const secondRow = secondRequest.rows[0];
  const firstAckRow = freshAcknowledgement.data.created[0];
  if (!secondRow || !firstAckRow) throw new Error("The fresh bulk acknowledgement had no row");

  const firstRequestWithoutIdentity = {
    ...firstRequest,
    batchId: "",
    rows: firstRequest.rows.map((row) => ({ ...row, id: "" })),
  };
  const secondRequestWithoutIdentity = {
    ...secondRequest,
    batchId: "",
    rows: secondRequest.rows.map((row) => ({ ...row, id: "" })),
  };
  expect({
    requestsObserved: requests.length,
    statuses,
    newBatch: firstRequest.batchId !== secondRequest.batchId,
    newRow: firstRow.id !== secondRow.id,
    payloadPreservedExceptIdentities:
      JSON.stringify(firstRequestWithoutIdentity) === JSON.stringify(secondRequestWithoutIdentity),
    freshAckMatches: firstAckRow.id === secondRow.id && firstAckRow.row === 0,
    retryStoredBeforeNetwork: retryPending.matchesRequest,
    retryDraftIdChanged: retryPending.id !== null && retryPending.id !== storedPending.data.id,
    effectCount: await duplicateCount(page, duplicateQueryForBulk(secondRequest)),
    batchGeneratedAfterFreshReview: secondRequest.batchId !== firstRequest.batchId,
    previewDraftRotated: freshPreviewDraft.data.id === preparedDraft.data.id,
  }).toEqual({
    requestsObserved: 2,
    statuses: [400, 201],
    newBatch: true,
    newRow: true,
    payloadPreservedExceptIdentities: true,
    freshAckMatches: true,
    retryStoredBeforeNetwork: true,
    retryDraftIdChanged: true,
    effectCount: 1,
    batchGeneratedAfterFreshReview: true,
    previewDraftRotated: true,
  });
});
