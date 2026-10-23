import {
  bulkConfirmInput,
  formatTrackingNumber,
  shipmentCreateInput,
  shipmentUpdateInput,
} from "@domy/domain";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { fromShipment, shipmentDraftValues } from "../../src/features/shipments/form-values";
import { register } from "./api";
import { accessibilityViolations, expect, test } from "./fixtures";

const shipmentDraftKey = "domy:draft:shipment";

const pendingCreateDraftSchema = z.object({
  id: z.uuid(),
  values: z.object({
    form: z.object({ merchantReference: z.string() }),
    pending: z.object({ operation: z.literal("create"), input: shipmentCreateInput }),
    needsIntentAcknowledgement: z.literal(false),
    baseVersion: z.null(),
  }),
});

const readyCreateDraftSchema = z.object({
  id: z.uuid(),
  values: z.object({
    form: z.object({ merchantReference: z.string() }),
    pending: z.null(),
    needsIntentAcknowledgement: z.literal(false),
    baseVersion: z.null(),
  }),
});

const editDraftSchema = z.object({
  id: z.uuid(),
  values: z.object({
    form: z.object({ instructions: z.string() }),
    pending: z.null(),
    needsIntentAcknowledgement: z.literal(false),
    baseVersion: z.number().int().min(1),
  }),
});

const shipmentAckSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string(),
  version: z.number().int().min(1),
});

const shipmentVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(1),
  instructions: z.string().nullable(),
});

const merchantListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

const neighborhoodListSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() })),
});

const pickupPointListSchema = z.object({
  items: z.array(
    z.object({ id: z.uuid(), isActive: z.boolean(), isDefault: z.boolean().optional() }),
  ),
});

const bulkSeedAckSchema = z.object({
  batchId: z.uuid(),
  created: z.array(z.object({ row: z.number().int(), id: z.uuid(), trackingNumber: z.string() })),
});

const duplicateResponseSchema = z.object({ trackingNumbers: z.array(z.string()) });

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

async function fillDelivery(
  page: Page,
  reference: string,
  recipient: string,
  options: {
    referenceBeforeNeighborhood?: boolean;
    beforeNeighborhood?: () => Promise<void>;
  } = {},
) {
  await choose(page, "Cliente", "Bulli", "Bullish Hype");
  await page.getByLabel("Nombre del destinatario").fill(recipient);
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByLabel("Dirección de entrega").fill("Calle 10 # 43-12");
  if (options.referenceBeforeNeighborhood) {
    await page.getByLabel("Referencia del cliente").fill(reference);
    await expect(page.getByRole("status").filter({ hasText: /Posible duplicado/ })).toHaveCount(0);
  }
  await options.beforeNeighborhood?.();
  await choose(page, "Barrio", "Laureles", "Laureles");
  await page.getByRole("button", { name: "Crédito del cliente" }).click();
  if (!options.referenceBeforeNeighborhood)
    await page.getByLabel("Referencia del cliente").fill(reference);
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

async function failOnlyNewDraftIds(page: Page, previousId: string) {
  await page.evaluate(
    ({ key, oldId }) => {
      const storage = sessionStorage;
      const nativeSetItem = storage.setItem.bind(storage);
      Object.defineProperty(storage, "setItem", {
        configurable: true,
        writable: true,
        value: (storageKey: string, raw: string) => {
          if (storageKey === key) {
            let saved: unknown;
            try {
              saved = JSON.parse(raw);
            } catch {
              saved = null;
            }
            if (
              typeof saved === "object" &&
              saved !== null &&
              "id" in saved &&
              saved.id !== oldId
            ) {
              throw new DOMException("Synthetic draft rotation failure", "QuotaExceededError");
            }
          }
          nativeSetItem(storageKey, raw);
        },
      });
    },
    { key: shipmentDraftKey, oldId: previousId },
  );
}

async function matchingReferenceCount(page: Page, request: ShipmentCreateRequest) {
  const serviceDate = request.serviceDate;
  if (!serviceDate) throw new Error("The request is missing its service date");
  const merchantReference = request.merchantReference;
  if (!merchantReference) throw new Error("The request is missing its merchant reference");
  const query = new URLSearchParams({
    merchantId: request.merchantId,
    serviceDate,
    merchantReference,
  });
  const response = await page.request.get(`/api/shipments/duplicates?${query.toString()}`);
  if (response.status() !== 200) return -1;
  const body: unknown = await response.json();
  const result = z.object({ trackingNumbers: z.array(z.string()) }).safeParse(body);
  return result.success ? result.data.trackingNumbers.length : -1;
}

async function phoneDuplicateCount(page: Page, merchantId: string, serviceDate: string) {
  const query = new URLSearchParams({
    merchantId,
    serviceDate,
    recipientPhone: "3001234567",
  });
  const response = await page.request.get(`/api/shipments/duplicates?${query.toString()}`);
  if (response.status() !== 200) throw new Error("Could not read the phone duplicate count");
  const body: unknown = await response.json();
  return duplicateResponseSchema.parse(body).trackingNumbers.length;
}

async function preparePhoneDuplicateBaseline(page: Page, suffix: string) {
  const merchantResponse = await page.request.get("/api/merchants?q=Bullish");
  if (merchantResponse.status() !== 200) throw new Error("The e2e catalog lacks Bullish Hype");
  const merchants = merchantListSchema.safeParse(await merchantResponse.json());
  const merchant = merchants.success
    ? merchants.data.items.find((item) => item.name === "Bullish Hype")
    : undefined;
  if (!merchant) throw new Error("The e2e catalog lacks Bullish Hype");

  const neighborhoodResponse = await page.request.get("/api/neighborhoods?q=Laureles");
  if (neighborhoodResponse.status() !== 200) throw new Error("The e2e catalog lacks Laureles");
  const neighborhoods = neighborhoodListSchema.safeParse(await neighborhoodResponse.json());
  const neighborhood = neighborhoods.success
    ? neighborhoods.data.items.find((item) => item.name === "Laureles" && item.isActive)
    : undefined;
  if (!neighborhood) throw new Error("The e2e catalog lacks an active Laureles neighborhood");

  const pickupResponse = await page.request.get(`/api/merchants/${merchant.id}/pickup-points`);
  if (pickupResponse.status() !== 200) throw new Error("Bullish Hype has no active pickup point");
  const pickupPoints = pickupPointListSchema.safeParse(await pickupResponse.json());
  const pickupPoint = pickupPoints.success
    ? (pickupPoints.data.items.find((point) => point.isActive && point.isDefault) ??
      pickupPoints.data.items.find((point) => point.isActive))
    : undefined;
  if (!pickupPoint) throw new Error("Bullish Hype has no active pickup point");

  const serviceDate = "2026-10-01";
  const baseline = await phoneDuplicateCount(page, merchant.id, serviceDate);
  const seedCount = Math.max(0, 50 - baseline);
  if (seedCount > 0) {
    const batchId = randomUUID();
    const input = bulkConfirmInput.parse({
      batchId,
      merchantId: merchant.id,
      rows: Array.from({ length: seedCount }, (_, index) =>
        shipmentCreateInput.parse({
          id: randomUUID(),
          kind: "delivery",
          merchantId: merchant.id,
          serviceDate,
          pickupPointId: pickupPoint.id,
          recipientName: `T137 duplicado ${suffix} ${String(index + 1)}`,
          recipientPhone: "3001234567",
          recipientAddress: "Calle 10 # 43-12",
          recipientNeighborhoodId: neighborhood.id,
          serviceLevel: "standard",
          fee: 13000,
          paymentMode: "cash_on_delivery",
          codAmount: 85000,
          merchantReference: `T137-seed-${suffix}-${String(index + 1)}`,
          confirmed: true,
        }),
      ),
    });
    const seeded = await page.request.post("/api/bulk/confirm", { data: input });
    const acknowledgement = bulkSeedAckSchema.safeParse(await seeded.json());
    expect({
      status: seeded.status(),
      batchMatches: acknowledgement.success && acknowledgement.data.batchId === batchId,
      created: acknowledgement.success ? acknowledgement.data.created.length : -1,
    }).toEqual({ status: 201, batchMatches: true, created: seedCount });
  }

  const preparedCount = await phoneDuplicateCount(page, merchant.id, serviceDate);
  expect(preparedCount).toBe(Math.max(baseline, 50));
  return { merchantId: merchant.id, serviceDate, phoneCount: preparedCount };
}

test("recovers the exact create after the ACKed draft ID cannot rotate (001/T137)", async ({
  dispatcherPage: page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const firstReference = `T137-rotation-${suffix}`;
  const secondReference = `T137-fresh-${suffix}`;
  const requests: ShipmentCreateRequest[] = [];
  const statuses: number[] = [];
  const acknowledgements: string[] = [];
  const initialPending: { raw: string | null; matchesRequest: boolean } = {
    raw: null,
    matchesRequest: false,
  };

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
      initialPending.raw = await storedText(page, shipmentDraftKey);
      const pending = pendingCreateDraftSchema.safeParse(parseJson(initialPending.raw));
      initialPending.matchesRequest =
        pending.success &&
        pending.data.id === request.id &&
        pending.data.values.pending.input.id === request.id &&
        JSON.stringify(pending.data.values.pending.input) === JSON.stringify(request);
    }

    const response = await route.fetch();
    statuses.push(response.status());
    const body: unknown = await response.json();
    const acknowledgement = shipmentAckSchema.safeParse(body);
    if (acknowledgement.success) acknowledgements.push(acknowledgement.data.id);

    if (requests.length === 1) await failOnlyNewDraftIds(page, request.id);
    await route.fulfill({ response, json: body });
  });

  await page.goto("/envios/nuevo");
  const duplicateFixture = await preparePhoneDuplicateBaseline(page, suffix);
  await fillDelivery(page, firstReference, `T137 destinatario ${suffix}`, {
    referenceBeforeNeighborhood: true,
  });
  await page.getByRole("button", { name: "Registrar envío" }).click();

  const rotationAlert = page
    .getByRole("alert")
    .filter({ hasText: /no pudimos guardar un identificador nuevo/i });
  await expect(rotationAlert).toContainText(/reintenta el guardado antes de enviar otro/i);
  await expect(page.getByRole("button", { name: "Reintentar guardado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar envío" })).toBeDisabled();
  await expect(page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/)).toBeVisible();

  const firstRequest = requests[0];
  if (!firstRequest?.serviceDate)
    throw new Error("The first create did not include a service date");
  expect({
    merchantMatches: firstRequest.merchantId === duplicateFixture.merchantId,
    serviceDateMatches: firstRequest.serviceDate === duplicateFixture.serviceDate,
    phoneDuplicatesAfterAck: await phoneDuplicateCount(
      page,
      firstRequest.merchantId,
      firstRequest.serviceDate,
    ),
  }).toEqual({
    merchantMatches: true,
    serviceDateMatches: true,
    phoneDuplicatesAfterAck: duplicateFixture.phoneCount + 1,
  });

  // A fully valid new form cannot replace the acknowledged pending snapshot while its new
  // draft identity is not durable; the storage failure remains installed until reload.
  await fillDelivery(page, secondReference, `T137 destinatario nuevo ${suffix}`, {
    beforeNeighborhood: async () => {
      const warning = page.getByRole("status").filter({ hasText: /Posible duplicado/ });
      await expect(warning).toBeVisible();
      await expect(warning).toContainText(/el mismo teléfono/i);
    },
  });
  await expect(page.getByRole("button", { name: "Registrar envío" })).toBeDisabled();
  const beforeReloadRaw = await storedText(page, shipmentDraftKey);
  const oldSnapshotPreserved =
    initialPending.raw !== null && beforeReloadRaw === initialPending.raw;
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: /solicitud de registro sin confirmación/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar solicitud pendiente" })).toBeVisible();
  await expect(page.getByLabel("Referencia del cliente")).toHaveValue(firstReference);
  await expect(page.getByLabel("Referencia del cliente")).toBeDisabled();
  await expect(page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/)).toHaveCount(0);
  const reloadedRaw = await storedText(page, shipmentDraftKey);
  const reloadedPending = pendingCreateDraftSchema.safeParse(parseJson(reloadedRaw));
  const reloadMatchesOriginal =
    initialPending.raw !== null &&
    reloadedRaw === initialPending.raw &&
    reloadedPending.success &&
    requests[0] !== undefined &&
    reloadedPending.data.id === requests[0].id &&
    JSON.stringify(reloadedPending.data.values.pending.input) === JSON.stringify(requests[0]);
  expect(await accessibilityViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Reintentar solicitud pendiente" }).click();
  await expect(page.getByText(/Envío [0-9A-Z]{4}-[0-9A-Z]{4} registrado/)).toBeVisible();
  const readyRaw = await storedText(page, shipmentDraftKey);
  const readyDraft = readyCreateDraftSchema.safeParse(parseJson(readyRaw));
  if (!readyDraft.success)
    throw new Error("The acknowledged create did not rotate to a ready draft");

  await fillDelivery(page, secondReference, `T137 destinatario nuevo ${suffix}`, {
    beforeNeighborhood: async () => {
      await expect(page.getByRole("status").filter({ hasText: /Posible duplicado/ })).toBeVisible();
    },
  });
  const freshCreateResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(response.url()).pathname !== "/api/shipments")
      return false;
    const parsed = shipmentCreateInput.safeParse(request.postDataJSON());
    return parsed.success && parsed.data.id === readyDraft.data.id;
  });
  await page.getByRole("button", { name: "Registrar envío" }).click();
  const freshCreateResponse = await freshCreateResponsePromise;
  const freshCreateAcknowledgement = shipmentAckSchema.safeParse(await freshCreateResponse.json());
  if (!freshCreateAcknowledgement.success)
    throw new Error("The fresh create did not return a valid acknowledgement");
  await expect(
    page.getByText(
      `Envío ${formatTrackingNumber(freshCreateAcknowledgement.data.trackingNumber)} registrado`,
      { exact: true },
    ),
  ).toBeVisible();

  const first = requests[0];
  const replay = requests[1];
  const fresh = requests[2];
  const firstAck = acknowledgements[0];
  const replayAck = acknowledgements[1];
  const freshAck = acknowledgements[2];
  if (!first || !replay || !fresh || !firstAck || !replayAck || !freshAck)
    throw new Error("The shipment create/recovery requests were not all observed");

  expect({
    statuses,
    initialPendingMatchesRequest: initialPending.matchesRequest,
    oldSnapshotPreserved,
    reloadMatchesOriginal,
    replayUsesSameId: replay.id === first.id,
    replayUsesSamePayload: JSON.stringify(replay) === JSON.stringify(first),
    firstAckMatchesId: firstAck === first.id,
    replayAckMatchesId: replayAck === first.id,
    rotatedIdIsNew: readyDraft.data.id !== first.id,
    freshCreateUsesRotatedId: fresh.id === readyDraft.data.id,
    freshCreateUsesNewId: fresh.id !== first.id,
    freshAckMatchesId: freshAck === fresh.id,
    firstReferenceRows: await matchingReferenceCount(page, first),
    secondReferenceRows: await matchingReferenceCount(page, fresh),
  }).toEqual({
    statuses: [201, 200, 201],
    initialPendingMatchesRequest: true,
    oldSnapshotPreserved: true,
    reloadMatchesOriginal: true,
    replayUsesSameId: true,
    replayUsesSamePayload: true,
    firstAckMatchesId: true,
    replayAckMatchesId: true,
    rotatedIdIsNew: true,
    freshCreateUsesRotatedId: true,
    freshCreateUsesNewId: true,
    freshAckMatchesId: true,
    firstReferenceRows: 1,
    secondReferenceRows: 1,
  });
});

test("keeps a stale edit draft until its owner reviews the current shipment (001/T137)", async ({
  dispatcherPage: page,
  ownerPage,
}) => {
  const shipment = await register(page);
  expect(shipment.version).toBe(1);
  const staleId = randomUUID();
  const staleInstructions = `T137 borrador anterior ${randomUUID().slice(0, 8)}`;
  const currentInstructions = `T137 versión vigente ${randomUUID().slice(0, 8)}`;
  const editedInstructions = `T137 edición revisada ${randomUUID().slice(0, 8)}`;
  const staleKey = `domy:draft:shipment-edit:${shipment.id}`;
  const staleForm = fromShipment(shipment);
  staleForm.instructions = staleInstructions;
  const staleRaw = JSON.stringify({
    id: staleId,
    values: shipmentDraftValues(staleForm, null, false, shipment.version),
  });

  await page.goto(`/envios/${shipment.trackingNumber}/editar`);
  await expect(page.getByLabel("Indicaciones")).toBeVisible();
  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, value);
    },
    { key: staleKey, value: staleRaw },
  );

  const changedByOwner = await ownerPage.request.patch(`/api/shipments/${shipment.id}`, {
    data: {
      actionId: randomUUID(),
      version: shipment.version,
      instructions: currentInstructions,
    },
  });
  const changedBody: unknown = await changedByOwner.json();
  const changed = shipmentVersionSchema.safeParse(changedBody);
  expect({
    status: changedByOwner.status(),
    versionTwo: changed.success && changed.data.version === 2,
    ownerChangeApplied: changed.success && changed.data.instructions === currentInstructions,
  }).toEqual({ status: 200, versionTwo: true, ownerChangeApplied: true });

  let dispatcherPatchCount = 0;
  const patchVersions: number[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "PATCH" || url.pathname !== `/api/shipments/${shipment.id}`) return;
    dispatcherPatchCount += 1;
    const parsed = shipmentUpdateInput.safeParse(request.postDataJSON());
    if (parsed.success) patchVersions.push(parsed.data.version);
  });

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "El envío cambió desde que guardaste este borrador" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cargar datos actuales" })).toBeDisabled();
  const rawAfterReload = await storedText(page, staleKey);
  const savedStaleDraft = editDraftSchema.safeParse(parseJson(rawAfterReload));
  const staleDraftPreserved =
    rawAfterReload === staleRaw &&
    savedStaleDraft.success &&
    savedStaleDraft.data.id === staleId &&
    savedStaleDraft.data.values.form.instructions === staleInstructions &&
    savedStaleDraft.data.values.baseVersion === 1;
  expect({ staleDraftPreserved, dispatcherPatchCount }).toEqual({
    staleDraftPreserved: true,
    dispatcherPatchCount: 0,
  });
  expect(await accessibilityViolations(page)).toEqual([]);

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia local" }).click();
  const copy = await downloadEvent;
  expect(copy.suggestedFilename()).toBe("domy-cambios-pendientes.txt");
  await page
    .getByLabel(
      "Descargué la copia y entiendo que cargar la versión actual reemplaza el formulario.",
    )
    .check();
  await page.getByRole("button", { name: "Cargar datos actuales" }).click();

  await expect(page.getByLabel("Indicaciones")).toHaveValue(currentInstructions);
  const currentRaw = await storedText(page, staleKey);
  const currentDraft = editDraftSchema.safeParse(parseJson(currentRaw));
  const currentDraftReplacesStaleOnlyAfterChoice =
    currentDraft.success &&
    currentDraft.data.id !== staleId &&
    currentDraft.data.values.baseVersion === 2 &&
    currentDraft.data.values.form.instructions === currentInstructions;
  expect({ currentDraftReplacesStaleOnlyAfterChoice, dispatcherPatchCount }).toEqual({
    currentDraftReplacesStaleOnlyAfterChoice: true,
    dispatcherPatchCount: 0,
  });

  await page.getByLabel("Indicaciones").fill(editedInstructions);
  const updateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/shipments/${shipment.id}`,
  );
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const patch = await updateResponse;
  const updatedBody: unknown = await patch.json();
  const finalShipment = shipmentVersionSchema.safeParse(updatedBody);
  const patchInput = patchVersions[0];
  expect({
    patchStatus: patch.status(),
    patchCount: dispatcherPatchCount,
    patchUsedCurrentVersion: patchInput === 2,
    updatedVersion: finalShipment.success ? finalShipment.data.version : null,
    updatedInstructions:
      finalShipment.success && finalShipment.data.instructions === editedInstructions,
  }).toEqual({
    patchStatus: 200,
    patchCount: 1,
    patchUsedCurrentVersion: true,
    updatedVersion: 3,
    updatedInstructions: true,
  });
});
