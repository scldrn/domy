import type { AuditEvent } from "@domy/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, merchants, pickupPoints, rateCardEntries } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
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

async function call(
  method: string,
  path: string,
  body?: unknown,
  cookie = dispatcher.cookie,
  actorId?: string,
) {
  const response = await t.request(path, {
    method,
    cookie,
    body,
    ...(actorId !== undefined && { actorId }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("GET /api/audit-events (FR-036)", () => {
  it("lists every master data change with author, time, and values, newest first", async () => {
    const merchantId = crypto.randomUUID();
    await call("POST", "/api/merchants", { id: merchantId, name: "Tienda Luna" });
    const actionId = crypto.randomUUID();
    for (let i = 0; i < 2; i++) {
      await call("PATCH", `/api/merchants/${merchantId}`, { actionId, isActive: false });
    }
    await call("PATCH", `/api/carriers/${catalog.carrier}`, {
      actionId: crypto.randomUUID(),
      name: "Coonorte S. A.",
    });

    const result = await call("GET", "/api/audit-events", undefined, owner.cookie);
    const items = result.body["items"] as AuditEvent[];
    expect(items.map((item) => [item.entityType, item.action])).toEqual([
      ["carrier", "updated"],
      ["merchant", "deactivated"],
      ["merchant", "created"],
    ]);
    expect(items[1]).toMatchObject({
      entityId: merchantId,
      actor: { id: dispatcher.user.id, name: "John Coordinador" },
      occurredAt: "2026-10-01T15:00:00.000Z",
      changes: { isActive: [true, false] },
    });

    const filtered = await call(
      "GET",
      `/api/audit-events?entityType=merchant&entityId=${merchantId}`,
      undefined,
      owner.cookie,
    );
    expect(filtered.body["items"]).toHaveLength(2);
  });

  // Empty receipts are internal idempotency data, never visible edits (001 FR-036, 003 T096).
  it("hides unchanged account links and unlinks while keeping their receipts", async () => {
    const id = crypto.randomUUID();
    expect(
      (
        await call(
          "POST",
          "/api/couriers",
          {
            id,
            name: "Carlos Pérez",
            phone: "3004445566",
            aliases: [],
          },
          owner.cookie,
        )
      ).status,
    ).toBe(201);
    const account = await t.signIn("courier");
    const link = (courierId: string | null, actionId = crypto.randomUUID()) =>
      call(
        "PUT",
        `/api/couriers/accounts/${account.user.id}`,
        { actionId, courierId },
        owner.cookie,
        owner.user.id,
      );
    await link(id);
    const linkReceipt = crypto.randomUUID();
    await link(id, linkReceipt);
    await link(null);
    const unlinkReceipt = crypto.randomUUID();
    await link(null, unlinkReceipt);

    const result = await call("GET", "/api/audit-events", undefined, owner.cookie);
    const items = result.body["items"] as AuditEvent[];

    expect(items).toHaveLength(3);
    expect(items.every((event) => Object.keys(event.changes ?? {}).length > 0)).toBe(true);
    expect(result.body["nextCursor"]).toBeNull();
    expect(
      await database.db
        .select()
        .from(auditEvents)
        .where(inArray(auditEvents.clientEventId, [linkReceipt, unlinkReceipt])),
    ).toHaveLength(2);
  });

  it("filters empty and null changes before paging actual changes", async () => {
    await database.db.insert(auditEvents).values(
      Array.from({ length: 51 }, (_, index) => ({
        entityType: "merchant",
        entityId: catalog.merchant.bullish,
        action: "updated" as const,
        actorUserId: owner.user.id,
        occurredAt: t.now(),
        changes: { name: ["Before", `After ${String(index)}`] },
      })),
    );
    // Newer receipts would otherwise fill the first page, including an unlinked user's receipt.
    await database.db.insert(auditEvents).values(
      Array.from({ length: 56 }, (_, index) => ({
        entityType: index % 2 === 0 ? "merchant" : "user",
        entityId: index % 2 === 0 ? catalog.merchant.bullish : owner.user.id,
        action: "updated" as const,
        actorUserId: owner.user.id,
        occurredAt: t.now(),
        changes: index === 55 ? null : {},
        clientEventId: crypto.randomUUID(),
      })),
    );

    const first = await call("GET", "/api/audit-events", undefined, owner.cookie);
    const firstItems = first.body["items"] as AuditEvent[];
    expect(firstItems).toHaveLength(50);
    expect(firstItems.every((event) => Object.keys(event.changes ?? {}).length > 0)).toBe(true);
    expect(typeof first.body["nextCursor"]).toBe("string");
    const next = await call(
      "GET",
      `/api/audit-events?cursor=${String(first.body["nextCursor"])}`,
      undefined,
      owner.cookie,
    );
    const nextItems = next.body["items"] as AuditEvent[];
    expect(nextItems).toHaveLength(1);
    expect(next.body["nextCursor"]).toBeNull();
    expect(new Set([...firstItems, ...nextItems].map((event) => event.id)).size).toBe(51);
    const filtered = await call(
      "GET",
      `/api/audit-events?entityType=merchant&entityId=${catalog.merchant.bullish}`,
      undefined,
      owner.cookie,
    );
    expect(filtered.body["items"]).toHaveLength(50);
    const userReceipts = await call(
      "GET",
      `/api/audit-events?entityType=user&entityId=${owner.user.id}`,
      undefined,
      owner.cookie,
    );
    expect(userReceipts.body).toMatchObject({ items: [], nextCursor: null });
    expect(await database.db.select().from(auditEvents)).toHaveLength(107);
    expect(
      await database.db.select().from(auditEvents).where(eq(auditEvents.changes, {})),
    ).toHaveLength(55);
  });

  it("is only for the owner", async () => {
    expect((await call("GET", "/api/audit-events")).status).toBe(403);
  });
});

/** Names instead of identifiers (feature 006, FR-020, research R10, contracts/audit-read.md). */
describe("GET /api/audit-events labels (006 US5)", () => {
  const events = async () =>
    (await call("GET", "/api/audit-events", undefined, owner.cookie)).body["items"] as AuditEvent[];
  const insert = (event: {
    entityType: string;
    entityId: string;
    changes: Record<string, [unknown, unknown]>;
  }) =>
    database.db.insert(auditEvents).values({
      ...event,
      action: "updated",
      actorUserId: owner.user.id,
      occurredAt: t.now(),
    });

  it("names the record and the references a real change points to, keeping changes as ids", async () => {
    const result = await call(
      "PATCH",
      `/api/neighborhoods/${catalog.place.laureles}`,
      { actionId: crypto.randomUUID(), rateZoneId: catalog.zone.belloItagui },
      owner.cookie,
    );
    expect(result.status).toBe(200);
    const [event] = await events();
    expect(event).toMatchObject({
      entityType: "neighborhood",
      entityId: catalog.place.laureles,
      entityLabel: "Laureles",
      changes: { rateZoneId: [catalog.zone.medellin, catalog.zone.belloItagui] },
      changeLabels: { rateZoneId: ["Medellín", "Bello–Itagüí"] },
    });
  });

  it("resolves merchant, courier, carrier, neighborhood, user, and rate zone references", async () => {
    const courierId = crypto.randomUUID();
    await call(
      "POST",
      "/api/couriers",
      { id: courierId, name: "Carlos Pérez", phone: "3004445566", aliases: [] },
      owner.cookie,
    );
    const [pickup] = await database.db
      .select({ id: pickupPoints.id, label: pickupPoints.label })
      .from(pickupPoints)
      .where(eq(pickupPoints.merchantId, catalog.merchant.bullish))
      .limit(1);
    if (!pickup) throw new Error("The catalog has no pickup point");
    await database.db.delete(auditEvents);
    await insert({
      entityType: "pickup_point",
      entityId: pickup.id,
      changes: {
        neighborhoodId: [catalog.place.laureles, catalog.place.estadio],
        merchantId: [null, catalog.merchant.bullish],
        label: ["Bodega", "Bodega norte"],
      },
    });
    await insert({
      entityType: "courier",
      entityId: courierId,
      changes: { userId: [null, dispatcher.user.id] },
    });
    await insert({
      entityType: "carrier",
      entityId: catalog.carrier,
      changes: { name: ["Coonorte", "Coonorte S. A."] },
    });
    await insert({
      entityType: "user",
      entityId: dispatcher.user.id,
      changes: { courierId: [courierId, null] },
    });
    await insert({
      entityType: "neighborhood",
      entityId: catalog.place.itagui,
      changes: { municipalityId: [catalog.municipality.medellin, catalog.municipality.itagui] },
    });

    const byType = Object.fromEntries((await events()).map((event) => [event.entityType, event]));
    expect(byType["pickup_point"]).toMatchObject({
      entityLabel: pickup.label,
      changeLabels: {
        neighborhoodId: ["Laureles", "El Estadio"],
        merchantId: [null, "Bullish Hype"],
      },
    });
    // Only reference fields get labels; other values are already readable.
    expect(byType["pickup_point"]?.changeLabels).not.toHaveProperty("label");
    expect(byType["courier"]).toMatchObject({
      entityLabel: "Carlos Pérez",
      changeLabels: { userId: [null, "John Coordinador"] },
    });
    expect(byType["carrier"]).toMatchObject({ entityLabel: "Coonorte", changeLabels: {} });
    expect(byType["user"]).toMatchObject({
      entityLabel: "John Coordinador",
      changeLabels: { courierId: ["Carlos Pérez", null] },
    });
    expect(byType["neighborhood"]).toMatchObject({
      entityLabel: "Itagüí",
      changeLabels: { municipalityId: ["Medellín", "Itagüí"] },
    });
  });

  it("names settings and rate card entries, which have no name of their own", async () => {
    await call(
      "PATCH",
      "/api/settings",
      { actionId: crypto.randomUUID(), companyName: "Cohex Medellín" },
      owner.cookie,
    );
    const [amyRate] = await database.db
      .select({ id: rateCardEntries.id })
      .from(rateCardEntries)
      .where(
        and(
          eq(rateCardEntries.merchantId, catalog.merchant.amy),
          eq(rateCardEntries.rateZoneId, catalog.zone.medellin),
        ),
      );
    const [expressRate] = await database.db
      .select({ id: rateCardEntries.id })
      .from(rateCardEntries)
      .where(
        and(eq(rateCardEntries.kind, "express_surcharge"), isNull(rateCardEntries.merchantId)),
      );
    if (!amyRate || !expressRate) throw new Error("The catalog has no rate card");
    for (const entityId of [amyRate.id, expressRate.id])
      await insert({
        entityType: "rate_card_entry",
        entityId,
        changes: { amount: [9000, 9700] },
      });
    const items = await events();
    expect(items.find((event) => event.entityType === "company_settings")).toMatchObject({
      entityLabel: "Cohex Medellín",
    });
    const labelOf = (id: string) => items.find((event) => event.entityId === id)?.entityLabel;
    // The kind, then the zone and the merchant whose rate it is, when it has them.
    expect(labelOf(amyRate.id)).toBe("Tarifa de zona · Medellín · Amy Tecnology");
    expect(labelOf(expressRate.id)).toBe("Recargo exprés");
  });

  it("keeps a deactivated record's name and never shows an unresolved identifier", async () => {
    await database.db
      .update(merchants)
      .set({ isActive: false })
      .where(eq(merchants.id, catalog.merchant.amy));
    const missing = crypto.randomUUID();
    await insert({
      entityType: "merchant",
      entityId: catalog.merchant.amy,
      changes: { isActive: [true, false] },
    });
    await insert({
      entityType: "pickup_point",
      entityId: missing,
      changes: { neighborhoodId: [missing, catalog.place.laureles] },
    });
    const items = await events();
    expect(items.find((event) => event.entityType === "merchant")).toMatchObject({
      entityLabel: "Amy Tecnology",
    });
    const unresolved = items.find((event) => event.entityType === "pickup_point");
    expect(unresolved).toMatchObject({
      entityLabel: "Registro eliminado",
      changes: { neighborhoodId: [missing, catalog.place.laureles] },
      changeLabels: { neighborhoodId: ["Registro eliminado", "Laureles"] },
    });
    expect(JSON.stringify([unresolved?.entityLabel, unresolved?.changeLabels])).not.toContain(
      missing,
    );
  });
});
