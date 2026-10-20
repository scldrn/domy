import { formatTrackingNumber, type Handover } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportColumns, toCsv } from "../src/lib/export.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import {
  createCourier,
  createRoute,
  pickUp,
  registerShipment,
  routeAction,
  send,
} from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string; name: string } };
let dispatcher: { cookie: string };
let courierUser: CourierAccount;

const now = new Date("2026-10-01T15:00:00Z");

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: now.toISOString() });
  owner = await t.signIn("owner", { name: "Santiago Marín" });
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
  courierUser = await courierWithAccount(t, database.db, "Carlos Pérez");
});

async function parseCsv(response: Response): Promise<string[][]> {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/csv");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(bytes);
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => {
      // Basic CSV field parser respecting RFC 4180 quotes
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i] ?? "";
        if (inQuotes) {
          if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ",") {
            result.push(current);
            current = "";
          } else {
            current += char;
          }
        }
      }
      result.push(current);
      return result;
    });
}

describe("Operational exports: Authorization (003/T085)", () => {
  it("allows only the owner to export; dispatcher and courier receive 403", async () => {
    const endpoints = [
      "/api/shipments/export?format=csv",
      "/api/export/courier-records?format=csv",
      "/api/export/routes?format=csv",
      "/api/export/handovers?format=csv",
    ];

    for (const endpoint of endpoints) {
      const ownerRes = await t.request(endpoint, { cookie: owner.cookie });
      expect(ownerRes.status, `Owner on ${endpoint}`).toBe(200);

      const dispatcherRes = await t.request(endpoint, { cookie: dispatcher.cookie });
      expect(dispatcherRes.status, `Dispatcher on ${endpoint}`).toBe(403);

      const courierRes = await t.request(endpoint, { cookie: courierUser.cookie });
      expect(courierRes.status, `Courier on ${endpoint}`).toBe(403);
    }
  });
});

describe("Spreadsheet-safe CSV serialization (001/T128 IV-01)", () => {
  it("neutralizes string formula trigger characters with leading apostrophe", () => {
    const table = [
      ["Fórmula 1", "Fórmula 2", "Fórmula 3", "Fórmula 4", "Tab", "CR"],
      ["=1+1", "+573001234567", "-Descuento", "@admin", "\tindented", "\rnewline"],
    ];
    const csv = toCsv(table);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+573001234567");
    expect(csv).toContain("'-Descuento");
    expect(csv).toContain("'@admin");
    expect(csv).toContain("'\tindented");
    expect(csv).toContain("'\rnewline");
  });

  it("never corrupts numeric integer COP or negative numbers", () => {
    const table = [
      ["Positivo", "Cero", "Negativo"],
      [1250000, 0, -5000],
    ];
    const csv = toCsv(table);
    expect(csv).toContain("1250000,0,-5000");
  });

  it("correctly escapes quotes, commas, and newlines per RFC 4180", () => {
    const table = [
      ["Nota", "Fórmula con coma"],
      ['Pagar "recibo", urgente', "=SUM(1,2)"],
    ];
    const csv = toCsv(table);
    expect(csv).toContain('"Pagar ""recibo"", urgente"');
    expect(csv).toContain('"\'=SUM(1,2)"');
  });
});

describe("GET /api/shipments/export delivery columns (003/T085)", () => {
  it("exports empty table with 37 headers when there are no shipments", async () => {
    const res = await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([...exportColumns]);
    expect(rows[0]).toHaveLength(37);
  });

  it("includes delivery columns: status date, courier, receiver, amounts, attempts, last exception reason", async () => {
    // 1. Registered shipment with formula-leading instructions
    const shipment1 = await registerShipment(t, owner.cookie, catalog, {
      recipientName: "Laura Gómez",
      codAmount: 50000,
      instructions: "=SUM(1,1)",
    });

    // 2. Errand shipment
    const errand = await registerShipment(t, owner.cookie, catalog, {
      kind: "errand",
      errandDescription: "Comprar suministros",
      paymentMode: "merchant_account",
      codAmount: 0,
      fee: 15000,
      feeOverrideReason: "Diligencia especial",
    });

    // Create route with shipment1 and errand, assign to courier, dispatch
    const route = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment1.id, errand.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route, "/dispatch");

    // Courier picks up shipment1 and completes delivery with cash
    await pickUp(database.db, shipment1.id, now);
    const deliveryTime = new Date("2026-10-01T16:30:00Z");
    t.setNow(deliveryTime.toISOString());
    await sendRecords(
      t,
      courierUser,
      [
        {
          kind: "delivery",
          shipmentId: shipment1.id,
          receivedByName: "Mariana Ruiz",
          cashAmount: 50000,
          companyTransferAmount: 0,
          merchantTransferAmount: 0,
        },
      ],
      deliveryTime.toISOString(),
    );

    // Courier completes errand with disbursement
    const errandTime = new Date("2026-10-01T17:00:00Z");
    t.setNow(errandTime.toISOString());
    await sendRecords(
      t,
      courierUser,
      [
        {
          kind: "delivery",
          shipmentId: errand.id,
          cashAmount: 0,
          companyTransferAmount: 0,
          merchantTransferAmount: 0,
        },
        {
          kind: "disbursement",
          shipmentId: errand.id,
          amount: 12000,
          payee: "Papelería Central",
          note: "Factura 123",
        },
      ],
      errandTime.toISOString(),
    );

    // 3. Exception shipment with 2 attempts
    const shipment2 = await registerShipment(t, owner.cookie, catalog, {
      recipientName: "Carlos Duque",
      codAmount: 80000,
    });
    const filler = await registerShipment(t, owner.cookie, catalog);
    const route2 = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment2.id, filler.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route2, "/dispatch");
    await pickUp(database.db, shipment2.id, now);

    // First attempt: exception
    const exceptionTime = new Date("2026-10-01T17:30:00Z");
    t.setNow(exceptionTime.toISOString());
    await sendRecords(
      t,
      courierUser,
      [
        {
          kind: "exception",
          shipmentId: shipment2.id,
          reason: "recipient_absent",
          note: "No contestan timbre",
        },
      ],
      exceptionTime.toISOString(),
    );

    // Dispatcher decides new attempt, reassigns, and courier delivers on second attempt with transfer
    await send(t, owner.cookie, `/api/shipments/${shipment2.id}/exception-decision`, {
      actionId: crypto.randomUUID(),
      decision: "new_attempt",
      routeId: route2.id,
    });
    const delivery2Time = new Date("2026-10-01T18:15:00Z");
    t.setNow(delivery2Time.toISOString());
    await sendRecords(
      t,
      courierUser,
      [
        {
          kind: "delivery",
          shipmentId: shipment2.id,
          receivedByName: "Andrés Duque",
          cashAmount: 0,
          companyTransferAmount: 80000,
          merchantTransferAmount: 0,
        },
      ],
      delivery2Time.toISOString(),
    );

    // Query export
    const res = await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(5); // header + 3 shipments + filler

    const header = rows[0];
    expect(header).toEqual([...exportColumns]);

    // Find row for shipment1
    const row1 = rows.find((r) => r[0] === formatTrackingNumber(shipment1.trackingNumber));
    expect(row1).toBeDefined();
    if (!row1) throw new Error("expected row1");
    // Delivery columns:
    // Fecha de estado (delivered at 16:30 UTC -> 11:30 Bogotá)
    expect(row1[28]).toBe("01/10/2026 11:30");
    // Mensajero
    expect(row1[29]).toBe("Carlos Pérez");
    // Recibido por
    expect(row1[30]).toBe("Mariana Ruiz");
    // Efectivo
    expect(row1[31]).toBe("50000");
    // Transferencia a la empresa
    expect(row1[32]).toBe("0");
    // Transferencia al cliente
    expect(row1[33]).toBe("0");
    // Pagos por cuenta del cliente
    expect(row1[34]).toBe("");
    // Intentos
    expect(row1[35]).toBe("1");
    // Motivo de la última novedad
    expect(row1[36]).toBe("");
    // Safe formula neutralization on instructions
    expect(row1[25]).toBe("'=SUM(1,1)");

    // Find row for errand
    const rowErrand = rows.find((r) => r[0] === formatTrackingNumber(errand.trackingNumber));
    expect(rowErrand).toBeDefined();
    if (!rowErrand) throw new Error("expected rowErrand");
    expect(rowErrand[28]).toBe("01/10/2026 12:00"); // 17:00 UTC -> 12:00 Bogotá
    expect(rowErrand[29]).toBe("Carlos Pérez");
    expect(rowErrand[34]).toBe("12000"); // disbursement amount

    // Find row for shipment2 (2 attempts, exception + delivery)
    const row2 = rows.find((r) => r[0] === formatTrackingNumber(shipment2.trackingNumber));
    expect(row2).toBeDefined();
    if (!row2) throw new Error("expected row2");
    expect(row2[28]).toBe("01/10/2026 13:15"); // 18:15 UTC -> 13:15 Bogotá
    expect(row2[29]).toBe("Carlos Pérez");
    expect(row2[30]).toBe("Andrés Duque");
    expect(row2[31]).toBe("0");
    expect(row2[32]).toBe("80000");
    expect(row2[35]).toBe("2"); // 2 attempts!
    expect(row2[36]).toBe("Destinatario ausente"); // last exception reason
  });

  it("excludes reverted delivery records from attempts and collections", async () => {
    const shipment = await registerShipment(t, owner.cookie, catalog, {
      recipientName: "Pedro Páramo",
      codAmount: 30000,
    });
    const route = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route, "/dispatch");
    await pickUp(database.db, shipment.id, now);

    const recordId = crypto.randomUUID();
    await send(t, courierUser.cookie, "/api/courier/records", {
      deviceNow: now.toISOString(),
      records: [
        {
          id: recordId,
          kind: "delivery",
          shipmentId: shipment.id,
          receivedByName: "Pedro Páramo",
          cashAmount: 30000,
          occurredAt: now.toISOString(),
        },
      ],
    });

    // Revert the delivery
    await send(t, owner.cookie, `/api/courier-records/${recordId}/revert`, {
      actionId: crypto.randomUUID(),
      reason: "Entregado a la persona equivocada",
    });

    const res = await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    const row = rows.find((r) => r[0] === formatTrackingNumber(shipment.trackingNumber));
    expect(row).toBeDefined();
    if (!row) throw new Error("expected row");

    // Reverted delivery is not counted
    expect(row[30]).toBe(""); // Recibido por
    expect(row[31]).toBe(""); // Efectivo
    expect(row[35]).toBe("0"); // Intentos
  });
});

describe("GET /api/export/courier-records (003/T085)", () => {
  it("exports empty courier-records table with headers", async () => {
    const res = await t.request("/api/export/courier-records?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      "ID",
      "Guía",
      "Tipo",
      "Resultado",
      "Motivo no aplicado",
      "Mensajero",
      "Registrado por",
      "En representación",
      "Fecha ocurrencia",
      "Fecha registro",
      "Recibido por",
      "Efectivo",
      "Transferencia a la empresa",
      "Transferencia al cliente",
      "Motivo novedad",
      "Nota",
      "Valor pago por cuenta",
      "Beneficiario",
      "Anulado el",
      "Anulado por",
      "Motivo anulación",
    ]);
  });

  it("exports courier records with Spanish headers, applied/reverted/corrected/not_applied outcomes", async () => {
    const shipment = await registerShipment(t, owner.cookie, catalog, {
      recipientName: "Elena Poniatowska",
      codAmount: 45000,
    });
    const route = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route, "/dispatch");
    await pickUp(database.db, shipment.id, now);

    const deliveryId = crypto.randomUUID();
    await send(t, courierUser.cookie, "/api/courier/records", {
      deviceNow: now.toISOString(),
      records: [
        {
          id: deliveryId,
          kind: "delivery",
          shipmentId: shipment.id,
          receivedByName: "=1+1", // formula injection attempt
          cashAmount: 45000,
          occurredAt: now.toISOString(),
        },
      ],
    });

    // Correct the delivery record
    await send(t, owner.cookie, `/api/courier-records/${deliveryId}/correct`, {
      actionId: crypto.randomUUID(),
      reason: "Corrección de nombre",
      receivedByName: "Elena P.",
    });

    // Send a duplicate record
    await send(t, courierUser.cookie, "/api/courier/records", {
      deviceNow: now.toISOString(),
      records: [
        {
          id: deliveryId,
          kind: "delivery",
          shipmentId: shipment.id,
          receivedByName: "Elena P.",
          cashAmount: 45000,
          occurredAt: now.toISOString(),
        },
      ],
    });

    // Send a not_applied record (delivery attempted before pickup)
    const unpicked = await registerShipment(t, owner.cookie, catalog);
    const unpickedDeliveryId = crypto.randomUUID();
    await send(t, courierUser.cookie, "/api/courier/records", {
      deviceNow: now.toISOString(),
      records: [
        {
          id: unpickedDeliveryId,
          kind: "delivery",
          shipmentId: unpicked.id,
          receivedByName: "Elena Poniatowska",
          occurredAt: now.toISOString(),
        },
      ],
    });

    const res = await t.request("/api/export/courier-records?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows.length).toBeGreaterThanOrEqual(4); // header + pickup + delivery + not_applied

    const deliveryRow = rows.find((r) => r[0] === deliveryId);
    expect(deliveryRow).toBeDefined();
    if (!deliveryRow) throw new Error("expected deliveryRow");
    expect(deliveryRow[1]).toBe(formatTrackingNumber(shipment.trackingNumber));
    expect(deliveryRow[2]).toBe("Entrega");
    expect(deliveryRow[3]).toBe("Aplicado");
    expect(deliveryRow[5]).toBe("Carlos Pérez");
    expect(deliveryRow[10]).toBe("Elena P."); // corrected value
    expect(deliveryRow[11]).toBe("45000"); // integer

    const notAppliedRow = rows.find((r) => r[0] === unpickedDeliveryId);
    expect(notAppliedRow).toBeDefined();
    if (!notAppliedRow) throw new Error("expected notAppliedRow");
    expect(notAppliedRow[3]).toBe("No aplicado");
    expect(notAppliedRow[4]).toBe("El envío no se ha recogido.");
  });
});

describe("GET /api/export/routes (003/T085)", () => {
  it("exports empty routes table with headers", async () => {
    const res = await t.request("/api/export/routes?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      "Fecha",
      "Ruta",
      "Estado ruta",
      "Mensajero",
      "Parada",
      "Tipo de parada",
      "Dirección",
      "Barrio",
      "Guía",
      "Tipo tarea",
      "Estado tarea",
      "Problema de recogida",
      "Completada el",
      "Completada por",
      "Despachada el",
      "Finalizada el",
    ]);
  });

  it("exports routes (one row per stop task) with accurate data and Bogotá dates", async () => {
    const shipment = await registerShipment(t, owner.cookie, catalog);
    const route = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route, "/dispatch");
    await pickUp(database.db, shipment.id, now);

    const res = await t.request("/api/export/routes?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    // Route has 2 stops (pickup + delivery), 1 task each -> 2 rows
    expect(rows).toHaveLength(3); // header + 2 tasks

    const [header, ...taskRows] = rows;
    expect(header).toEqual([
      "Fecha",
      "Ruta",
      "Estado ruta",
      "Mensajero",
      "Parada",
      "Tipo de parada",
      "Dirección",
      "Barrio",
      "Guía",
      "Tipo tarea",
      "Estado tarea",
      "Problema de recogida",
      "Completada el",
      "Completada por",
      "Despachada el",
      "Finalizada el",
    ]);

    const pickupTask = taskRows.find((r) => r[9] === "Recogida");
    expect(pickupTask).toBeDefined();
    if (!pickupTask) throw new Error("expected pickupTask");
    expect(pickupTask[0]).toBe("01/10/2026");
    expect(pickupTask[1]).toBe(String(route.number));
    expect(pickupTask[2]).toBe("En curso");
    expect(pickupTask[3]).toBe("Carlos Pérez");
    expect(pickupTask[8]).toBe(formatTrackingNumber(shipment.trackingNumber));
    expect(pickupTask[10]).toBe("Completada");
    expect(pickupTask[12]).toBe("01/10/2026 10:00"); // 15:00 UTC -> 10:00 Bogotá
    expect(pickupTask[13]).toBe("Carlos Pérez");

    const deliveryTask = taskRows.find((r) => r[9] === "Entrega");
    expect(deliveryTask).toBeDefined();
    if (!deliveryTask) throw new Error("expected deliveryTask");
    expect(deliveryTask[10]).toBe("Pendiente");
  });
});

describe("GET /api/export/handovers (003/T085)", () => {
  it("exports empty handovers table with headers", async () => {
    const res = await t.request("/api/export/handovers?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      "ID",
      "Guía",
      "Mensajero origen",
      "Mensajero destino",
      "Ruta origen",
      "Ruta destino",
      "Estado",
      "Motivo",
      "Solicitado por",
      "Solicitado el",
      "Resuelto por",
      "Resuelto el",
      "En representación",
    ]);
  });

  it("exports handovers with Spanish headers, timestamps and couriers", async () => {
    const courier2 = await createCourier(database.db, "Beto Gómez");
    const shipment = await registerShipment(t, owner.cookie, catalog);
    const route1 = await createRoute(t, owner.cookie, {
      shipmentIds: [shipment.id],
      courierId: courierUser.id,
    });
    await routeAction(t, owner.cookie, route1, "/dispatch");
    await pickUp(database.db, shipment.id, now);

    // Create route2 for Beto with another shipment and reassign shipment to route2 -> creates handover
    const otherShipment = await registerShipment(t, owner.cookie, catalog);
    const route2 = await createRoute(t, owner.cookie, {
      shipmentIds: [otherShipment.id],
      courierId: courier2,
    });
    await routeAction(t, owner.cookie, route2, "/dispatch");

    const reassignRes = await send<{ handover: Handover }>(
      t,
      owner.cookie,
      `/api/shipments/${shipment.id}/reassign`,
      {
        actionId: crypto.randomUUID(),
        toRouteId: route2.id,
        reason: "Reasignación por zona",
      },
    );
    expect(reassignRes.status).toBe(200);

    const res = await t.request("/api/export/handovers?format=csv", { cookie: owner.cookie });
    const rows = await parseCsv(res);
    expect(rows).toHaveLength(2); // header + 1 handover

    const row = rows[1];
    expect(row).toBeDefined();
    if (!row) throw new Error("expected row");
    expect(row[1]).toBe(formatTrackingNumber(shipment.trackingNumber));
    expect(row[2]).toBe("Carlos Pérez");
    expect(row[3]).toBe("Beto Gómez");
    expect(row[4]).toBe(String(route1.number));
    expect(row[5]).toBe(String(route2.number));
    expect(row[6]).toBe("Traspaso pendiente");
    expect(row[8]).toBe("Santiago Marín");
    expect(row[9]).toBe("01/10/2026 10:00");
    expect(row[12]).toBe("No");
  });
});
