import { bulkColumns, type BulkPreviewRow, type ShipmentCreateInput } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bulkBatches, shipments } from "../src/db/schema/index.ts";
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
});
