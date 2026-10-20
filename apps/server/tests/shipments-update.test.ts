import type { Shipment, ShipmentDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { neighborhoods, rateCardEntries, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { placeOnRoute } from "./setup/routes.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string; user: { id: string } };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
});

async function register(overrides: Record<string, unknown> = {}): Promise<Shipment> {
  const response = await t.request("/api/shipments", {
    method: "POST",
    cookie: dispatcher.cookie,
    body: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: catalog.place.laureles,
      paymentMode: "merchant_account",
      fee: 13000,
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Shipment;
}

async function send(
  path: string,
  body: Record<string, unknown>,
  { method = "POST", cookie = dispatcher.cookie } = {},
) {
  const response = await t.request(path, { method, cookie, body });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body: json };
}

function edit(
  shipment: Shipment,
  changes: Record<string, unknown>,
  actionId = crypto.randomUUID(),
) {
  return send(
    `/api/shipments/${shipment.id}`,
    { actionId, version: shipment.version, ...changes },
    { method: "PATCH" },
  );
}

async function edited(shipment: Shipment, changes: Record<string, unknown>): Promise<Shipment> {
  const result = await edit(shipment, changes);
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body as unknown as Shipment;
}

function voidShipment(shipment: Shipment, reason: string, actionId = crypto.randomUUID()) {
  return send(`/api/shipments/${shipment.id}/void`, {
    actionId,
    version: shipment.version,
    reason,
  });
}

async function detail(shipment: Shipment): Promise<ShipmentDetail> {
  const response = await t.request(`/api/shipments/${shipment.id}`, { cookie: dispatcher.cookie });
  return (await response.json()) as ShipmentDetail;
}

async function setStatus(shipment: Shipment, status: Shipment["status"]) {
  if (status === "assigned" || status === "dispatched" || status === "picked_up") {
    await placeOnRoute(database.db, shipment.id, status, shipment.registeredBy.id);
    return;
  }
  await database.db.update(shipments).set({ status }).where(eq(shipments.id, shipment.id));
}

describe("PATCH /api/shipments/:id", () => {
  it("recalculates the fee with the rate card in force at registration (scenario 1)", async () => {
    const shipment = await register();
    // A new rate for Bello–Itagüí takes effect after the shipment was registered.
    await database.db.insert(rateCardEntries).values({
      id: crypto.randomUUID(),
      kind: "zone_rate",
      amount: 16000,
      rateZoneId: catalog.zone.belloItagui,
      effectiveFrom: new Date("2026-10-01T16:00:00Z"),
      createdBy: owner.user.id,
    });
    t.setNow("2026-10-01T17:00:00Z");

    // The edit form quotes with the registration time.
    const quote = (registeredAt?: string) =>
      send("/api/shipments/fee-quote", {
        merchantId: catalog.merchant.bullish,
        kind: "delivery",
        neighborhoodId: catalog.place.itagui,
        serviceLevel: "standard",
        ...(registeredAt && { registeredAt }),
      });
    expect((await quote()).body.calculatedFee).toBe(16000);
    expect((await quote(shipment.registeredAt)).body.calculatedFee).toBe(15000);

    const updated = await edited(shipment, {
      recipientNeighborhoodId: catalog.place.itagui,
      fee: 15000,
    });
    expect(updated).toMatchObject({
      calculatedFee: 15000,
      fee: 15000,
      rateZone: { id: catalog.zone.belloItagui },
      recipientNeighborhood: { id: catalog.place.itagui },
      version: shipment.version + 1,
    });

    const { events } = await detail(shipment);
    const event = events.find((e) => e.type === "updated");
    expect(event).toMatchObject({
      actor: { id: dispatcher.user.id, name: "John Coordinador" },
      occurredAt: "2026-10-01T17:00:00.000Z",
      changes: {
        // Identifiers are shown by name.
        recipientNeighborhoodId: ["Laureles", "Itagüí"],
        rateZoneId: ["Medellín", "Bello–Itagüí"],
        calculatedFee: [13000, 15000],
        fee: [13000, 15000],
      },
    });
  });

  it("recalculates without a fee in the request and changes only what was sent", async () => {
    const shipment = await register({ merchantReference: "PED-1" });
    const updated = await edited(shipment, { recipientNeighborhoodId: catalog.place.itagui });
    expect(updated).toMatchObject({ fee: 15000, merchantReference: "PED-1" });
  });

  it("preserves historical fee and rate-zone snapshots on non-pricing edits (T147)", async () => {
    const shipment = await register({
      instructions: "Timbre 101",
      fee: 12000,
      feeOverrideReason: "Descuento inicial",
    });
    expect(shipment.fee).toBe(12000);
    expect(shipment.calculatedFee).toBe(13000);
    expect(shipment.rateZone?.id).toBe(catalog.zone.medellin);

    // 1. Move the neighborhood to another rate zone in the catalog.
    await database.db
      .update(neighborhoods)
      .set({ rateZoneId: catalog.zone.belloItagui })
      .where(eq(neighborhoods.id, catalog.place.laureles));

    // 2. Also add a new rate card entry with higher rate.
    await database.db.insert(rateCardEntries).values({
      id: crypto.randomUUID(),
      kind: "zone_rate",
      amount: 19000,
      rateZoneId: catalog.zone.belloItagui,
      effectiveFrom: new Date("2026-10-01T14:00:00Z"),
      createdBy: owner.user.id,
    });

    // 3. Edit ONLY instructions.
    const updated = await edited(shipment, { instructions: "Dejar en portería" });

    // Assert: snapshots must remain completely intact.
    expect(updated.instructions).toBe("Dejar en portería");
    expect(updated.fee).toBe(12000);
    expect(updated.calculatedFee).toBe(13000);
    expect(updated.feeOverrideReason).toBe("Descuento inicial");
    expect(updated.rateZone?.id).toBe(catalog.zone.medellin);

    // Assert audit: only instructions changed!
    const { events } = await detail(shipment);
    const event = events.find((e) => e.type === "updated");
    expect(event).toBeDefined();
    expect(event?.changes).toEqual({
      instructions: ["Timbre 101", "Dejar en portería"],
    });
  });

  it("refuses to edit or void a picked-up shipment (scenario 2)", async () => {
    const shipment = await register();
    await setStatus(shipment, "picked_up");
    const editing = await edit(shipment, { recipientAddress: "Calle 11 # 40-10" });
    expect(editing.status).toBe(409);
    expect(editing.body).toMatchObject({
      error: { code: "invalid_transition", message: expect.stringContaining("recogido") },
    });
    expect((await voidShipment(shipment, "Cliente canceló")).status).toBe(409);
  });

  it("allows editing assigned and dispatched shipments (FR-015)", async () => {
    const shipment = await register();
    await setStatus(shipment, "dispatched");
    const updated = await edited(shipment, { instructions: "Llamar al llegar" });
    expect(updated.instructions).toBe("Llamar al llegar");
  });

  it("refuses a stale version without changing anything (scenario 4)", async () => {
    const shipment = await register();
    await edited(shipment, { recipientAddress: "Calle 11 # 40-10" });
    const stale = await edit(shipment, { recipientAddress: "Calle 12 # 40-10" });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: { code: "version_conflict" } });
    expect((await detail(shipment)).recipientAddress).toBe("Calle 11 # 40-10");
  });

  it("discards an earlier override when the rate zone changes (scenario 5)", async () => {
    const shipment = await register({ fee: 12000, feeOverrideReason: "Descuento acordado" });
    const without = await edit(shipment, {
      recipientNeighborhoodId: catalog.place.itagui,
      fee: 12000,
    });
    expect(without.status).toBe(400);
    expect(without.body).toMatchObject({
      error: { fields: { feeOverrideReason: expect.any(String) } },
    });

    const updated = await edited(shipment, { recipientNeighborhoodId: catalog.place.itagui });
    expect(updated).toMatchObject({ fee: 15000, calculatedFee: 15000, feeOverrideReason: null });
  });

  it("keeps the override and its reason when the fee is unchanged", async () => {
    const shipment = await register({ fee: 12000, feeOverrideReason: "Descuento acordado" });
    const updated = await edited(shipment, { fee: 12000, recipientAddress: "Calle 11 # 40-10" });
    expect(updated).toMatchObject({ fee: 12000, feeOverrideReason: "Descuento acordado" });
  });

  it("keeps the COD amount of 'Contraentrega' when the fee changes (scenario 6)", async () => {
    const shipment = await register({ paymentMode: "cash_on_delivery", codAmount: 80000 });
    const updated = await edited(shipment, { recipientNeighborhoodId: catalog.place.itagui });
    expect(updated).toMatchObject({ fee: 15000, codAmount: 80000 });
  });

  it("follows the fee for 'Flete al destinatario' and zeroes it for 'Crédito del cliente'", async () => {
    const shipment = await register({ paymentMode: "recipient_pays_fee" });
    const moved = await edited(shipment, { recipientNeighborhoodId: catalog.place.itagui });
    expect(moved.codAmount).toBe(15000);
    const credit = await edited(moved, { paymentMode: "merchant_account" });
    expect(credit.codAmount).toBe(0);
    const cod = await edit(credit, { paymentMode: "cash_on_delivery" });
    expect(cod.status).toBe(400);
    expect(cod.body).toMatchObject({ error: { fields: { codAmount: expect.any(String) } } });
  });

  it("needs no reason to set an overridden fee back to the calculated one (scenario 7)", async () => {
    const shipment = await register({ fee: 12000, feeOverrideReason: "Descuento acordado" });
    const updated = await edited(shipment, { fee: 13000 });
    expect(updated).toMatchObject({ fee: 13000, feeOverrideReason: null });
    const { events } = await detail(shipment);
    expect(events.at(-1)).toMatchObject({
      type: "updated",
      changes: { fee: [12000, 13000], feeOverrideReason: ["Descuento acordado", null] },
    });
  });

  it("moves the delivery window with the service date", async () => {
    const shipment = await register({ window: { preset: "before", end: "17:00" } });
    const updated = await edited(shipment, { serviceDate: "2026-10-02" });
    expect(updated.windowEnd).toBe("2026-10-02T22:00:00.000Z");
    const cleared = await edited(updated, { window: null });
    expect(cleared.windowEnd).toBeNull();
  });

  it("refuses changes to the tracking number, merchant, or kind (FR-015)", async () => {
    const shipment = await register();
    for (const change of [
      { trackingNumber: "ABCD1234" },
      { merchantId: catalog.merchant.amy },
      { kind: "errand" },
    ]) {
      const result = await edit(shipment, change);
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ error: { code: "invalid_request" } });
    }
  });

  it("refuses fields that do not apply to the shipment kind", async () => {
    const shipment = await register();
    const result = await edit(shipment, { errandDescription: "Recoger documentos" });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: { fields: { errandDescription: expect.any(String) } },
    });
  });

  it("applies a repeated action once (FR-042)", async () => {
    const shipment = await register();
    const actionId = crypto.randomUUID();
    const first = await edit(shipment, { recipientAddress: "Calle 11 # 40-10" }, actionId);
    const again = await edit(shipment, { recipientAddress: "Calle 11 # 40-10" }, actionId);
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ version: shipment.version + 1 });
    const { events } = await detail(shipment);
    expect(events.filter((e) => e.type === "updated")).toHaveLength(1);
  });

  it("records nothing when nothing changes", async () => {
    const shipment = await register();
    const same = await edited(shipment, { recipientAddress: "Calle 10 # 43-12" });
    expect(same.version).toBe(shipment.version);
    expect((await detail(shipment)).events).toHaveLength(1);
  });
});

describe("POST /api/shipments/:id/void", () => {
  it("voids with a reason and keeps the shipment findable (scenario 3)", async () => {
    const shipment = await register();
    await setStatus(shipment, "assigned");
    const result = await voidShipment(shipment, "Cliente canceló el pedido");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "voided",
      voidReason: "Cliente canceló el pedido",
    });

    const response = await t.request(`/api/shipments?trackingNumber=${shipment.trackingNumber}`, {
      cookie: dispatcher.cookie,
    });
    const found = (await response.json()) as ShipmentDetail;
    expect(found.events.at(-1)).toMatchObject({
      type: "voided",
      fromStatus: "assigned",
      toStatus: "voided",
      reason: "Cliente canceló el pedido",
      actor: { id: dispatcher.user.id },
    });
  });

  it("requires a reason of 5 to 200 characters (FR-040)", async () => {
    const shipment = await register();
    expect((await voidShipment(shipment, "no")).status).toBe(400);
    expect((await voidShipment(shipment, "x".repeat(201))).status).toBe(400);
  });

  it("refuses to void twice, but applies a repeated action once", async () => {
    const shipment = await register();
    const actionId = crypto.randomUUID();
    expect((await voidShipment(shipment, "Cliente canceló", actionId)).status).toBe(200);
    expect((await voidShipment(shipment, "Cliente canceló", actionId)).status).toBe(200);
    const again = await voidShipment({ ...shipment, version: shipment.version + 1 }, "Otra vez");
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: { code: "invalid_transition" } });
    const { events } = await detail(shipment);
    expect(events.filter((e) => e.type === "voided")).toHaveLength(1);
  });

  it("refuses a stale version", async () => {
    const shipment = await register();
    await edited(shipment, { recipientAddress: "Calle 11 # 40-10" });
    const result = await voidShipment(shipment, "Cliente canceló");
    expect(result.body).toMatchObject({ error: { code: "version_conflict" } });
  });
});

describe("POST /api/shipments/:id/confirm-fee", () => {
  async function reviewed() {
    const shipment = await register({
      recipientNeighborhoodId: catalog.place.girardota,
      fee: 35000,
      feeOverrideReason: "Tarifa de Girardota sin definir",
      paymentMode: "recipient_pays_fee",
    });
    expect(shipment.feeNeedsReview).toBe(true);
    return shipment;
  }

  it("lets the owner confirm or correct a fee marked for review (FR-035)", async () => {
    const shipment = await reviewed();
    const result = await send(
      `/api/shipments/${shipment.id}/confirm-fee`,
      { actionId: crypto.randomUUID(), version: shipment.version, fee: 30000 },
      { cookie: owner.cookie },
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ fee: 30000, codAmount: 30000, feeNeedsReview: false });
    const { events } = await detail(shipment);
    expect(events.at(-1)).toMatchObject({
      type: "fee_confirmed",
      actor: { id: owner.user.id },
      changes: { fee: [35000, 30000], feeNeedsReview: [true, false], codAmount: [35000, 30000] },
    });
  });

  it("is only for the owner", async () => {
    const shipment = await reviewed();
    const result = await send(`/api/shipments/${shipment.id}/confirm-fee`, {
      actionId: crypto.randomUUID(),
      version: shipment.version,
      fee: 35000,
    });
    expect(result.status).toBe(403);
  });

  it("refuses shipments whose fee is not marked for review", async () => {
    const shipment = await register();
    const result = await send(
      `/api/shipments/${shipment.id}/confirm-fee`,
      { actionId: crypto.randomUUID(), version: shipment.version, fee: 13000 },
      { cookie: owner.cookie },
    );
    expect(result.status).toBe(409);
  });
});
