import type { Shipment, ShipmentDetail } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
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
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
});

function delivery(overrides: Record<string, unknown> = {}) {
  return {
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
  };
}

async function create(body: Record<string, unknown>, cookie = dispatcher.cookie) {
  const response = await t.request("/api/shipments", { method: "POST", cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function created(body: Record<string, unknown>): Promise<Shipment> {
  const result = await create(body);
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body as unknown as Shipment;
}

describe("POST /api/shipments", () => {
  it("registers a delivery with the standard fee, today's date, and a tracking number (scenario 1)", async () => {
    const shipment = await created(delivery());
    expect(shipment).toMatchObject({
      status: "registered",
      fee: 13000,
      calculatedFee: 13000,
      codAmount: 0,
      serviceDate: "2026-10-01",
      feeNeedsReview: false,
    });
    expect(shipment.trackingNumber).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    expect(shipment.pickupAddress).toBe("Cra 70 # 45-10");
  });

  it("uses the merchant's rate card (scenario 2)", async () => {
    const shipment = await created(
      delivery({
        merchantId: catalog.merchant.amy,
        pickupPointId: catalog.pickup.amy,
        recipientNeighborhoodId: catalog.place.itagui,
        fee: 10700,
      }),
    );
    expect(shipment.fee).toBe(10700);
  });

  it("sets the COD amount to the fee for 'Flete al destinatario' (scenario 3)", async () => {
    const shipment = await created(
      delivery({
        recipientNeighborhoodId: catalog.place.itagui,
        fee: 15000,
        paymentMode: "recipient_pays_fee",
        codAmount: 1,
      }),
    );
    expect(shipment.codAmount).toBe(15000);
  });

  it("refuses 'Contraentrega' without a COD amount (scenario 4)", async () => {
    const result = await create(delivery({ paymentMode: "cash_on_delivery" }));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: { code: "invalid_request", fields: { codAmount: expect.any(String) } },
    });
  });

  it("keeps both fees and requires a reason when the fee is overridden (scenario 6)", async () => {
    const refused = await create(delivery({ fee: 12000 }));
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({
      error: { fields: { feeOverrideReason: expect.any(String) } },
    });

    const shipment = await created(delivery({ fee: 12000, feeOverrideReason: "Precio negociado" }));
    expect(shipment).toMatchObject({
      fee: 12000,
      calculatedFee: 13000,
      feeOverrideReason: "Precio negociado",
    });
  });

  it("stores 'Antes de las 17:00' as a latest time on the service date (scenario 7)", async () => {
    const shipment = await created(delivery({ window: { preset: "before", end: "17:00" } }));
    expect(shipment.windowStart).toBeNull();
    expect(shipment.windowEnd).toBe("2026-10-01T22:00:00.000Z");
  });

  it("stores 'En la tarde' as 12:00–20:00 (scenario 8)", async () => {
    const shipment = await created(delivery({ window: { preset: "afternoon" } }));
    expect(shipment.windowStart).toBe("2026-10-01T17:00:00.000Z");
    expect(shipment.windowEnd).toBe("2026-10-02T01:00:00.000Z");
  });

  it("requires a manual fee with a reason for an errand, not flagged for review (scenario 9)", async () => {
    const errand = {
      id: crypto.randomUUID(),
      kind: "errand",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      errandDescription: "Consignar en Bancolombia",
      paymentMode: "merchant_account",
      fee: 20000,
    };
    expect((await create(errand)).status).toBe(400);
    const shipment = await created({
      ...errand,
      id: crypto.randomUUID(),
      feeOverrideReason: "Consignación y regreso",
    });
    expect(shipment).toMatchObject({
      calculatedFee: null,
      fee: 20000,
      feeNeedsReview: false,
      rateZone: null,
    });
  });

  it("adds the standard express surcharge (scenario 10)", async () => {
    expect((await created(delivery({ serviceLevel: "express", fee: 17500 }))).fee).toBe(17500);
  });

  it("applies a merchant express surcharge of 0 (scenario 11)", async () => {
    const shipment = await created(
      delivery({
        merchantId: catalog.merchant.noSurcharge,
        pickupPointId: catalog.pickup.noSurcharge,
        serviceLevel: "express",
        fee: 13000,
      }),
    );
    expect(shipment.calculatedFee).toBe(13000);
  });

  it("prices a carrier handoff by its handoff place and requires carrier and town (scenario 12)", async () => {
    const handoff = {
      id: crypto.randomUUID(),
      kind: "carrier_handoff",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientNeighborhoodId: catalog.place.terminalNorte,
      paymentMode: "merchant_account",
      fee: 15000,
    };
    const refused = await create(handoff);
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({
      error: { fields: { carrierId: expect.any(String), destinationTown: expect.any(String) } },
    });
    const shipment = await created({
      ...handoff,
      carrierId: catalog.carrier,
      destinationTown: "Santa Rosa de Osos",
    });
    expect(shipment).toMatchObject({ calculatedFee: 15000, carrier: { name: "Coonorte" } });
  });

  it("refuses a carrier handoff to a place that is not a handoff place", async () => {
    const result = await create({
      id: crypto.randomUUID(),
      kind: "carrier_handoff",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientNeighborhoodId: catalog.place.laureles,
      carrierId: catalog.carrier,
      destinationTown: "Yarumal",
      paymentMode: "merchant_account",
      fee: 13000,
    });
    expect(result.status).toBe(400);
  });

  it("creates exactly one shipment when the same creation is sent again (scenario 13, FR-042)", async () => {
    const body = delivery();
    const first = await create(body);
    const second = await create(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body["trackingNumber"]).toBe(first.body["trackingNumber"]);
    const rows = await database.db.select().from(shipments).where(eq(shipments.id, body.id));
    expect(rows).toHaveLength(1);
  });

  it("uses the Colombian day at 7:30 p. m. as the default service date (scenario 14)", async () => {
    t.setNow("2026-10-02T00:30:00Z");
    expect((await created(delivery())).serviceDate).toBe("2026-10-01");
  });

  it("accepts a one-off pickup address (FR-003)", async () => {
    const shipment = await created(
      delivery({
        pickupPointId: null,
        pickupAddress: "Cl 50 # 20-30",
        pickupNeighborhoodId: catalog.place.laureles,
      }),
    );
    expect(shipment).toMatchObject({ pickupPointId: null, pickupAddress: "Cl 50 # 20-30" });
  });

  it("saves a manual fee marked 'Tarifa por revisar' when the zone has no rate (FR-035)", async () => {
    const body = delivery({ recipientNeighborhoodId: catalog.place.girardota, fee: 35000 });
    expect((await create(body)).status).toBe(400);
    const shipment = await created({
      ...body,
      feeOverrideReason: "Tarifa de Girardota sin definir",
    });
    expect(shipment).toMatchObject({ calculatedFee: null, fee: 35000, feeNeedsReview: true });
  });

  it("asks for confirmation above COP 100.000 of fee or COP 2.000.000 of COD (FR-037)", async () => {
    const highFee = delivery({ fee: 120000, feeOverrideReason: "Envío especial muy lejano" });
    expect(await create(highFee)).toMatchObject({
      status: 422,
      body: { error: { code: "confirmation_required" } },
    });
    expect((await create({ ...highFee, confirmed: true })).status).toBe(201);

    const highCod = delivery({ paymentMode: "cash_on_delivery", codAmount: 2500000 });
    expect((await create(highCod)).status).toBe(422);
    expect((await create({ ...highCod, confirmed: true })).status).toBe(201);
  });

  it("records the creation with author and time", async () => {
    const shipment = await created(delivery());
    const response = await t.request(`/api/shipments/${shipment.id}`, {
      cookie: dispatcher.cookie,
    });
    const detail = (await response.json()) as ShipmentDetail;
    expect(detail.events).toHaveLength(1);
    expect(detail.events[0]).toMatchObject({
      type: "created",
      toStatus: "registered",
      actor: { id: dispatcher.user.id, name: "John Coordinador" },
      occurredAt: "2026-10-01T15:00:00.000Z",
    });
  });

  it("finds a shipment by tracking number, typed loosely", async () => {
    const shipment = await created(delivery());
    const loose = `${shipment.trackingNumber.slice(0, 4).toLowerCase()}-${shipment.trackingNumber.slice(4)}`;
    const response = await t.request(`/api/shipments?trackingNumber=${loose}`, {
      cookie: dispatcher.cookie,
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as Shipment).id).toBe(shipment.id);
  });

  it("refuses couriers", async () => {
    const courier = await t.signIn("courier");
    expect((await create(delivery(), courier.cookie)).status).toBe(403);
  });
});

describe("GET /api/shipments/duplicates (FR-013)", () => {
  it("matches the merchant reference, or the recipient phone when there is no reference", async () => {
    const withReference = await created(delivery({ merchantReference: "D-254" }));
    const withoutReference = await created(delivery({ recipientPhone: "3119998877" }));
    const query = (params: string) =>
      t
        .request(
          `/api/shipments/duplicates?merchantId=${catalog.merchant.bullish}&serviceDate=2026-10-01&${params}`,
          {
            cookie: dispatcher.cookie,
          },
        )
        .then((response) => response.json() as Promise<{ trackingNumbers: string[] }>);

    expect(
      (await query("merchantReference=D-254&recipientPhone=3001234567")).trackingNumbers,
    ).toEqual([withReference.trackingNumber]);
    expect((await query("recipientPhone=3119998877")).trackingNumbers).toEqual([
      withoutReference.trackingNumber,
    ]);
    expect((await query("merchantReference=OTRA")).trackingNumbers).toEqual([]);
  });
});

describe("POST /api/shipments/fee-quote", () => {
  it("quotes the fee and the rate zone", async () => {
    const response = await t.request("/api/shipments/fee-quote", {
      method: "POST",
      cookie: dispatcher.cookie,
      body: {
        merchantId: catalog.merchant.amy,
        kind: "delivery",
        neighborhoodId: catalog.place.itagui,
        serviceLevel: "standard",
      },
    });
    expect(await response.json()).toEqual({
      calculatedFee: 10700,
      rateZone: { id: catalog.zone.belloItagui, name: "Bello–Itagüí" },
      needsManualFee: false,
    });
  });
});
