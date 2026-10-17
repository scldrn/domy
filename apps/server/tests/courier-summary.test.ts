import type { Shipment } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, snapshot, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let cookie: string;
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
  catalog = await createCatalog(database.db, owner.user.id);
  cookie = (await t.signIn("dispatcher")).cookie;
  ana = await courierWithAccount(t, database.db);
});

async function dispatch(list: Shipment[]) {
  const route = await createRoute(t, cookie, {
    courierId: ana.id,
    shipmentIds: list.map((shipment) => shipment.id),
  });
  const result = await routeAction(t, cookie, route, "/dispatch");
  expect(result.status).toBe(200);
  return result.body;
}
async function record(shipment: Shipment, values: Record<string, unknown>) {
  const id = crypto.randomUUID();
  const result = await sendRecords(t, ana, [{ id, shipmentId: shipment.id, ...values }]);
  expect(result.status).toBe(200);
  expect(result.body.results).toEqual([{ id, outcome: "applied" }]);
  return id;
}
async function deliver(shipment: Shipment, amounts: Record<string, number>) {
  await record(shipment, { kind: "pickup" });
  return record(shipment, { kind: "delivery", receivedByName: "Laura Gómez", ...amounts });
}

/** T077, FR-037 / US7 AC1/AC3: actual records, corrections and reverts in PostgreSQL. */
describe("the courier's day summary", () => {
  it("keeps all three collection methods and disbursements after the route finishes", async () => {
    const list = await Promise.all(
      [100_000, 50_000, 30_000].map((codAmount) =>
        registerShipment(t, cookie, catalog, { codAmount }),
      ),
    );
    await dispatch(list);
    const [cash, company, merchant] = list;
    if (!cash || !company || !merchant) throw new Error("Missing fixture shipment");
    await deliver(cash, { cashAmount: 100_000 });
    await deliver(company, { companyTransferAmount: 50_000 });
    await deliver(merchant, { merchantTransferAmount: 30_000 });
    await record(cash, { kind: "disbursement", amount: 12_000, payee: "Transportadora" });
    const result = await snapshot(t, ana);
    expect(result.status).toBe(200);
    expect(result.body.route).toBeNull();
    expect(result.body.summary).toEqual({
      date: "2026-10-01",
      deliveries: 3,
      exceptions: 0,
      returns: 0,
      pendingStops: 0,
      cash: 100_000,
      companyTransfer: 50_000,
      merchantTransfer: 30_000,
      disbursements: 12_000,
      cashToHandOver: 88_000,
    });
    const other = await courierWithAccount(t, database.db, "Otro mensajero");
    expect((await snapshot(t, other)).body.summary).toMatchObject({
      deliveries: 0,
      cash: 0,
      disbursements: 0,
    });
    expect((await send(t, cookie, "/api/courier/route")).status).toBe(403);
  });

  it("uses corrected collections/disbursements and removes a reverted delivery", async () => {
    const shipment = await registerShipment(t, cookie, catalog, { codAmount: 100_000 });
    await dispatch([shipment, await registerShipment(t, cookie, catalog)]);
    const deliveryId = await deliver(shipment, { cashAmount: 100_000 });
    const paymentId = await record(shipment, {
      kind: "disbursement",
      amount: 12_000,
      payee: "Transportadora",
    });
    for (const [id, values] of [
      [deliveryId, { cashAmount: 80_000, companyTransferAmount: 20_000 }],
      [paymentId, { amount: 15_000 }],
    ] as const) {
      expect(
        (
          await send(t, cookie, `/api/courier-records/${id}/correct`, {
            actionId: crypto.randomUUID(),
            reason: "Verificado con mensajero",
            ...values,
          })
        ).status,
      ).toBe(200);
    }
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      deliveries: 1,
      cash: 80_000,
      companyTransfer: 20_000,
      disbursements: 15_000,
      cashToHandOver: 65_000,
    });
    expect(
      (
        await send(t, cookie, `/api/courier-records/${deliveryId}/revert`, {
          actionId: crypto.randomUUID(),
          reason: "Entrega registrada por error",
        })
      ).status,
    ).toBe(200);
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      deliveries: 0,
      cash: 0,
      companyTransfer: 0,
      disbursements: 15_000,
      cashToHandOver: -15_000,
    });
  });

  it("groups by occurredAt in Bogotá, excludes duplicate/not-applied records and resets at midnight", async () => {
    const first = await registerShipment(t, cookie, catalog, { codAmount: 100_000 });
    const second = await registerShipment(t, cookie, catalog, { codAmount: 30_000 });
    await dispatch([first, second]);
    t.setNow("2026-10-02T04:59:59Z");
    await deliver(first, { cashAmount: 100_000 });
    const duplicates = await sendRecords(t, ana, [
      {
        shipmentId: first.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 100_000,
      },
      {
        shipmentId: second.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: 30_000,
      },
    ]);
    expect(duplicates.body.results.map((result) => result.outcome)).toEqual([
      "duplicate",
      "not_applied",
    ]);
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      date: "2026-10-01",
      deliveries: 1,
      cash: 100_000,
    });
    t.setNow("2026-10-02T05:00:00Z");
    await deliver(second, { cashAmount: 30_000 });
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      date: "2026-10-02",
      deliveries: 1,
      cash: 30_000,
    });
  });

  it("counts exceptions, returns and pending stops, not individual pending tasks", async () => {
    const first = await registerShipment(t, cookie, catalog);
    const second = await registerShipment(t, cookie, catalog, {
      recipientAddress: "Calle 20 # 40-01",
    });
    const third = await registerShipment(t, cookie, catalog, {
      recipientAddress: "Calle 21 # 40-01",
    });
    const route = await dispatch([first, second, third]);
    expect((await snapshot(t, ana)).body.summary.pendingStops).toBe(4);
    await record(first, { kind: "pickup" });
    expect((await snapshot(t, ana)).body.summary.pendingStops).toBe(4);
    await record(first, { kind: "exception", reason: "recipient_absent" });
    expect(
      (
        await send(t, cookie, `/api/shipments/${first.id}/exception-decision`, {
          actionId: crypto.randomUUID(),
          decision: "return",
          routeId: route.id,
        })
      ).status,
    ).toBe(200);
    await record(first, { kind: "return", receivedByName: "Persona del comercio" });
    expect((await snapshot(t, ana)).body.summary).toMatchObject({
      deliveries: 0,
      exceptions: 1,
      returns: 1,
      pendingStops: 3,
    });
  });
});
