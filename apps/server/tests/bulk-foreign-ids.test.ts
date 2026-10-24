import { bulkColumns, type BulkPreviewRow } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bulkBatches, shipmentEvents, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

/**
 * A new bulk batch never reports another merchant's shipment as its own (F001-5; FR-020,
 * FR-042): a row id that already identifies a shipment of another merchant is refused.
 */

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let dispatcher: { cookie: string };

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
const delivery = (reference: string) => {
  const values: Partial<Record<Column, string>> = {
    Destinatario: "Laura Gómez",
    Teléfono: "3001234567",
    Dirección: "Calle 10 # 43-12",
    Barrio: "Laureles",
    Referencia: reference,
  };
  return { cells: bulkColumns.map((column) => values[column] ?? "") };
};

async function post(path: string, body: unknown) {
  const response = await t.request(path, { method: "POST", cookie: dispatcher.cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function preview(references: string[], merchantId: string) {
  const result = await post("/api/bulk/preview", { merchantId, rows: references.map(delivery) });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body["rows"] as BulkPreviewRow[];
}

describe("bulk confirmation with ids already in use (F001-5)", () => {
  it("refuses a row id of another merchant's shipment and creates nothing", async () => {
    const [foreignRow] = await preview(["AJENO-1"], catalog.merchant.bullish);
    const foreignId = crypto.randomUUID();
    const foreign = await post("/api/bulk/confirm", {
      batchId: crypto.randomUUID(),
      merchantId: catalog.merchant.bullish,
      rows: [{ ...foreignRow?.input, id: foreignId, confirmed: true }],
    });
    expect(foreign.status).toBe(201);

    const rows = await preview(["PROPIO-1", "PROPIO-2"], catalog.merchant.amy);
    const batchId = crypto.randomUUID();
    const response = await post("/api/bulk/confirm", {
      batchId,
      merchantId: catalog.merchant.amy,
      rows: [
        { ...rows[0]?.input, id: crypto.randomUUID(), confirmed: true },
        { ...rows[1]?.input, id: foreignId, confirmed: true },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_request",
        fields: { "rows.1.id": expect.stringContaining("otro cliente") },
      },
    });
    expect(await database.db.select().from(shipments)).toHaveLength(1);
    expect(await database.db.select().from(bulkBatches).where(eq(bulkBatches.id, batchId))).toEqual(
      [],
    );
    expect(await database.db.select().from(shipmentEvents)).toHaveLength(1);
  });
});
