import type { AuditEvent } from "@domy/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

async function call(method: string, path: string, body?: unknown, cookie = dispatcher.cookie) {
  const response = await t.request(path, { method, cookie, body });
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

  it("is only for the owner", async () => {
    expect((await call("GET", "/api/audit-events")).status).toBe(403);
  });
});
