import type { Shipment } from "@domy/domain";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

const publicObject = z.record(z.string(), z.unknown());
const allowedTrackingFields = new Set([
  "merchantName",
  "trackingNumber",
  "kind",
  "serviceDate",
  "window",
  "support",
  "neighborhood",
  "carrierName",
  "destinationTown",
  "statusText",
  "reasonText",
  "deliveriesBefore",
  "courier",
  "amountToPay",
  "deliveredTo",
  "deliveredAt",
  "expired",
]);

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let ownerCookie: string;
let dispatcherCookie: string;
let ana: CourierAccount;

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  const owner = await t.signIn("owner");
  ownerCookie = owner.cookie;
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcherCookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
});

async function trackingCode(shipmentId: string): Promise<string> {
  const [row] = await database.db
    .select({ trackingCode: shipments.trackingCode })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  if (!row) throw new Error("The fixture shipment is missing");
  return row.trackingCode;
}

async function publicResponse(code: string): Promise<{ status: number; body: unknown }> {
  const response = await t.app.request(`/api/public/tracking/${encodeURIComponent(code)}`);
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function publicTracking(
  shipmentId: string,
  expectedExpired = false,
): Promise<Record<string, unknown>> {
  const response = await publicResponse(await trackingCode(shipmentId));
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  const view = publicObject.parse(response.body);
  expect(view).toHaveProperty("support");
  expect(view.expired).toBe(expectedExpired);
  if (!expectedExpired) expect(view).toHaveProperty("statusText");
  return view;
}

function assertOnlyTrackingFields(view: Record<string, unknown>): void {
  expect(Object.keys(view).every((key) => allowedTrackingFields.has(key))).toBe(true);
}

function assertNoPrivateShipmentData(
  view: Record<string, unknown>,
  forbiddenValues: string[],
): void {
  assertOnlyTrackingFields(view);
  for (const field of [
    "recipientName",
    "recipientPhone",
    "recipientAddress",
    "pickupAddress",
    "fee",
    "codAmount",
    "merchantReference",
    "instructions",
    "voidReason",
    "events",
    "attempts",
    "history",
    "photos",
    "route",
    "routeId",
    "shipments",
  ]) {
    expect(view).not.toHaveProperty(field);
  }
  const serialized = JSON.stringify(view);
  for (const value of forbiddenValues) expect(serialized).not.toContain(value);
}

async function configureSupport(): Promise<void> {
  const response = await send(
    t,
    ownerCookie,
    "/api/settings",
    {
      actionId: crypto.randomUUID(),
      companyName: "Cohex",
      supportPhone: "3009876543",
    },
    "PATCH",
  );
  expect(response.status, JSON.stringify(response.body)).toBe(200);
}

async function register(overrides: Record<string, unknown> = {}): Promise<Shipment> {
  return registerShipment(t, dispatcherCookie, catalog, {
    recipientName: "DESTINATARIO-PRIVADO",
    recipientPhone: "3195550199",
    recipientAddress: "DIRECCION-PRIVADA-CALLE-99",
    codAmount: 85000,
    paymentMode: "cash_on_delivery",
    window: { preset: "before", end: "11:00" },
    ...overrides,
  });
}

async function registerErrand(): Promise<{ id: string }> {
  const response = await t.request("/api/shipments", {
    method: "POST",
    cookie: dispatcherCookie,
    body: {
      id: crypto.randomUUID(),
      kind: "errand",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      errandDescription: "Pagar un recibo en el banco",
      paymentMode: "merchant_account",
      fee: 20000,
      feeOverrideReason: "Diligencia acordada con el comercio",
    },
  });
  const body: unknown = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  return { id: z.object({ id: z.uuid() }).parse(body).id };
}

async function dispatch(shipmentIds: string[]) {
  const route = await createRoute(t, dispatcherCookie, {
    shipmentIds,
    courierId: ana.id,
  });
  const result = await routeAction(t, dispatcherCookie, route, "/dispatch");
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body;
}

async function courierRecord(
  shipmentId: string,
  kind: string,
  fields: Record<string, unknown> = {},
  id = crypto.randomUUID(),
): Promise<string> {
  const result = await sendRecords(t, ana, [{ id, shipmentId, kind, ...fields }]);
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(result.body.results).toEqual([{ id, outcome: "applied" }]);
  return id;
}

function expectNoCourierOrQueue(view: Record<string, unknown>): void {
  expect(view).not.toHaveProperty("courier");
  expect(view.deliveriesBefore ?? null).toBeNull();
}

describe("GET /api/public/tracking/:code (004/T011, US1 scenarios 1–8)", () => {
  it("projects registered, assigned, dispatched and picked-up delivery stages anonymously", async () => {
    const target = await register();
    const earlier = await Promise.all([register(), register(), register()]);

    const registered = await publicTracking(target.id);
    expect(registered).toMatchObject({
      merchantName: "Bullish Hype",
      trackingNumber: target.trackingNumber,
      kind: "delivery",
      serviceDate: "2026-10-01",
      expired: false,
      statusText: "Recibimos tu envío",
      support: { companyName: "Cohex", phone: null },
      neighborhood: "Laureles",
      window: { start: null, end: "2026-10-01T16:00:00.000Z" },
    });
    expect(JSON.stringify(registered)).not.toContain("3009876543");
    assertNoPrivateShipmentData(registered, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "Cra 70 # 45-10",
    ]);

    const route = await createRoute(t, dispatcherCookie, {
      shipmentIds: [...earlier.map((shipment) => shipment.id), target.id],
      courierId: ana.id,
    });
    const assigned = await publicTracking(target.id);
    expect(assigned.statusText).toBe("Recibimos tu envío");
    expectNoCourierOrQueue(assigned);
    const dispatchResult = await routeAction(t, dispatcherCookie, route, "/dispatch");
    expect(dispatchResult.status, JSON.stringify(dispatchResult.body)).toBe(200);

    const dispatched = await publicTracking(target.id);
    expect(dispatched).toMatchObject({
      statusText: "Tu envío va a ser recogido",
      courier: { firstName: "Ana", phone: "3004445566" },
    });
    expect(dispatched.amountToPay).toBe(85000);
    expect(dispatched.deliveriesBefore ?? null).toBeNull();
    assertNoPrivateShipmentData(dispatched, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "Cra 70 # 45-10",
      ...earlier.map((shipment) => shipment.trackingNumber),
    ]);

    t.setNow("2026-10-01T15:01:00Z");
    await courierRecord(target.id, "pickup");
    const pickedUp = await publicTracking(target.id);
    expect(pickedUp).toMatchObject({
      statusText: "En camino",
      deliveriesBefore: 3,
      courier: { firstName: "Ana", phone: "3004445566" },
      amountToPay: 85000,
    });
    assertNoPrivateShipmentData(pickedUp, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      ...earlier.map((shipment) => shipment.trackingNumber),
    ]);
  });

  it("uses the effective received-by record, expires after its final time, and reverts to current", async () => {
    await configureSupport();
    const target = await register();
    const pending = await register();
    const route = await dispatch([target.id, pending.id]);
    await courierRecord(target.id, "pickup");

    t.setNow("2026-10-01T15:05:00Z");
    const deliveryRecordId = crypto.randomUUID();
    await courierRecord(
      target.id,
      "delivery",
      { receivedByName: "RECIBIO-EL-PAQUETE", cashAmount: target.codAmount },
      deliveryRecordId,
    );

    const delivered = await publicTracking(target.id);
    expect(delivered).toMatchObject({
      statusText: expect.stringContaining("RECIBIO-EL-PAQUETE"),
      deliveredTo: "RECIBIO-EL-PAQUETE",
      deliveredAt: expect.any(String),
      support: { companyName: "Cohex", phone: "3009876543" },
    });
    expect(delivered).not.toHaveProperty("courier");
    expect(delivered.amountToPay ?? null).toBeNull();
    assertNoPrivateShipmentData(delivered, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "3004445566",
      "Cra 70 # 45-10",
    ]);
    expect(JSON.stringify(delivered)).toContain("3009876543");

    t.setNow("2026-10-08T15:05:01Z");
    const expired = await publicTracking(target.id, true);
    expect(Object.keys(expired).sort()).toEqual(["expired", "support"]);
    expect(expired.expired).toBe(true);
    expect(JSON.stringify(expired)).toContain("3009876543");
    expect(JSON.stringify(expired)).not.toContain("RECIBIO-EL-PAQUETE");
    expect(JSON.stringify(expired)).not.toContain(target.trackingNumber);
    expect(JSON.stringify(expired)).not.toContain("DESTINATARIO-PRIVADO");

    const reverted = await send(
      t,
      dispatcherCookie,
      `/api/courier-records/${deliveryRecordId}/revert`,
      {
        actionId: crypto.randomUUID(),
        reason: "La entrega se reportó por equivocación",
      },
    );
    expect(reverted.status, JSON.stringify(reverted.body)).toBe(200);

    const currentAgain = await publicTracking(target.id);
    expect(currentAgain.statusText).toBe("En camino");
    expect(currentAgain).not.toHaveProperty("deliveredTo");
    expect(currentAgain).not.toHaveProperty("deliveredAt");
    expect(currentAgain.expired).toBe(false);
    expect(currentAgain).toMatchObject({
      courier: { firstName: "Ana", phone: "3004445566" },
      deliveriesBefore: 0,
    });
    expect(JSON.stringify(currentAgain)).not.toContain("RECIBIO-EL-PAQUETE");
    expect(route.status).toBe("in_progress");
  });

  it("uses a corrected receiver but keeps the original delivery time for expiry", async () => {
    await configureSupport();
    const target = await register();
    await dispatch([target.id]);
    await courierRecord(target.id, "pickup");
    t.setNow("2026-10-01T15:05:00Z");
    const recordId = crypto.randomUUID();
    await courierRecord(
      target.id,
      "delivery",
      { receivedByName: "RECEPTOR-ANTES", cashAmount: target.codAmount },
      recordId,
    );

    t.setNow("2026-10-03T09:00:00Z");
    const correction = await send(t, dispatcherCookie, `/api/courier-records/${recordId}/correct`, {
      actionId: crypto.randomUUID(),
      reason: "Se corrigió el nombre de quien recibió",
      receivedByName: "RECEPTOR-CORREGIDO",
    });
    expect(correction.status, JSON.stringify(correction.body)).toBe(200);

    const delivered = await publicTracking(target.id);
    expect(delivered).toMatchObject({
      deliveredTo: "RECEPTOR-CORREGIDO",
      deliveredAt: "2026-10-01T15:05:00.000Z",
    });

    t.setNow("2026-10-08T15:05:01Z");
    const expired = await publicTracking(target.id, true);
    expect(Object.keys(expired).sort()).toEqual(["expired", "support"]);
    expect(JSON.stringify(expired)).not.toContain("RECEPTOR-CORREGIDO");
  });

  it("uses the re-delivery after a revert even when its occurred time is earlier", async () => {
    const target = await register();
    await dispatch([target.id]);
    t.setNow("2026-10-01T15:01:00Z");
    await courierRecord(target.id, "pickup");

    t.setNow("2026-10-01T15:05:00Z");
    const firstRecordId = crypto.randomUUID();
    await courierRecord(
      target.id,
      "delivery",
      { receivedByName: "RECEPTOR-REVERSADO", cashAmount: target.codAmount },
      firstRecordId,
    );
    const reverted = await send(
      t,
      dispatcherCookie,
      `/api/courier-records/${firstRecordId}/revert`,
      {
        actionId: crypto.randomUUID(),
        reason: "La primera entrega se reportó por equivocación",
      },
    );
    expect(reverted.status, JSON.stringify(reverted.body)).toBe(200);

    t.setNow("2026-10-01T15:06:00Z");
    await courierRecord(target.id, "delivery", {
      receivedByName: "RECEPTOR-VIGENTE",
      cashAmount: target.codAmount,
      occurredAt: "2026-10-01T15:04:00.000Z",
    });

    const delivered = await publicTracking(target.id);
    expect(delivered).toMatchObject({
      deliveredTo: "RECEPTOR-VIGENTE",
      deliveredAt: "2026-10-01T15:04:00.000Z",
    });
    expect(JSON.stringify(delivered)).not.toContain("RECEPTOR-REVERSADO");

    t.setNow("2026-10-08T15:04:01Z");
    const expired = await publicTracking(target.id, true);
    expect(Object.keys(expired).sort()).toEqual(["expired", "support"]);
    expect(JSON.stringify(expired)).not.toContain("RECEPTOR-REVERSADO");
    expect(JSON.stringify(expired)).not.toContain("RECEPTOR-VIGENTE");
  });

  it("shows an exception, an office return decision, and an actual returned record", async () => {
    await configureSupport();
    const target = await register();
    const pending = await register();
    const route = await dispatch([target.id, pending.id]);
    await courierRecord(target.id, "pickup");
    t.setNow("2026-10-01T15:02:00Z");
    await courierRecord(target.id, "exception", { reason: "recipient_absent" });

    const exception = await publicTracking(target.id);
    expect(exception).toMatchObject({
      statusText: "No pudimos entregar tu envío",
      reasonText: "No encontramos a nadie",
    });
    expectNoCourierOrQueue(exception);
    expect(JSON.stringify(exception)).toContain("3009876543");
    assertNoPrivateShipmentData(exception, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "3004445566",
    ]);

    const decision = await send(
      t,
      dispatcherCookie,
      `/api/shipments/${target.id}/exception-decision`,
      { actionId: crypto.randomUUID(), decision: "return", routeId: route.id },
    );
    expect(decision.status, JSON.stringify(decision.body)).toBe(200);
    const returnDecided = await publicTracking(target.id);
    expect(returnDecided.statusText).toBe("Tu envío será devuelto al remitente");
    expect(returnDecided).not.toHaveProperty("reasonText");
    expectNoCourierOrQueue(returnDecided);

    t.setNow("2026-10-01T15:04:00Z");
    const returnRecordId = crypto.randomUUID();
    await courierRecord(
      target.id,
      "return",
      { receivedByName: "COMERCIO-RECIBE-REAL" },
      returnRecordId,
    );
    const returned = await publicTracking(target.id);
    expect(returned.statusText).toBe("Devuelto al remitente");
    expect(returned).not.toHaveProperty("courier");
    expect(returned.amountToPay ?? null).toBeNull();
    expect(JSON.stringify(returned)).toContain("3009876543");
    assertNoPrivateShipmentData(returned, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "3004445566",
    ]);

    const reverted = await send(
      t,
      dispatcherCookie,
      `/api/courier-records/${returnRecordId}/revert`,
      {
        actionId: crypto.randomUUID(),
        reason: "La devolución se reportó por equivocación",
      },
    );
    expect(reverted.status, JSON.stringify(reverted.body)).toBe(200);

    t.setNow("2026-10-08T15:04:01Z");
    const current = await publicTracking(target.id);
    expect(current).toMatchObject({
      expired: false,
      statusText: "Tu envío será devuelto al remitente",
    });
    expect(current).not.toHaveProperty("deliveredTo");
    expect(current).not.toHaveProperty("deliveredAt");
  });

  it("keeps retry wording when an office-held shipment is assigned again", async () => {
    const settings = await send(
      t,
      ownerCookie,
      "/api/settings",
      {
        actionId: crypto.randomUUID(),
        officeAddress: "Calle de la oficina 123",
        officeNeighborhoodId: catalog.place.laureles,
      },
      "PATCH",
    );
    expect(settings.status, JSON.stringify(settings.body)).toBe(200);

    const target = await register();
    const pending = await register();
    await dispatch([target.id, pending.id]);
    await courierRecord(target.id, "pickup");
    t.setNow("2026-10-01T15:02:00Z");
    await courierRecord(target.id, "exception", { reason: "recipient_absent" });

    const receipt = await send(t, dispatcherCookie, `/api/shipments/${target.id}/office-receipt`, {
      actionId: crypto.randomUUID(),
    });
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(200);

    const retry = await send(
      t,
      dispatcherCookie,
      `/api/shipments/${target.id}/exception-decision`,
      { actionId: crypto.randomUUID(), decision: "new_attempt" },
    );
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);

    const assignedRoute = await createRoute(t, dispatcherCookie, {
      shipmentIds: [target.id],
      courierId: ana.id,
    });
    expect(assignedRoute.status).toBe("draft");
    const [shipmentState] = await database.db
      .select({ status: shipments.status })
      .from(shipments)
      .where(eq(shipments.id, target.id));
    expect(shipmentState?.status).toBe("assigned");

    const assigned = await publicTracking(target.id);
    expect(assigned.statusText).toMatch(/^Reprogramado para /u);
    expect(assigned.statusText).toContain("1 de octubre de 2026");
  });

  it("counts a reverse pickup only before pickup, then removes its queue", async () => {
    const earlier = await Promise.all([register(), register()]);
    const reverse = await register({ kind: "reverse_pickup" });
    const route = await createRoute(t, dispatcherCookie, {
      shipmentIds: [...earlier.map((shipment) => shipment.id), reverse.id],
      courierId: ana.id,
    });
    const earlierIds = new Set(earlier.map((shipment) => shipment.id));
    const reversePickup = route.stops.find(
      (stop) =>
        stop.kind === "pickup" &&
        stop.tasks.some((task) => task.shipmentId === reverse.id && task.kind === "pickup"),
    );
    if (!reversePickup) throw new Error("The reverse pickup stop is missing");
    const priorDeliveries = route.stops.filter(
      (stop) =>
        stop.kind === "delivery" &&
        stop.tasks.some((task) => earlierIds.has(task.shipmentId) && task.kind === "delivery"),
    );
    const firstStops = [
      ...route.stops.filter((stop) => stop.kind === "pickup" && stop.id !== reversePickup.id),
      ...priorDeliveries,
      reversePickup,
    ];
    const orderedIds = [
      ...firstStops.map((stop) => stop.id),
      ...route.stops
        .filter((stop) => !firstStops.some((first) => first.id === stop.id))
        .map((stop) => stop.id),
    ];
    const reordered = await routeAction(
      t,
      dispatcherCookie,
      route,
      "/stop-order",
      { stopIds: orderedIds },
      "PUT",
    );
    expect(reordered.status, JSON.stringify(reordered.body)).toBe(200);
    const dispatchedRoute = await routeAction(t, dispatcherCookie, reordered.body, "/dispatch");
    expect(dispatchedRoute.status, JSON.stringify(dispatchedRoute.body)).toBe(200);

    const dispatched = await publicTracking(reverse.id);
    expect(dispatched).toMatchObject({
      kind: "reverse_pickup",
      statusText: "Recogeremos el paquete en tu dirección",
      deliveriesBefore: 2,
      courier: { firstName: "Ana", phone: "3004445566" },
    });

    t.setNow("2026-10-01T15:01:00Z");
    await courierRecord(reverse.id, "pickup");
    const pickedUp = await publicTracking(reverse.id);
    expect(pickedUp.statusText).toBe("En camino al remitente");
    expect(pickedUp.deliveriesBefore ?? null).toBeNull();
    expect(pickedUp).toMatchObject({ courier: { firstName: "Ana", phone: "3004445566" } });
    expect(dispatchedRoute.body.status).toBe("in_progress");
  });

  it("keeps carrier and town visible at every non-expired stage", async () => {
    const handoff = await register({
      kind: "carrier_handoff",
      recipientNeighborhoodId: catalog.place.terminalNorte,
      carrierId: catalog.carrier,
      destinationTown: "Santa Rosa de Osos",
      fee: 15000,
      paymentMode: "merchant_account",
      codAmount: 0,
    });

    const registered = await publicTracking(handoff.id);
    expect(registered).toMatchObject({
      carrierName: "Coonorte",
      destinationTown: "Santa Rosa de Osos",
    });
    expect(registered.neighborhood ?? null).toBeNull();

    const route = await createRoute(t, dispatcherCookie, {
      shipmentIds: [handoff.id],
      courierId: ana.id,
    });
    const assigned = await publicTracking(handoff.id);
    expect(assigned).toMatchObject({
      carrierName: "Coonorte",
      destinationTown: "Santa Rosa de Osos",
    });
    expect(assigned.neighborhood ?? null).toBeNull();

    const dispatchedRoute = await routeAction(t, dispatcherCookie, route, "/dispatch");
    expect(dispatchedRoute.status, JSON.stringify(dispatchedRoute.body)).toBe(200);
    const dispatched = await publicTracking(handoff.id);
    expect(dispatched).toMatchObject({
      carrierName: "Coonorte",
      destinationTown: "Santa Rosa de Osos",
    });
    expect(dispatched.neighborhood ?? null).toBeNull();

    t.setNow("2026-10-01T15:01:00Z");
    await courierRecord(handoff.id, "pickup");
    const pickedUp = await publicTracking(handoff.id);
    expect(pickedUp).toMatchObject({
      carrierName: "Coonorte",
      destinationTown: "Santa Rosa de Osos",
    });
    expect(pickedUp.neighborhood ?? null).toBeNull();

    t.setNow("2026-10-01T15:02:00Z");
    await courierRecord(handoff.id, "delivery", { receivedByName: "RECIBE-COONORTE" });
    const delivered = await publicTracking(handoff.id);
    expect(delivered).toMatchObject({
      carrierName: "Coonorte",
      destinationTown: "Santa Rosa de Osos",
      statusText: "Entregado a la transportadora Coonorte para Santa Rosa de Osos",
      deliveredTo: "Coonorte para Santa Rosa de Osos",
    });
    expect(delivered.neighborhood ?? null).toBeNull();
    expect(delivered).not.toHaveProperty("courier");
    assertNoPrivateShipmentData(delivered, [
      "DESTINATARIO-PRIVADO",
      "3195550199",
      "DIRECCION-PRIVADA-CALLE-99",
      "3004445566",
      "RECIBE-COONORTE",
    ]);
  });

  it("uses errand wording without exposing a delivery queue", async () => {
    const errand = await registerErrand();
    const scheduled = await publicTracking(errand.id);
    expect(scheduled).toMatchObject({ kind: "errand", statusText: "Programada" });
    expect(scheduled.deliveriesBefore ?? null).toBeNull();

    await dispatch([errand.id]);
    const inProgress = await publicTracking(errand.id);
    expect(inProgress).toMatchObject({ kind: "errand", statusText: "En curso" });
    expect(inProgress.deliveriesBefore ?? null).toBeNull();

    t.setNow("2026-10-01T15:01:00Z");
    await courierRecord(errand.id, "delivery", { note: "Recibo pagado" });
    const completed = await publicTracking(errand.id);
    expect(completed).toMatchObject({ kind: "errand", statusText: "Realizada" });
    expect(completed.deliveriesBefore ?? null).toBeNull();
    expect(completed).not.toHaveProperty("courier");
  });

  it("shows a voided shipment without courier or payment and expires it to support only", async () => {
    await configureSupport();
    const shipment = await register();
    const voided = await send(t, dispatcherCookie, `/api/shipments/${shipment.id}/void`, {
      actionId: crypto.randomUUID(),
      version: shipment.version,
      reason: "El comercio canceló el envío",
    });
    expect(voided.status, JSON.stringify(voided.body)).toBe(200);

    const view = await publicTracking(shipment.id);
    expect(view.statusText).toBe("Este envío fue anulado");
    expect(view).not.toHaveProperty("courier");
    expect(view.amountToPay ?? null).toBeNull();
    expect(view).not.toHaveProperty("voidReason");
    expect(JSON.stringify(view)).toContain("3009876543");

    t.setNow("2026-10-09T15:00:01Z");
    const expired = await publicTracking(shipment.id, true);
    expect(Object.keys(expired).sort()).toEqual(["expired", "support"]);
    expect(expired.expired).toBe(true);
  });

  it("returns one anonymous link-not-valid response for unrelated unknown codes", async () => {
    const shipment = await register();
    const existingCode = await trackingCode(shipment.id);
    const changedFirstCharacter = existingCode[0] === "A" ? "B" : "A";
    const nearMiss = `${changedFirstCharacter}${existingCode.slice(1)}`;
    const randomUnknown =
      existingCode === "AAAAAAAAAAAAAAAAAAAAAA"
        ? "BBBBBBBBBBBBBBBBBBBBBB"
        : "AAAAAAAAAAAAAAAAAAAAAA";

    const first = await publicResponse(nearMiss);
    const second = await publicResponse(randomUnknown);
    const malformedAlphabet = await publicResponse(`${"A".repeat(21)}!`);
    const malformedLength = await publicResponse("not-a-valid-code");
    expect(first).toEqual(second);
    expect(malformedAlphabet).toEqual(first);
    expect(malformedLength).toEqual(first);
    expect(first).toMatchObject({
      status: 404,
      body: {
        error: {
          code: "link_not_found",
          message: "Este enlace no es válido",
        },
      },
    });
  });
});
