import type { Shipment } from "@domy/domain";
import { readSheet } from "read-excel-file/node";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportColumns } from "../src/lib/export.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  // 7:30 p. m. in Bogotá on 2026-10-01 (already 2026-10-02 in UTC).
  t = createTestApp(database.db, { now: "2026-10-02T00:30:00Z" });
  owner = await t.signIn("owner", { name: "Santiago Marín" });
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function register(): Promise<Shipment> {
  const response = await t.request("/api/shipments", {
    method: "POST",
    cookie: owner.cookie,
    body: {
      id: crypto.randomUUID(),
      kind: "delivery",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      recipientNeighborhoodId: catalog.place.laureles,
      paymentMode: "cash_on_delivery",
      codAmount: 1250000,
      fee: 13000,
      merchantReference: "D-254",
      window: { preset: "before", end: "17:00" },
    },
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Shipment;
}

const expected = (shipment: Shipment) => [
  `${shipment.trackingNumber.slice(0, 4)}-${shipment.trackingNumber.slice(4)}`,
  "01/10/2026",
  "Registrado",
  "Entrega",
  "Bullish Hype",
  "D-254",
  "Laura Gómez",
  "3001234567",
  "Calle 10 # 43-12",
  "Laureles",
  "Medellín",
  "Medellín",
  "",
  "",
  "",
  "Contraentrega",
  "1250000",
  "13000",
  "13000",
  "",
  "Estándar",
  "",
  "01/10/2026 17:00",
  "",
  "",
  "",
  "Santiago Marín",
  "01/10/2026 19:30",
  "01/10/2026 19:30",
  "",
  "",
  "",
  "",
  "",
  "",
  "0",
  "",
  "",
];

describe("GET /api/shipments/export", () => {
  it("exports CSV with the Spanish headers in order (FR-025)", async () => {
    const shipment = await register();
    const response = await t.request("/api/shipments/export?format=csv&q=D-254", {
      cookie: owner.cookie,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(
      /attachment; filename="envios-.*\.csv"/,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A byte order mark lets Excel open the file as UTF-8.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const [header, row] = new TextDecoder().decode(bytes).trimEnd().split("\r\n");
    expect(header?.split(",")).toEqual([...exportColumns]);
    expect(row?.split(",")).toEqual(expected(shipment));
  });

  it("exports Excel with the same columns and values", async () => {
    const shipment = await register();
    const response = await t.request("/api/shipments/export?format=xlsx", { cookie: owner.cookie });
    expect(response.status).toBe(200);
    const rows = await readSheet(Buffer.from(await response.arrayBuffer()));
    expect(rows[0]).toEqual([...exportColumns]);
    const values = expected(shipment).map((value, index) =>
      [16, 17, 18, 35].includes(index) ? Number(value) : value === "" ? null : value,
    );
    expect(rows[1]).toEqual(values);
  });

  it("neutralizes formula trigger characters in user text (IV-01, T128)", async () => {
    const response = await t.request("/api/shipments", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        id: crypto.randomUUID(),
        kind: "errand",
        merchantId: catalog.merchant.bullish,
        pickupPointId: catalog.pickup.bullish,
        errandDescription: "=1+1",
        instructions: "+573001234567",
        paymentMode: "merchant_account",
        fee: 12000,
        feeOverrideReason: "-Descuento autorizado",
      },
    });
    expect(response.status).toBe(201);
    const csv = await (
      await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie })
    ).text();
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+573001234567");
    expect(csv).toContain("'-Descuento autorizado");
  });

  it("quotes values with commas or quotes in CSV", async () => {
    const response = await t.request("/api/shipments", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        id: crypto.randomUUID(),
        kind: "errand",
        merchantId: catalog.merchant.bullish,
        pickupPointId: catalog.pickup.bullish,
        errandDescription: 'Pagar "recibo", luego volver',
        paymentMode: "merchant_account",
        fee: 12000,
        feeOverrideReason: "Diligencia en el centro",
      },
    });
    expect(response.status).toBe(201);
    const csv = await (
      await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie })
    ).text();
    expect(csv).toContain('"Pagar ""recibo"", luego volver"');
  });

  it("is only for the owner", async () => {
    const response = await t.request("/api/shipments/export?format=csv", {
      cookie: dispatcher.cookie,
    });
    expect(response.status).toBe(403);
  });
});
