import type { Shipment } from "@domy/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import { readSheet } from "read-excel-file/node";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditEvents, merchants, shipmentEvents, shipments } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { registerShipment } from "./setup/routes.ts";

const objectBody = z.record(z.string(), z.unknown());
const shipmentRowKeys = [
  "id",
  "trackingNumber",
  "trackingCode",
  "recipientName",
  "neighborhood",
  "status",
  "notifiedAt",
];

type NotificationState = {
  fields: { id: string; notifiedAt: string | null; notifiedBy: string | null }[];
  events: {
    id: string;
    shipmentId: string;
    clientEventId: string | null;
    occurredAt: string;
    recordedAt: string;
  }[];
};

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string; user: { id: string } };
let courier: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
}, 120_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00.000Z" });
  owner = await t.signIn("owner", { name: "Santiago Marín" });
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher", { name: "John Coordinador" });
  courier = await t.signIn("courier", { name: "Ana Ruiz" });
});

async function register(overrides: Record<string, unknown> = {}): Promise<Shipment> {
  return registerShipment(t, dispatcher.cookie, catalog, overrides);
}

async function registerAt(serviceDate: string): Promise<Shipment> {
  const previousTime = t.now().toISOString();
  try {
    t.setNow(`${serviceDate}T15:00:00.000Z`);
    return await register({ serviceDate });
  } finally {
    t.setNow(previousTime);
  }
}

async function trackingCode(shipmentId: string): Promise<string> {
  const [row] = await database.db
    .select({ code: shipments.trackingCode })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  if (!row) throw new Error("The fixture shipment is missing");
  return row.code;
}

async function merchantCode(merchantId: string): Promise<string> {
  const [row] = await database.db
    .select({ code: merchants.linkCode })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  if (!row) throw new Error("The fixture merchant is missing");
  return row.code;
}

async function postNotification(
  cookie: string,
  actionId: string,
  shipmentIds: unknown,
  actorId?: string,
): Promise<Response> {
  return t.request("/api/notifications", {
    method: "POST",
    cookie,
    body: { actionId, shipmentIds },
    ...(actorId !== undefined && { actorId }),
  });
}

async function notificationState(shipmentIds: string[]): Promise<NotificationState> {
  const [fields, events] = await Promise.all([
    database.db
      .select({
        id: shipments.id,
        notifiedAt: shipments.notifiedAt,
        notifiedBy: shipments.notifiedBy,
      })
      .from(shipments)
      .where(inArray(shipments.id, shipmentIds))
      .orderBy(asc(shipments.id)),
    database.db
      .select({
        id: shipmentEvents.id,
        shipmentId: shipmentEvents.shipmentId,
        clientEventId: shipmentEvents.clientEventId,
        occurredAt: shipmentEvents.occurredAt,
        recordedAt: shipmentEvents.recordedAt,
      })
      .from(shipmentEvents)
      .where(
        and(eq(shipmentEvents.type, "notified"), inArray(shipmentEvents.shipmentId, shipmentIds)),
      )
      .orderBy(asc(shipmentEvents.shipmentId), asc(shipmentEvents.id)),
  ]);
  return {
    fields: fields.map((row) => ({
      id: row.id,
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
      notifiedBy: row.notifiedBy,
    })),
    events: events.map((event) => ({
      id: event.id,
      shipmentId: event.shipmentId,
      clientEventId: event.clientEventId,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
    })),
  };
}

function records(value: unknown): Record<string, unknown>[] {
  return z.array(objectBody).parse(value);
}

function expectKeys(value: unknown, keys: string[]): void {
  expect(Object.keys(objectBody.parse(value)).sort()).toEqual([...keys].sort());
}

function findRecord(
  values: Record<string, unknown>[],
  key: string,
  expected: string,
): Record<string, unknown> {
  const found = values.find((value) => value[key] === expected);
  if (!found) throw new Error(`The expected ${key} fixture row is missing`);
  return found;
}

async function expectListedShipments(
  merchantShipmentRows: Record<string, unknown>[],
  expectedShipments: Shipment[],
): Promise<void> {
  for (const shipment of expectedShipments) {
    const row = findRecord(merchantShipmentRows, "id", shipment.id);
    expectKeys(row, shipmentRowKeys);
    expect(row["trackingNumber"]).toBe(shipment.trackingNumber);
    expect(row["recipientName"]).toBe(shipment.recipientName);
    expect(row["status"]).toBe("registered");
    expect(row["notifiedAt"]).toBeNull();
    expect(row["neighborhood"]).toBe("Laureles");
    const code = await trackingCode(shipment.id);
    expect(typeof row["trackingCode"] === "string").toBe(true);
    expect(row["trackingCode"] === code).toBe(true);
    expect(/^[A-Za-z0-9_-]{22}$/u.test(code)).toBe(true);
  }
}

describe("notifications integration (004/T018, FR-015–FR-018, R15)", () => {
  it("preserves existing shipment detail and export permissions", async () => {
    const shipment = await register();
    const [
      ownerDetail,
      dispatcherDetail,
      courierDetail,
      ownerExport,
      dispatcherExport,
      courierExport,
    ] = await Promise.all([
      t.request(`/api/shipments/${shipment.id}`, { cookie: owner.cookie }),
      t.request(`/api/shipments/${shipment.id}`, { cookie: dispatcher.cookie }),
      t.request(`/api/shipments/${shipment.id}`, { cookie: courier.cookie }),
      t.request("/api/shipments/export?format=csv", { cookie: owner.cookie }),
      t.request("/api/shipments/export?format=csv", { cookie: dispatcher.cookie }),
      t.request("/api/shipments/export?format=csv", { cookie: courier.cookie }),
    ]);

    expect(ownerDetail.status).toBe(200);
    expect(dispatcherDetail.status).toBe(200);
    expect(courierDetail.status).toBe(403);
    expect(ownerExport.status).toBe(200);
    expect(dispatcherExport.status).toBe(403);
    expect(courierExport.status).toBe(403);
  });

  it("lists date-scoped merchants and active shipments with codes and status", async () => {
    const bullishFirst = await register({ recipientName: "Laura Gómez" });
    const bullishSecond = await register({ recipientName: "Camila Torres" });
    const amyShipment = await register({
      merchantId: catalog.merchant.amy,
      pickupPointId: catalog.pickup.amy,
      fee: 9700,
      recipientName: "Andrés Ríos",
    });
    const nextDayShipment = await registerAt("2026-10-02");
    const voidedShipment = await register({ recipientName: "Envío anulado" });
    const voidResponse = await t.request(`/api/shipments/${voidedShipment.id}/void`, {
      method: "POST",
      cookie: dispatcher.cookie,
      body: {
        actionId: crypto.randomUUID(),
        version: voidedShipment.version,
        reason: "El cliente canceló el pedido",
      },
    });
    expect(voidResponse.status).toBe(200);

    const deactivateAmyResponse = await t.request(`/api/merchants/${catalog.merchant.amy}`, {
      method: "PATCH",
      cookie: owner.cookie,
      body: { actionId: crypto.randomUUID(), isActive: false },
    });
    expect(deactivateAmyResponse.status).toBe(200);

    const [ownerResponse, dispatcherResponse] = await Promise.all([
      t.request("/api/notifications?date=2026-10-01", { cookie: owner.cookie }),
      t.request("/api/notifications?date=2026-10-01", { cookie: dispatcher.cookie }),
    ]);
    expect(ownerResponse.status).toBe(200);
    expect(dispatcherResponse.status).toBe(200);

    const body = objectBody.parse(await ownerResponse.json());
    expectKeys(body, ["merchants"]);
    const merchantRows = records(body["merchants"]);
    const expectedMerchantIds = [catalog.merchant.amy, catalog.merchant.bullish].sort();
    expect(merchantRows.map((row) => String(row["merchantId"])).sort()).toEqual(
      expectedMerchantIds,
    );

    const bullish = findRecord(merchantRows, "merchantId", catalog.merchant.bullish);
    const amy = findRecord(merchantRows, "merchantId", catalog.merchant.amy);
    for (const merchant of [bullish, amy]) {
      expectKeys(merchant, [
        "merchantId",
        "name",
        "whatsappPhone",
        "linkCode",
        "isActive",
        "shipments",
      ]);
      const linkCode = merchant["linkCode"];
      expect(typeof linkCode === "string" && /^[A-Za-z0-9_-]{22}$/u.test(linkCode)).toBe(true);
      expect(
        typeof linkCode === "string" &&
          linkCode === (await merchantCode(String(merchant["merchantId"]))),
      ).toBe(true);
    }
    expect(bullish["name"]).toBe("Bullish Hype");
    expect(bullish["whatsappPhone"]).toBe("3000000001");
    expect(bullish["isActive"]).toBe(true);
    expect(amy["name"]).toBe("Amy Tecnology");
    expect(amy["whatsappPhone"]).toBeNull();
    expect(amy["isActive"]).toBe(false);

    const bullishRows = records(bullish["shipments"]);
    const amyRows = records(amy["shipments"]);
    expect(bullishRows.map((row) => String(row["id"])).sort()).toEqual(
      [bullishFirst.id, bullishSecond.id].sort(),
    );
    expect(amyRows.map((row) => String(row["id"]))).toEqual([amyShipment.id]);
    await expectListedShipments(bullishRows, [bullishFirst, bullishSecond]);
    await expectListedShipments(amyRows, [amyShipment]);

    t.setNow("2026-10-02T00:30:00.000Z");
    const defaultDateResponse = await t.request("/api/notifications", { cookie: owner.cookie });
    expect(defaultDateResponse.status).toBe(200);
    const defaultDateBody = objectBody.parse(await defaultDateResponse.json());
    expect(defaultDateBody["merchants"]).toEqual(body["merchants"]);

    const nextDayResponse = await t.request("/api/notifications?date=2026-10-02", {
      cookie: dispatcher.cookie,
    });
    expect(nextDayResponse.status).toBe(200);
    const nextDayBody = objectBody.parse(await nextDayResponse.json());
    const nextDayMerchants = records(nextDayBody["merchants"]);
    expect(nextDayMerchants.map((row) => String(row["merchantId"]))).toEqual([
      catalog.merchant.bullish,
    ]);
    const nextDayRows = records(nextDayMerchants[0]?.["shipments"]);
    expect(nextDayRows.map((row) => String(row["id"]))).toEqual([nextDayShipment.id]);
    expect(nextDayRows.some((row) => row["id"] === voidedShipment.id)).toBe(false);
  });

  it("marks a batch once and binds its receipt to actor, operation, and sorted IDs", async () => {
    const first = await register({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const second = await register({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      recipientName: "Camila Torres",
    });
    const extra = await register({ recipientName: "Andrés Ríos" });
    const shipmentIds = [second.id, first.id];
    const actionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    t.setNow("2026-10-01T18:17:00.000Z");
    const notifiedAt = t.now().toISOString();

    const response = await postNotification(dispatcher.cookie, actionId, shipmentIds);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");

    const firstState = await notificationState(shipmentIds);
    expect(firstState.fields).toHaveLength(2);
    expect(firstState.fields.every((row) => row.notifiedAt === notifiedAt)).toBe(true);
    expect(firstState.fields.every((row) => row.notifiedAt !== first.registeredAt)).toBe(true);
    expect(firstState.fields.every((row) => row.notifiedBy === dispatcher.user.id)).toBe(true);
    expect(firstState.events).toHaveLength(2);

    const events = await database.db
      .select()
      .from(shipmentEvents)
      .where(
        and(eq(shipmentEvents.type, "notified"), inArray(shipmentEvents.shipmentId, shipmentIds)),
      )
      .orderBy(asc(shipmentEvents.shipmentId), asc(shipmentEvents.id));
    expect(events.every((event) => event.type === "notified")).toBe(true);
    expect(
      events.every(
        (event) =>
          event.occurredAt.toISOString() === notifiedAt &&
          event.recordedAt.toISOString() === notifiedAt,
      ),
    ).toBe(true);
    const receipts = events.filter((event) => event.clientEventId === actionId);
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0];
    if (!receipt) throw new Error("The notification receipt event is missing");
    expect(receipt.actorUserId).toBe(dispatcher.user.id);
    const metadata = objectBody.parse(receipt.changes);
    expect(typeof metadata["operation"] === "string" && metadata["operation"] !== "").toBe(true);
    expect(metadata["shipmentIds"]).toEqual([...shipmentIds].sort());

    const [firstCode, secondCode] = await Promise.all([
      trackingCode(first.id),
      trackingCode(second.id),
    ]);
    const audits = await database.db
      .select({ changes: auditEvents.changes })
      .from(auditEvents)
      .where(eq(auditEvents.clientEventId, actionId));
    const serializedRecords = JSON.stringify({ events, audits });
    expect(serializedRecords.includes(firstCode)).toBe(false);
    expect(serializedRecords.includes(secondCode)).toBe(false);

    const detailResponse = await t.request(`/api/shipments/${first.id}`, { cookie: owner.cookie });
    expect(detailResponse.status).toBe(200);
    const detail = objectBody.parse(await detailResponse.json());
    expect("trackingCode" in detail).toBe(true);
    expect(detail["trackingCode"] === firstCode).toBe(true);
    expect(detail["notifiedAt"]).toBe(notifiedAt);
    expect("notifiedBy" in detail).toBe(true);
    expect(detail["notifiedBy"]).toBe(dispatcher.user.id);
    const notifiedEvents = records(detail["events"]).filter(
      (event) => event["type"] === "notified",
    );
    expect(notifiedEvents).toHaveLength(1);
    expect(notifiedEvents[0]?.["changes"]).toBeNull();
    expect(notifiedEvents[0]?.["occurredAt"]).toBe(notifiedAt);
    expect(notifiedEvents[0]?.["recordedAt"]).toBe(notifiedAt);
    expect(objectBody.parse(notifiedEvents[0]?.["actor"])["id"]).toBe(dispatcher.user.id);

    const replay = await postNotification(
      dispatcher.cookie,
      actionId.toUpperCase(),
      shipmentIds.map((id) => id.toUpperCase()).reverse(),
    );
    expect(replay.status).toBe(204);
    expect(await notificationState(shipmentIds)).toEqual(firstState);

    const actorMismatch = await postNotification(owner.cookie, actionId, shipmentIds);
    expect(actorMismatch.status).toBe(409);
    expect(await notificationState(shipmentIds)).toEqual(firstState);

    const payloadMismatch = await postNotification(dispatcher.cookie, actionId, [
      first.id,
      extra.id,
    ]);
    expect(payloadMismatch.status).toBe(409);
    const afterPayloadMismatch = await notificationState([first.id, second.id, extra.id]);
    expect(afterPayloadMismatch.fields.find((row) => row.id === extra.id)?.notifiedAt).toBeNull();
    expect(afterPayloadMismatch.events).toEqual(firstState.events);

    t.setNow("2026-10-01T19:45:00.000Z");
    const includeAllActionId = crypto.randomUUID();
    const includeAll = await postNotification(owner.cookie, includeAllActionId, shipmentIds);
    expect(includeAll.status).toBe(204);
    const secondState = await notificationState(shipmentIds);
    expect(secondState.fields).toEqual(firstState.fields);
    expect(secondState.events).toHaveLength(4);
    expect(
      secondState.events.filter((event) => event.clientEventId === includeAllActionId),
    ).toHaveLength(1);
  });

  it("keeps a selected shipment mark and replay valid after its merchant is deactivated", async () => {
    const shipment = await register();
    const actionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const selectionResponse = await t.request("/api/notifications?date=2026-10-01", {
      cookie: dispatcher.cookie,
    });
    expect(selectionResponse.status).toBe(200);
    const selectionBody = objectBody.parse(await selectionResponse.json());
    const selectedMerchant = findRecord(
      records(selectionBody["merchants"]),
      "merchantId",
      catalog.merchant.bullish,
    );
    expect(selectedMerchant["isActive"]).toBe(true);
    expect(records(selectedMerchant["shipments"]).map((row) => row["id"])).toContain(shipment.id);

    const deactivateResponse = await t.request(`/api/merchants/${catalog.merchant.bullish}`, {
      method: "PATCH",
      cookie: owner.cookie,
      body: { actionId: crypto.randomUUID(), isActive: false },
    });
    expect(deactivateResponse.status).toBe(200);

    const inactiveListResponse = await t.request("/api/notifications?date=2026-10-01", {
      cookie: dispatcher.cookie,
    });
    expect(inactiveListResponse.status).toBe(200);
    const inactiveListBody = objectBody.parse(await inactiveListResponse.json());
    const inactiveMerchant = findRecord(
      records(inactiveListBody["merchants"]),
      "merchantId",
      catalog.merchant.bullish,
    );
    expect(inactiveMerchant["isActive"]).toBe(false);
    expect(records(inactiveMerchant["shipments"]).map((row) => row["id"])).toContain(shipment.id);

    t.setNow("2026-10-01T18:17:00.000Z");
    const notifiedAt = t.now().toISOString();
    const markResponse = await postNotification(dispatcher.cookie, actionId, [shipment.id]);
    expect(markResponse.status).toBe(204);
    const markedState = await notificationState([shipment.id]);
    expect(markedState.fields).toEqual([
      { id: shipment.id, notifiedAt, notifiedBy: dispatcher.user.id },
    ]);
    expect(markedState.events).toHaveLength(1);
    expect(
      markedState.events.every(
        (event) => event.occurredAt === notifiedAt && event.recordedAt === notifiedAt,
      ),
    ).toBe(true);

    const replayResponse = await postNotification(dispatcher.cookie, actionId.toUpperCase(), [
      shipment.id.toUpperCase(),
    ]);
    expect(replayResponse.status).toBe(204);
    expect(await notificationState([shipment.id])).toEqual(markedState);
  });

  it("shows a new same-day shipment as unnotified after an earlier batch", async () => {
    const included = await register();
    const firstAction = await postNotification(dispatcher.cookie, crypto.randomUUID(), [
      included.id,
    ]);
    expect(firstAction.status).toBe(204);
    const newShipment = await register({ recipientName: "Nuevo destinatario" });

    const response = await t.request("/api/notifications?date=2026-10-01", {
      cookie: dispatcher.cookie,
    });
    expect(response.status).toBe(200);
    const body = objectBody.parse(await response.json());
    const merchantRows = records(body["merchants"]);
    const merchant = findRecord(merchantRows, "merchantId", catalog.merchant.bullish);
    const rows = records(merchant["shipments"]);
    expect(rows.map((row) => String(row["id"])).sort()).toEqual(
      [included.id, newShipment.id].sort(),
    );
    expect(findRecord(rows, "id", included.id)["notifiedAt"]).toBe(t.now().toISOString());
    expect(findRecord(rows, "id", newShipment.id)["notifiedAt"]).toBeNull();
  });

  it("rejects empty, duplicate, malformed, and partially missing batches without effects", async () => {
    const seed = await register();
    const target = await register({ recipientName: "Validación atómica" });
    const seedResponse = await postNotification(dispatcher.cookie, crypto.randomUUID(), [seed.id]);
    expect(seedResponse.status).toBe(204);
    const before = await notificationState([seed.id, target.id]);
    const missingId = crypto.randomUUID();
    const invalidBatches: unknown[] = [
      [],
      [target.id, target.id],
      [target.id, missingId],
      [target.id, "not-a-uuid"],
    ];

    for (const shipmentIds of invalidBatches) {
      const response = await postNotification(dispatcher.cookie, crypto.randomUUID(), shipmentIds);
      expect(response.status >= 400 && response.status < 500).toBe(true);
      expect(await notificationState([seed.id, target.id])).toEqual(before);
    }
  });

  it("creates one notification effect for concurrent identical action replays", async () => {
    const shipment = await register();
    const actionId = crypto.randomUUID();
    const responses = await Promise.all([
      postNotification(dispatcher.cookie, actionId, [shipment.id]),
      postNotification(dispatcher.cookie, actionId, [shipment.id]),
    ]);
    expect(responses.map((response) => response.status)).toEqual([204, 204]);
    const state = await notificationState([shipment.id]);
    expect(state.fields).toHaveLength(1);
    expect(state.fields[0]?.notifiedAt).toBe(t.now().toISOString());
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.shipmentId).toBe(shipment.id);
    expect(state.events[0]?.clientEventId).toBe(actionId);
  });

  it("rejects an action UUID already used by another shipment operation", async () => {
    const voided = await register({ recipientName: "Operación anterior" });
    const target = await register({ recipientName: "No debe marcarse" });
    const actionId = crypto.randomUUID();
    const voidResponse = await t.request(`/api/shipments/${voided.id}/void`, {
      method: "POST",
      cookie: dispatcher.cookie,
      body: {
        actionId,
        version: voided.version,
        reason: "El cliente canceló el pedido",
      },
    });
    expect(voidResponse.status).toBe(200);

    const response = await postNotification(dispatcher.cookie, actionId, [target.id]);
    expect(response.status).toBe(409);
    expect(await notificationState([target.id])).toEqual({
      fields: [{ id: target.id, notifiedAt: null, notifiedBy: null }],
      events: [],
    });
  });

  it("exports the Notificado column for shipment rows", async () => {
    await register();
    const response = await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
    expect(response.status).toBe(200);
    const csv = (await response.text()).replace(/^\uFEFF/u, "");
    const header = csv.split("\r\n")[0] ?? "";
    expect(header.split(",").includes("Notificado")).toBe(true);
  });

  it("exports the first notification instant in its Bogotá cell", async () => {
    const shipment = await register({ recipientName: "Hora de notificación" });
    t.setNow("2026-10-01T18:17:00.000Z");
    await database.db
      .update(shipments)
      .set({ notifiedAt: t.now(), notifiedBy: dispatcher.user.id })
      .where(eq(shipments.id, shipment.id));

    const response = await t.request("/api/shipments/export?format=csv", { cookie: owner.cookie });
    expect(response.status).toBe(200);
    const lines = (await response.text())
      .replace(/^\uFEFF/u, "")
      .trimEnd()
      .split("\r\n");
    const header = lines[0]?.split(",") ?? [];
    const trackingCell = `${shipment.trackingNumber.slice(0, 4)}-${shipment.trackingNumber.slice(4)}`;
    const row = lines
      .slice(1)
      .map((line) => line.split(","))
      .find((cells) => cells[0] === trackingCell);
    const notifiedIndex = header.indexOf("Notificado");
    const notificationCell = row?.[notifiedIndex >= 0 ? notifiedIndex : header.length];

    expect(notificationCell).toBe("01/10/2026 13:17");
    expect(notifiedIndex).toBe(header.length - 1);
    expect(row?.[header.indexOf("Registrado el")]).toBe("01/10/2026 10:00");

    const xlsxResponse = await t.request("/api/shipments/export?format=xlsx", {
      cookie: owner.cookie,
    });
    expect(xlsxResponse.status).toBe(200);
    const sheet = await readSheet(Buffer.from(await xlsxResponse.arrayBuffer()));
    const xlsxHeader = sheet[0] ?? [];
    const xlsxRow = sheet.slice(1).find((cells) => cells[0] === trackingCell);
    expect(xlsxHeader.at(-1)).toBe("Notificado");
    expect(xlsxRow?.[xlsxHeader.length - 1]).toBe("01/10/2026 13:17");
  });

  it("rejects a stale captured actor without creating a notification", async () => {
    const shipment = await register();
    const response = await postNotification(
      owner.cookie,
      crypto.randomUUID(),
      [shipment.id],
      dispatcher.user.id,
    );

    expect(response.status).toBe(409);
    expect(await notificationState([shipment.id])).toEqual({
      fields: [{ id: shipment.id, notifiedAt: null, notifiedBy: null }],
      events: [],
    });
  });

  it("treats an invalid captured actor UUID as invalid_request", async () => {
    const shipment = await register();
    const response = await postNotification(
      dispatcher.cookie,
      crypto.randomUUID(),
      [shipment.id],
      "not-a-uuid",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    expect(await notificationState([shipment.id])).toEqual({
      fields: [{ id: shipment.id, notifiedAt: null, notifiedBy: null }],
      events: [],
    });
  });

  it("denies notification listing to a courier", async () => {
    const response = await t.request("/api/notifications?date=2026-10-01", {
      cookie: courier.cookie,
    });
    expect(response.status).toBe(403);
  });

  it("denies notification marking to a courier", async () => {
    const shipment = await register();
    const response = await postNotification(courier.cookie, crypto.randomUUID(), [shipment.id]);
    expect(response.status).toBe(403);
  });
});
