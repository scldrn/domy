import { readFileSync } from "node:fs";
import {
  courierRecordKinds,
  exceptionReasons,
  noticeTypes,
  packageSizes,
  paymentModes,
  photoKinds,
  recordFlagKinds,
  recordOutcomes,
  routeEventTypes,
  routeStatuses,
  serviceLevels,
  shipmentEventTypes,
  shipmentKinds,
  shipmentStatuses,
  stopKinds,
  taskStatuses,
} from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { companySettings, recordPhotos } from "../src/db/schema/index.ts";
import { AppError } from "../src/lib/errors.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

const contract = readFileSync(
  new URL("../../../specs/003-courier-app/contracts/http-api.md", import.meta.url),
  "utf8",
);

const instant = z.iso.datetime({ offset: true });
const calendarDay = z.iso.date();
const trackingNumber = z.string().regex(/^[0-9A-Z]{8}$/);
const named = z.object({ id: z.uuid(), name: z.string() }).strict();
const money = z.number().int();

const courierTask = z
  .object({
    id: z.uuid(),
    shipmentId: z.uuid(),
    kind: z.enum(stopKinds),
    status: z.enum(taskStatuses),
    trackingNumber,
    shipmentKind: z.enum(shipmentKinds),
    shipmentStatus: z.enum(shipmentStatuses),
    merchant: named,
    recipientName: z.string().nullable(),
    recipientPhone: z.string().nullable(),
    carrier: named.nullable(),
    destinationTown: z.string().nullable(),
    errandDescription: z.string().nullable(),
    instructions: z.string().nullable(),
    packageCount: z.number().int().positive().nullable(),
    packageSize: z.enum(packageSizes).nullable(),
    windowStart: instant.nullable(),
    windowEnd: instant.nullable(),
    codAmount: money,
    blockedByHandover: z.object({ id: z.uuid(), fromCourier: named }).strict().nullable(),
    problemNote: z.string().nullable(),
  })
  .strict();

const courierStop = z
  .object({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    kind: z.enum(stopKinds),
    address: z.string(),
    neighborhood: named.nullable(),
    contactPhone: z.string().nullable(),
    tasks: z.array(courierTask),
  })
  .strict();

const courierRoute = z
  .object({
    id: z.uuid(),
    number: z.number().int().positive(),
    serviceDate: calendarDay,
    status: z.enum(routeStatuses),
    stops: z.array(courierStop),
  })
  .strict();

const heldShipment = z
  .object({
    shipmentId: z.uuid(),
    trackingNumber,
    status: z.enum(shipmentStatuses),
    serviceDate: calendarDay,
    merchant: named,
    recipientName: z.string().nullable(),
    returnDecided: z.boolean(),
  })
  .strict();

const handoverToGive = z
  .object({
    handoverId: z.uuid(),
    shipmentId: z.uuid(),
    trackingNumber,
    toCourier: named,
  })
  .strict();

const notice = z
  .object({
    id: z.uuid(),
    type: z.enum(noticeTypes),
    routeNumber: z.number().int().positive().nullable(),
    trackingNumber: trackingNumber.nullable(),
    createdAt: instant,
  })
  .strict();

const daySummary = z
  .object({
    date: calendarDay,
    deliveries: z.number().int().nonnegative(),
    exceptions: z.number().int().nonnegative(),
    returns: z.number().int().nonnegative(),
    pendingStops: z.number().int().nonnegative(),
    cash: money,
    companyTransfer: money,
    merchantTransfer: money,
    disbursements: money,
    cashToHandOver: money,
  })
  .strict();

const courierSnapshot = z
  .object({
    serverTime: instant,
    sessionExpiresAt: instant,
    route: courierRoute.nullable(),
    handoversToGive: z.array(handoverToGive),
    heldOffRoute: z.array(heldShipment),
    notices: z.array(notice),
    summary: daySummary,
  })
  .strict();

const courierRecordResults = z
  .object({
    results: z.array(z.object({ id: z.uuid(), outcome: z.enum(recordOutcomes) }).strict()),
  })
  .strict();

const courierRecord = z
  .object({
    id: z.uuid(),
    shipmentId: z.uuid(),
    kind: z.enum(courierRecordKinds),
    outcome: z.enum(recordOutcomes),
    courier: named,
    author: named,
    onBehalf: z.boolean(),
    occurredAt: instant,
    recordedAt: instant,
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        accuracyM: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    receivedByName: z.string().nullable(),
    cashAmount: money,
    companyTransferAmount: money,
    merchantTransferAmount: money,
    exceptionReason: z.enum(exceptionReasons).nullable(),
    note: z.string().nullable(),
    disbursementAmount: money.nullable(),
    payee: z.string().nullable(),
    photos: z.array(
      z.object({ id: z.uuid(), kind: z.enum(photoKinds), uploaded: z.boolean() }).strict(),
    ),
    reverted: z.object({ at: instant, by: named, reason: z.string() }).strict().nullable(),
  })
  .strict();

const shipmentEvent = z
  .object({
    id: z.uuid(),
    type: z.enum(shipmentEventTypes),
    fromStatus: z.enum(shipmentStatuses).nullable(),
    toStatus: z.enum(shipmentStatuses).nullable(),
    actor: named,
    occurredAt: instant,
    recordedAt: instant,
    reason: z.string().nullable(),
    changes: z.record(z.string(), z.tuple([z.unknown(), z.unknown()])).nullable(),
    onBehalf: z.boolean(),
  })
  .strict();

const routeEvent = z
  .object({
    id: z.uuid(),
    type: z.enum(routeEventTypes),
    actor: named,
    occurredAt: instant,
    shipment: z.object({ id: z.uuid(), trackingNumber }).strict().nullable(),
    fromCourier: named.nullable(),
    toCourier: named.nullable(),
    reason: z.string().nullable(),
    changes: z.record(z.string(), z.unknown()).nullable(),
    onBehalf: z.boolean(),
  })
  .strict();

const courierHandover = z
  .object({
    id: z.uuid(),
    shipment: z.object({ id: z.uuid(), trackingNumber }).strict(),
    fromCourier: named,
    toCourier: named,
    fromRouteId: z.uuid().nullable(),
    toRouteId: z.uuid(),
    reason: z.string(),
    status: z.enum(["pending", "confirmed", "cancelled"]),
    requestedBy: named,
    requestedAt: instant,
    resolvedBy: named.nullable(),
    resolvedAt: instant.nullable(),
    resolvedOnBehalf: z.boolean(),
  })
  .strict();

const shipment = z
  .object({
    id: z.uuid(),
    trackingNumber,
    kind: z.enum(shipmentKinds),
    status: z.enum(shipmentStatuses),
    serviceDate: calendarDay,
    merchant: named,
    pickupPointId: z.uuid().nullable(),
    pickupAddress: z.string(),
    pickupNeighborhood: named,
    recipientName: z.string().nullable(),
    recipientPhone: z.string().nullable(),
    recipientAddress: z.string().nullable(),
    recipientNeighborhood: z
      .object({ id: z.uuid(), name: z.string(), municipality: z.string() })
      .strict()
      .nullable(),
    carrier: named.nullable(),
    destinationTown: z.string().nullable(),
    errandDescription: z.string().nullable(),
    rateZone: named.nullable(),
    serviceLevel: z.enum(serviceLevels),
    calculatedFee: money.nullable(),
    fee: money,
    feeOverrideReason: z.string().nullable(),
    feeNeedsReview: z.boolean(),
    paymentMode: z.enum(paymentModes),
    codAmount: money,
    windowStart: z.string().nullable(),
    windowEnd: z.string().nullable(),
    packageSize: z.enum(packageSizes).nullable(),
    packageCount: z.number().int().nullable(),
    merchantReference: z.string().nullable(),
    instructions: z.string().nullable(),
    voidReason: z.string().nullable(),
    version: z.number().int().positive(),
    registeredAt: instant,
    registeredBy: named,
  })
  .strict();

const shipmentRoute = z
  .object({
    id: z.uuid(),
    number: z.number().int().positive(),
    serviceDate: calendarDay,
    status: z.enum(routeStatuses),
    courier: named.nullable(),
  })
  .strict();

const shipmentDetail = shipment
  .extend({
    trackingCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u),
    notifiedAt: instant.nullable(),
    notifiedBy: z.uuid().nullable(),
    heldAtOffice: z.boolean(),
    returnDecided: z.boolean(),
    needsReview: z.boolean(),
    route: shipmentRoute.nullable(),
    custodyCourier: named.nullable(),
    handover: courierHandover.nullable(),
    events: z.array(shipmentEvent),
    records: z.array(courierRecord),
    attempts: z.array(courierRecord),
    recordFlags: z.array(z.enum(recordFlagKinds)),
  })
  .strict();

const routeSummary = z
  .object({
    id: z.uuid(),
    number: z.number().int().positive(),
    serviceDate: calendarDay,
    status: z.enum(routeStatuses),
    courier: named.nullable(),
    completedStops: z.number().int().nonnegative(),
    totalStops: z.number().int().nonnegative(),
    codToCollect: money,
    atRiskCount: z.number().int().nonnegative(),
    lateCount: z.number().int().nonnegative(),
    pendingHandovers: z.number().int().nonnegative(),
    courierLastSyncedAt: instant.nullable(),
    unacknowledgedNotices: z.number().int().nonnegative(),
  })
  .strict();

const routesBoard = z
  .object({
    date: calendarDay,
    serverTime: instant,
    routes: z.array(routeSummary),
    routesFromPreviousDays: z.array(routeSummary),
    unassignedCount: z.number().int().nonnegative(),
  })
  .strict();

const unassignedShipment = z
  .object({
    id: z.uuid(),
    trackingNumber,
    kind: z.enum(shipmentKinds),
    status: z.enum(["registered", "picked_up", "exception"]),
    heldBy: z.union([z.object({ courier: named }).strict(), z.literal("office")]).nullable(),
    serviceDate: calendarDay,
    merchant: named,
    recipientName: z.string().nullable(),
    recipientNeighborhood: named.nullable(),
    rateZone: named.nullable(),
    windowStart: z.string().nullable(),
    windowEnd: z.string().nullable(),
    codAmount: money,
    feeNeedsReview: z.boolean(),
    routeId: z.null(),
    routeNumber: z.null(),
    courier: z.null(),
    recipientPhone: z.string().nullable(),
    merchantReference: z.string().nullable(),
    fee: money,
    registeredAt: instant,
    pickupPoint: z.object({ id: z.uuid(), label: z.string() }).strict().nullable(),
    pickupAddress: z.string(),
    pickupNeighborhood: named,
  })
  .strict();

const companySettingsShape = z
  .object({
    officeAddress: z.string().nullable(),
    officeNeighborhood: named.nullable(),
    supportPhone: z.string().nullable(),
    companyName: z.string(),
  })
  .strict();

const errorBody = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }).strict(),
  })
  .strict();

type CourierErrorCode =
  | "no_exception_to_decide"
  | "not_held_by_courier"
  | "record_not_revertible"
  | "office_not_configured"
  | "photo_immutable"
  | "occurred_in_future";

const errorStatuses = {
  no_exception_to_decide: 409,
  not_held_by_courier: 409,
  record_not_revertible: 409,
  office_not_configured: 409,
  photo_immutable: 409,
  occurred_in_future: 422,
} satisfies Record<CourierErrorCode, number>;

type RoleSession = { cookie: string; userId: string };

let database: TestDatabase;
let storage: TestStorage;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: RoleSession;
let dispatcher: RoleSession;
let ana: CourierAccount;

beforeAll(async () => {
  [database, storage] = await Promise.all([startDatabase(), startStorage()]);
}, 120_000);

afterAll(async () => {
  await Promise.all([database.stop(), storage.stop()]);
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z", storage: storage.storage });
  const ownerAccount = await t.signIn("owner");
  owner = { cookie: ownerAccount.cookie, userId: ownerAccount.user.id };
  catalog = await createCatalog(database.db, owner.userId);
  const dispatcherAccount = await t.signIn("dispatcher");
  dispatcher = { cookie: dispatcherAccount.cookie, userId: dispatcherAccount.user.id };
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
});

async function jsonRequest(
  cookie: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<{ response: Response; body: unknown }> {
  const response = await t.app.request(path, {
    method,
    headers: {
      cookie,
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return {
    response,
    body: await response
      .clone()
      .json()
      .catch(() => null),
  };
}

function documentedEndpoints(): string[] {
  return [...contract.matchAll(/^\| `(GET|POST|PUT|PATCH|DELETE) (\/api\/[^`?\s]+)/gm)].map(
    ([, method, path]) => `${String(method)} ${String(path)}`,
  );
}

function canonicalRoute(method: string, path: string): string {
  const canonicalPath =
    path.length > "/api".length && path.endsWith("/") ? path.slice(0, -1) : path;
  return `${method} ${canonicalPath}`;
}

async function expectContractError(
  response: Response,
  code: CourierErrorCode,
  message = new AppError(code).message,
): Promise<void> {
  expect(response.status, code).toBe(errorStatuses[code]);
  const body = errorBody.parse(await response.json());
  expect(body).toEqual({ error: { code, message } });
}

describe("Courier App HTTP contract", () => {
  it("registers each documented courier endpoint and documents each route in its families", () => {
    const registered = new Set(
      t.app.routes
        .filter((route) => route.method !== "ALL")
        .map((route) => canonicalRoute(route.method, route.path)),
    );
    const documented = documentedEndpoints();
    expect(documented).toHaveLength(17);
    expect(new Set(documented).size).toBe(documented.length);
    expect(documented.filter((endpoint) => !registered.has(endpoint))).toEqual([]);
    const courierPaths = documented.filter((endpoint) =>
      /\s\/api\/(?:courier(?:\/|$)|courier-records\/|photos\/|settings(?:\/|$))/.test(endpoint),
    );
    expect(courierPaths).toHaveLength(13);
    expect(new Set(courierPaths).size).toBe(courierPaths.length);

    const dispatchRecordPaths = documented.filter((endpoint) =>
      /\s\/api\/shipments\/[^/]+\/(?:records|exception-decision|office-receipt|clear-review)$/.test(
        endpoint,
      ),
    );
    expect(dispatchRecordPaths).toHaveLength(4);
    const featurePaths = new Set([...courierPaths, ...dispatchRecordPaths]);
    const registeredCourierPaths = [...registered].filter(
      (endpoint) =>
        /^(?:GET|POST|PUT|PATCH|DELETE) \/api\/(?:courier(?:\/|$)|courier-records\/|photos\/|settings(?:\/|$))/.test(
          endpoint,
        ) ||
        /^(?:GET|POST|PUT|PATCH|DELETE) \/api\/shipments\/[^/]+\/(?:records|exception-decision|office-receipt|clear-review)$/.test(
          endpoint,
        ),
    );
    expect(registeredCourierPaths).toHaveLength(17);
    expect(registeredCourierPaths.filter((endpoint) => !featurePaths.has(endpoint))).toEqual([]);

    const linkPath = "PUT /api/couriers/accounts/:userId";
    expect(contract).toContain("**`PUT /api/couriers/accounts/:userId`** (owner only, new)");
    expect(registered.has(linkPath)).toBe(true);
  });

  it("matches documented error codes and statuses and returns exact JSON bodies", async () => {
    const documentedErrors = [...contract.matchAll(/^\| (\d{3}) \| `([a-z_]+)` \|/gm)].map(
      ([, status, code]) => ({ status: Number(status), code: String(code) }),
    );
    expect(documentedErrors).toEqual(
      Object.entries(errorStatuses).map(([code, status]) => ({ status, code })),
    );

    const unassigned = await registerShipment(t, dispatcher.cookie, catalog);
    const exceptionDecision = await jsonRequest(
      dispatcher.cookie,
      `/api/shipments/${unassigned.id}/exception-decision`,
      "POST",
      { actionId: crypto.randomUUID(), decision: "return" },
    );
    await expectContractError(exceptionDecision.response, "no_exception_to_decide");

    const held = await registerShipment(t, dispatcher.cookie, catalog);
    const extra = await registerShipment(t, dispatcher.cookie, catalog);
    const route = await createRoute(t, dispatcher.cookie, {
      shipmentIds: [held.id, extra.id],
      courierId: ana.id,
    });
    expect((await routeAction(t, dispatcher.cookie, route, "/dispatch")).status).toBe(200);
    const pickupId = crypto.randomUUID();
    const deviceNow = t.now().toISOString();
    const pickedUp = await jsonRequest(ana.cookie, "/api/courier/records", "POST", {
      deviceNow,
      records: [{ id: pickupId, shipmentId: held.id, occurredAt: deviceNow, kind: "pickup" }],
    });
    expect(pickedUp.response.status).toBe(200);

    const officeReceipt = (shipmentId: string) =>
      jsonRequest(dispatcher.cookie, `/api/shipments/${shipmentId}/office-receipt`, "POST", {
        actionId: crypto.randomUUID(),
      });
    await expectContractError((await officeReceipt(held.id)).response, "office_not_configured");

    await database.db.insert(companySettings).values({
      officeAddress: "Carrera 70 # 45-10",
      officeNeighborhoodId: catalog.place.estadio,
    });
    await expectContractError((await officeReceipt(unassigned.id)).response, "not_held_by_courier");

    const revert = await jsonRequest(
      dispatcher.cookie,
      `/api/courier-records/${pickupId}/revert`,
      "POST",
      { actionId: crypto.randomUUID(), reason: "Registro de prueba" },
    );
    await expectContractError(
      revert.response,
      "record_not_revertible",
      "No se puede revertir: hay una operación posterior o el registro ya no es el último aplicado. Revisa el historial antes de continuar.",
    );

    const future = new Date(t.now().getTime() + 60_000).toISOString();
    const futureRecord = await jsonRequest(
      dispatcher.cookie,
      `/api/shipments/${extra.id}/records`,
      "POST",
      {
        id: crypto.randomUUID(),
        kind: "problem",
        note: "Registro que aún no sucede",
        occurredAt: future,
      },
    );
    await expectContractError(futureRecord.response, "occurred_in_future");

    const photoId = crypto.randomUUID();
    const photoRecordId = crypto.randomUUID();
    const photoRecords = await jsonRequest(ana.cookie, "/api/courier/records", "POST", {
      deviceNow,
      records: [
        { id: photoRecordId, shipmentId: extra.id, occurredAt: deviceNow, kind: "pickup" },
        {
          id: crypto.randomUUID(),
          shipmentId: extra.id,
          occurredAt: deviceNow,
          kind: "delivery",
          receivedByName: "Laura Gómez",
          cashAmount: 50_000,
          photos: [{ id: photoId, kind: "proof" }],
        },
      ],
    });
    expect(photoRecords.response.status).toBe(200);
    const imageA = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const imageB = new Uint8Array([0xff, 0xd8, 0x00, 0xd9]);
    const upload = (image: Uint8Array) =>
      t.app.request(`/api/courier/photos/${photoId}`, {
        method: "PUT",
        headers: { cookie: ana.cookie, "content-type": "image/jpeg" },
        body: image,
      });
    expect((await upload(imageA)).status).toBe(204);
    await expectContractError(await upload(imageB), "photo_immutable");
    const [photo] = await database.db
      .select()
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    expect(photo?.uploadedAt).not.toBeNull();
  });

  it("returns exact courier snapshot, record, shipment, route, board and event shapes", async () => {
    const shipment = await registerShipment(t, dispatcher.cookie, catalog);
    const extra = await registerShipment(t, dispatcher.cookie, catalog);
    const unassigned = await registerShipment(t, dispatcher.cookie, catalog);
    const route = await createRoute(t, dispatcher.cookie, {
      shipmentIds: [shipment.id, extra.id],
      courierId: ana.id,
    });
    expect((await routeAction(t, dispatcher.cookie, route, "/dispatch")).status).toBe(200);

    const deviceNow = t.now().toISOString();
    const pickupId = crypto.randomUUID();
    const deliveryId = crypto.randomUUID();
    const results = await jsonRequest(ana.cookie, "/api/courier/records", "POST", {
      deviceNow,
      records: [
        { id: pickupId, shipmentId: shipment.id, occurredAt: deviceNow, kind: "pickup" },
        {
          id: deliveryId,
          shipmentId: shipment.id,
          occurredAt: deviceNow,
          kind: "delivery",
          receivedByName: "Laura Gómez",
          cashAmount: 50_000,
        },
      ],
    });
    expect(results.response.status).toBe(200);
    expect(courierRecordResults.parse(results.body).results).toEqual([
      { id: pickupId, outcome: "applied" },
      { id: deliveryId, outcome: "applied" },
    ]);

    const onBehalf = await jsonRequest(
      dispatcher.cookie,
      `/api/shipments/${extra.id}/records`,
      "POST",
      { id: crypto.randomUUID(), kind: "pickup" },
    );
    expect(onBehalf.response.status).toBe(200);

    const snapshot = await jsonRequest(ana.cookie, "/api/courier/route");
    expect(snapshot.response.status).toBe(200);
    const parsedSnapshot = courierSnapshot.parse(snapshot.body);
    expect(parsedSnapshot.route?.id).toBe(route.id);
    expect(
      parsedSnapshot.route?.stops.flatMap((stop) => stop.tasks).map((task) => task.shipmentId),
    ).toContain(extra.id);

    const unassignedResponse = await jsonRequest(
      dispatcher.cookie,
      "/api/shipments/unassigned?date=2026-10-01",
    );
    expect(unassignedResponse.response.status).toBe(200);
    const unassignedBody = z
      .object({ shipments: z.array(unassignedShipment) })
      .strict()
      .parse(unassignedResponse.body);
    expect(unassignedBody.shipments.map((item) => item.id)).toContain(unassigned.id);

    const boardResponse = await jsonRequest(dispatcher.cookie, "/api/routes/board?date=2026-10-01");
    expect(boardResponse.response.status).toBe(200);
    const board = routesBoard.parse(boardResponse.body);
    expect(board.routes.map((item) => item.id)).toContain(route.id);
    expect(board.routes.find((item) => item.id === route.id)?.courierLastSyncedAt).not.toBeNull();

    const detailBeforeRevert = await jsonRequest(
      dispatcher.cookie,
      `/api/shipments/${shipment.id}`,
    );
    expect(detailBeforeRevert.response.status).toBe(200);
    const detail = shipmentDetail.parse(detailBeforeRevert.body);
    expect(/^[A-Za-z0-9_-]{22}$/u.test(detail.trackingCode)).toBe(true);
    expect(detail.notifiedAt).toBeNull();
    expect(detail.notifiedBy).toBeNull();
    expect(detail.records.map((record) => record.id)).toEqual([pickupId, deliveryId]);
    expect(detail.events.every((event) => !event.onBehalf)).toBe(true);

    const onBehalfDetail = shipmentDetail.parse(
      (await jsonRequest(dispatcher.cookie, `/api/shipments/${extra.id}`)).body,
    );
    expect(
      onBehalfDetail.records.some((record) => record.kind === "pickup" && record.onBehalf),
    ).toBe(true);
    expect(onBehalfDetail.events.some((event) => event.onBehalf)).toBe(true);

    const reverted = await jsonRequest(
      dispatcher.cookie,
      `/api/courier-records/${deliveryId}/revert`,
      "POST",
      { actionId: crypto.randomUUID(), reason: "Entrega revertida para prueba" },
    );
    expect(reverted.response.status).toBe(200);
    const afterRevert = shipmentDetail.parse(
      (await jsonRequest(dispatcher.cookie, `/api/shipments/${shipment.id}`)).body,
    );
    expect(afterRevert.records.find((record) => record.id === deliveryId)?.reverted).not.toBeNull();
    expect(afterRevert.events.map((event) => event.type)).toContain("record_reverted");
    expect(afterRevert.events.every((event) => !event.onBehalf)).toBe(true);

    const updatedRoute = await jsonRequest(dispatcher.cookie, `/api/routes/${route.id}`);
    expect(updatedRoute.response.status).toBe(200);
    const routeEvents = z
      .looseObject({ events: z.array(routeEvent) })
      .parse(updatedRoute.body).events;
    expect(routeEvents.map((event) => event.type)).toContain("record_reverted");
  });

  it("returns the exact CompanySettings shape and audits the owner's update", async () => {
    const initial = await jsonRequest(dispatcher.cookie, "/api/settings");
    expect(initial.response.status).toBe(200);
    expect(companySettingsShape.parse(initial.body)).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: null,
      companyName: "Cohex",
    });

    const input = {
      actionId: crypto.randomUUID(),
      officeAddress: "Carrera 70 # 45-10",
      officeNeighborhoodId: catalog.place.estadio,
    };
    const updated = await jsonRequest(owner.cookie, "/api/settings", "PATCH", input);
    expect(updated.response.status).toBe(200);
    expect(companySettingsShape.parse(updated.body)).toEqual({
      officeAddress: input.officeAddress,
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: null,
      companyName: "Cohex",
    });
  });
});
