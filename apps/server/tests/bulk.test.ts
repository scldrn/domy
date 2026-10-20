import { bulkColumns, type BulkPreviewRow, type ShipmentCreateInput } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bulkBatches, shipmentEvents, shipments } from "../src/db/schema/index.ts";
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
  dispatcher = await t.signIn("dispatcher");
});

type Column = (typeof bulkColumns)[number];
function cells(values: Partial<Record<Column, string>>): string[] {
  return bulkColumns.map((column) => values[column] ?? "");
}
const delivery = (values: Partial<Record<Column, string>> = {}) =>
  cells({
    Destinatario: "Laura Gómez",
    Teléfono: "3001234567",
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    ...values,
  });

async function post(path: string, body: unknown) {
  const response = await t.request(path, { method: "POST", cookie: dispatcher.cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function preview(
  rows: (string[] | { cells: string[]; neighborhoodId?: string })[],
  merchantId = catalog.merchant.amy,
) {
  const result = await post("/api/bulk/preview", {
    merchantId,
    rows: rows.map((row) => (Array.isArray(row) ? { cells: row } : row)),
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body["rows"] as BulkPreviewRow[];
}

function confirm(batchId: string, rows: BulkPreviewRow[], merchantId = catalog.merchant.amy) {
  return post("/api/bulk/confirm", {
    batchId,
    merchantId,
    rows: rows.map(
      (row): ShipmentCreateInput =>
        ({ ...row.input, id: crypto.randomUUID(), confirmed: true }) as ShipmentCreateInput,
    ),
  });
}

describe("POST /api/bulk/preview", () => {
  it("parses each row with its fee and marks it ready (scenario 1)", async () => {
    const [row] = await preview([
      delivery({ Modalidad: "Contraentrega", "Valor a recaudar": "$ 85.000", Referencia: "D-1" }),
    ]);
    expect(row).toMatchObject({
      status: "ready",
      errors: {},
      calculatedFee: 9700,
      neighborhoodMatch: { id: catalog.place.laureles, name: "Laureles" },
      input: {
        kind: "delivery",
        merchantId: catalog.merchant.amy,
        pickupPointId: catalog.pickup.amy,
        recipientNeighborhoodId: catalog.place.laureles,
        paymentMode: "cash_on_delivery",
        codAmount: 85000,
        fee: 9700,
        merchantReference: "D-1",
      },
    });
  });

  it("resolves accents and case exactly, and proposes a misspelled neighborhood (scenario 2)", async () => {
    const [exact, misspelled] = await preview([
      delivery({ Barrio: "copàcabana" }),
      delivery({ Barrio: "Copacavana" }),
    ]);
    expect(exact).toMatchObject({
      status: "ready",
      neighborhoodMatch: { name: "Copacabana", similarity: 1 },
      calculatedFee: 10700,
    });
    expect(misspelled).toMatchObject({
      status: "needs_confirmation",
      confirmations: ["neighborhood"],
      neighborhoodMatch: { id: catalog.place.copacabana, name: "Copacabana" },
    });
    expect(misspelled?.neighborhoodMatch?.similarity).toBeLessThan(1);

    // A neighborhood chosen by the dispatcher is taken as is.
    const [chosen] = await preview([
      { cells: delivery({ Barrio: "Copacavana" }), neighborhoodId: catalog.place.itagui },
    ]);
    expect(chosen).toMatchObject({ status: "ready", neighborhoodMatch: { name: "Itagüí" } });
  });

  it("explains every problem of an invalid row", async () => {
    const [row] = await preview([
      delivery({
        Teléfono: "300",
        Barrio: "Zzzzqqq",
        Modalidad: "Contraentrega",
        Franja: "temprano",
      }),
    ]);
    expect(row?.status).toBe("invalid");
    expect(Object.keys(row?.errors ?? {}).sort()).toEqual(
      ["codAmount", "recipientNeighborhoodId", "recipientPhone", "window"].sort(),
    );
  });

  it("asks for a fee and a reason where the zone has no rate, and for errands", async () => {
    const [noRate, errand, errandWithFee] = await preview([
      delivery({ Barrio: "Girardota" }),
      cells({ Tipo: "Diligencia", Diligencia: "Pagar un recibo" }),
      cells({
        Tipo: "Diligencia",
        Diligencia: "Pagar un recibo",
        Tarifa: "12000",
        "Motivo tarifa": "Diligencia en el centro",
      }),
    ]);
    expect(noRate).toMatchObject({ status: "invalid", errors: { fee: expect.any(String) } });
    expect(errand).toMatchObject({ status: "invalid", errors: { fee: expect.any(String) } });
    expect(errandWithFee).toMatchObject({ status: "ready", input: { fee: 12000 } });
  });

  it("resolves carriers and handoff places by name", async () => {
    const [row] = await preview([
      cells({
        Tipo: "Entrega a transportadora",
        Barrio: "terminal norte",
        Transportadora: "coonorte",
        "Municipio destino": "Santa Rosa de Osos",
      }),
    ]);
    expect(row).toMatchObject({
      status: "ready",
      input: { carrierId: catalog.carrier, recipientNeighborhoodId: catalog.place.terminalNorte },
      calculatedFee: 15000,
    });
  });

  it("flags a possible duplicate for confirmation (scenario 4)", async () => {
    const [first] = await preview([delivery({ Referencia: "D-9" })]);
    expect((await confirm(crypto.randomUUID(), [first as BulkPreviewRow])).status).toBe(201);
    const [again] = await preview([delivery({ Referencia: "D-9" })]);
    expect(again).toMatchObject({
      status: "needs_confirmation",
      confirmations: ["duplicate"],
      duplicateOf: [expect.stringMatching(/^[0-9A-Z]{8}$/)],
    });
  });

  it("warns without blocking about Sundays and windows already past (FR-010)", async () => {
    // Now is 10:00 on Thursday 1 October 2026 in Bogotá.
    const [sunday, past, fine] = await preview([
      delivery({ Fecha: "04/10/2026" }),
      delivery({ Franja: "antes de las 9am" }),
      delivery({ Franja: "en la tarde" }),
    ]);
    expect(sunday).toMatchObject({
      status: "ready",
      warnings: ["La fecha del servicio es un domingo."],
    });
    expect(past).toMatchObject({ status: "ready", warnings: ["La franja de entrega ya pasó."] });
    expect(fine?.warnings).toEqual([]);
  });

  it("asks to confirm large amounts (FR-037)", async () => {
    const [row] = await preview([
      delivery({ Modalidad: "Contraentrega", "Valor a recaudar": "2.500.000" }),
    ]);
    expect(row).toMatchObject({ status: "needs_confirmation", confirmations: ["amount"] });
  });

  it("rejects unknown columns and more than 200 rows before the preview (FR-019)", async () => {
    const unknown = await post("/api/bulk/preview", {
      merchantId: catalog.merchant.amy,
      rows: [{ cells: ["Tipo", "Cliente"] }, { cells: ["Entrega", "Amy"] }],
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body).toMatchObject({ error: { message: expect.stringContaining("Cliente") } });
    const tooMany = await post("/api/bulk/preview", {
      merchantId: catalog.merchant.amy,
      rows: Array.from({ length: 201 }, () => ({ cells: delivery() })),
    });
    expect(tooMany.status).toBe(400);
  });
});

describe("POST /api/bulk/confirm", () => {
  it("creates every confirmed row in one batch (scenario 3)", async () => {
    const rows = await preview(
      Array.from({ length: 18 }, (_, i) => delivery({ Referencia: `R-${String(i)}` })),
    );
    const batchId = crypto.randomUUID();
    const result = await confirm(batchId, rows);
    expect(result.status).toBe(201);
    const created = result.body["created"] as { row: number; trackingNumber: string }[];
    expect(created.map((entry) => entry.row)).toEqual(rows.map((_, index) => index));

    const stored = await database.db
      .select()
      .from(shipments)
      .where(eq(shipments.bulkBatchId, batchId));
    expect(stored).toHaveLength(18);
    expect(stored.every((shipment) => shipment.fee === 9700)).toBe(true);
    const [batch] = await database.db.select().from(bulkBatches).where(eq(bulkBatches.id, batchId));
    expect(batch).toMatchObject({ rowCount: 18, createdCount: 18, createdBy: dispatcher.user.id });
  });

  it("creates nothing when one row fails", async () => {
    const rows = await preview([delivery(), delivery()]);
    const broken = rows.map((row, index): BulkPreviewRow =>
      index === 1 ? { ...row, input: { ...row.input, fee: 5000 } } : row,
    );
    const result = await confirm(crypto.randomUUID(), broken);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: { fields: { "rows.1.feeOverrideReason": expect.any(String) } },
    });
    expect(await database.db.select().from(shipments)).toHaveLength(0);
  });

  it("returns the first result when the same batch is confirmed again (FR-042)", async () => {
    const rows = await preview([delivery(), delivery()]);
    const inputs = rows.map((row) => ({ ...row.input, id: crypto.randomUUID(), confirmed: true }));
    const batchId = crypto.randomUUID();
    const body = { batchId, merchantId: catalog.merchant.amy, rows: inputs };
    const first = await post("/api/bulk/confirm", body);
    const again = await post("/api/bulk/confirm", body);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body["created"]).toEqual(first.body["created"]);
    expect(await database.db.select().from(shipments)).toHaveLength(2);
  });

  it("refuses rows of another merchant", async () => {
    const rows = await preview([delivery()]);
    const result = await confirm(crypto.randomUUID(), rows, catalog.merchant.bullish);
    expect(result.status).toBe(400);
  });

  it("refuses ambiguous duplicate row IDs in the same batch with 400 validation error", async () => {
    const rows = await preview([delivery({ Referencia: "D-1" }), delivery({ Referencia: "D-2" })]);
    const firstRow = rows[0];
    const secondRow = rows[1];
    if (!firstRow || !secondRow) throw new Error("Expected preview rows");
    const duplicateId = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const body = {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: [
        { ...firstRow.input, id: duplicateId, confirmed: true },
        { ...secondRow.input, id: duplicateId, confirmed: true },
      ],
    };
    const response = await post("/api/bulk/confirm", body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_request",
        fields: {
          "rows.1.id": expect.any(String),
        },
      },
    });
    expect(await database.db.select().from(shipments)).toHaveLength(0);
    expect(await database.db.select().from(shipmentEvents)).toHaveLength(0);
    expect(await database.db.select().from(bulkBatches)).toHaveLength(0);
  });

  it("creates events only for newly inserted shipments in a mixed batch", async () => {
    const [initialRow] = await preview([delivery({ Referencia: "INITIAL-1" })]);
    if (!initialRow) throw new Error("Expected preview row");
    const existingId = crypto.randomUUID();
    const createExisting = await post("/api/shipments", {
      ...initialRow.input,
      id: existingId,
      confirmed: true,
    });
    expect(createExisting.status).toBe(201);
    const eventsBefore = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, existingId));
    expect(eventsBefore).toHaveLength(1);

    const newId = crypto.randomUUID();
    const batchRows = await preview([
      delivery({ Referencia: "INITIAL-1" }),
      delivery({ Referencia: "NEW-2" }),
    ]);
    const existingRow = batchRows[0];
    const newRow = batchRows[1];
    if (!existingRow || !newRow) throw new Error("Expected preview rows");
    const batchId = crypto.randomUUID();
    const response = await post("/api/bulk/confirm", {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: [
        { ...existingRow.input, id: existingId, confirmed: true },
        { ...newRow.input, id: newId, confirmed: true },
      ],
    });
    expect(response.status).toBe(201);
    expect(response.body["created"]).toHaveLength(2);

    const existingEventsAfter = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, existingId));
    expect(existingEventsAfter).toHaveLength(1);

    const newEvents = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, newId));
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]?.type).toBe("created");

    const [batch] = await database.db.select().from(bulkBatches).where(eq(bulkBatches.id, batchId));
    expect(batch).toMatchObject({ rowCount: 2, createdCount: 1 });
  });

  it("replaying a confirmed batch returns 200 and inserts no duplicate creation events", async () => {
    const rows = await preview([delivery({ Referencia: "A-1" }), delivery({ Referencia: "A-2" })]);
    const batchId = crypto.randomUUID();
    const body = {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: rows.map((r) => ({ ...r.input, id: crypto.randomUUID(), confirmed: true })),
    };
    const first = await post("/api/bulk/confirm", body);
    expect(first.status).toBe(201);

    const eventsAfterFirst = await database.db.select().from(shipmentEvents);
    expect(eventsAfterFirst).toHaveLength(2);

    const replay = await post("/api/bulk/confirm", body);
    expect(replay.status).toBe(200);
    expect(replay.body["created"]).toEqual(first.body["created"]);

    const eventsAfterReplay = await database.db.select().from(shipmentEvents);
    expect(eventsAfterReplay).toHaveLength(2);
  });

  it("submitting already-existing shipments under a new batch ID returns 200 with existing records and no duplicate events", async () => {
    const rows = await preview([delivery({ Referencia: "B-1" }), delivery({ Referencia: "B-2" })]);
    const rowInputs = rows.map((r) => ({ ...r.input, id: crypto.randomUUID(), confirmed: true }));
    const first = await post("/api/bulk/confirm", {
      batchId: crypto.randomUUID(),
      merchantId: catalog.merchant.amy,
      rows: rowInputs,
    });
    expect(first.status).toBe(201);

    const secondBatchId = crypto.randomUUID();
    const second = await post("/api/bulk/confirm", {
      batchId: secondBatchId,
      merchantId: catalog.merchant.amy,
      rows: rowInputs,
    });
    expect(second.status).toBe(200);
    expect(second.body["created"]).toEqual(first.body["created"]);

    const events = await database.db.select().from(shipmentEvents);
    expect(events).toHaveLength(2);

    const [batch] = await database.db
      .select()
      .from(bulkBatches)
      .where(eq(bulkBatches.id, secondBatchId));
    expect(batch).toMatchObject({ rowCount: 2, createdCount: 0 });
  });

  it("refuses batch and inserts nothing when an invalid row is mixed with valid new and existing rows", async () => {
    const [initial] = await preview([delivery({ Referencia: "EXISTING" })]);
    if (!initial) throw new Error("Expected preview row");
    const existingId = crypto.randomUUID();
    await post("/api/shipments", {
      ...initial.input,
      id: existingId,
      confirmed: true,
    });
    expect(await database.db.select().from(shipments)).toHaveLength(1);

    const rows = await preview([
      delivery({ Referencia: "EXISTING" }),
      delivery({ Referencia: "NEW-VALID" }),
      delivery({ Referencia: "NEW-INVALID" }),
    ]);
    const existingRow = rows[0];
    const newValidRow = rows[1];
    const newInvalidRow = rows[2];
    if (!existingRow || !newValidRow || !newInvalidRow) throw new Error("Expected preview rows");
    const newValidId = crypto.randomUUID();
    const newInvalidId = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const response = await post("/api/bulk/confirm", {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: [
        { ...existingRow.input, id: existingId, confirmed: true },
        { ...newValidRow.input, id: newValidId, confirmed: true },
        {
          ...newInvalidRow.input,
          id: newInvalidId,
          fee: 5000,
          feeOverrideReason: undefined,
          confirmed: true,
        },
      ],
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_request",
        fields: {
          "rows.2.feeOverrideReason": expect.any(String),
        },
      },
    });

    expect(await database.db.select().from(shipments)).toHaveLength(1);
    expect(await database.db.select().from(bulkBatches)).toHaveLength(0);
    expect(await database.db.select().from(shipmentEvents)).toHaveLength(1);
  });

  it("handles concurrent bulk and individual creation without duplicate events", async () => {
    const [previewRow] = await preview([delivery({ Referencia: "CONCURRENT-1" })]);
    if (!previewRow) throw new Error("Expected preview row");
    const sharedId = crypto.randomUUID();
    const newId = crypto.randomUUID();
    const batchId = crypto.randomUUID();

    const shipmentPayload = {
      ...previewRow.input,
      id: sharedId,
      confirmed: true,
    };
    const bulkPayload = {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: [
        shipmentPayload,
        { ...previewRow.input, id: newId, merchantReference: "CONCURRENT-2", confirmed: true },
      ],
    };

    const [shipmentRes, bulkRes] = await Promise.all([
      post("/api/shipments", shipmentPayload),
      post("/api/bulk/confirm", bulkPayload),
    ]);

    expect([200, 201]).toContain(shipmentRes.status);
    expect([200, 201]).toContain(bulkRes.status);

    const sharedEvents = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, sharedId));
    expect(sharedEvents).toHaveLength(1);
    expect(sharedEvents[0]?.type).toBe("created");

    const newEvents = await database.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, newId));
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]?.type).toBe("created");
  });
});
