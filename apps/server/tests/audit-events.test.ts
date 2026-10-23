import type { AuditEvent } from "@domy/domain";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents } from "../src/db/schema/index.ts";
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
