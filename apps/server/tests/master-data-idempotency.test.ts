import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, couriers } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let courierId: string;

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  courierId = crypto.randomUUID();
  await database.db.insert(couriers).values({
    id: courierId,
    name: "Carlos Pérez",
    phone: "3004445566",
  });
});

const resources = [
  "merchant",
  "courier",
  "carrier",
  "neighborhood",
  "pickup_point",
  "rate_zone",
] as const;

function target(resource: (typeof resources)[number]) {
  return {
    merchant: {
      id: catalog.merchant.bullish,
      path: "merchants",
      field: "name",
      value: "Bullish Hype",
    },
    courier: { id: courierId, path: "couriers", field: "name", value: "Carlos Pérez" },
    carrier: { id: catalog.carrier, path: "carriers", field: "name", value: "Coonorte" },
    neighborhood: {
      id: catalog.place.laureles,
      path: "neighborhoods",
      field: "name",
      value: "Laureles",
    },
    pickup_point: {
      id: catalog.pickup.bullish,
      path: "pickup-points",
      field: "label",
      value: "Bodega Estadio",
    },
    rate_zone: { id: catalog.zone.medellin, path: "rate-zones", field: "name", value: "Medellín" },
  }[resource];
}

const receipts = (actionId: string) =>
  database.db.select().from(auditEvents).where(eq(auditEvents.clientEventId, actionId));

/** Accepted no-op edits have exactly one effect too (feature 001 FR-042; 003 T097). */
describe("master data action receipts", () => {
  it.each(resources)(
    "keeps a later %s edit when an unchanged edit is replayed",
    async (resource) => {
      const { id, path, field, value } = target(resource);
      const endpoint = `/api/${path}/${id}`;
      const actionId = crypto.randomUUID();
      const unchanged = { actionId, [field]: value };
      expect((await send(t, owner.cookie, endpoint, unchanged, "PATCH")).status).toBe(200);
      const updated = `${value} actualizado`;
      expect(
        (
          await send(
            t,
            owner.cookie,
            endpoint,
            { actionId: crypto.randomUUID(), [field]: updated },
            "PATCH",
          )
        ).status,
      ).toBe(200);

      const replay = await send(t, owner.cookie, endpoint, unchanged, "PATCH");

      expect(replay.status).toBe(200);
      expect(replay.body[field]).toBe(updated);
      expect(await receipts(actionId)).toEqual([
        expect.objectContaining({
          entityType: resource,
          entityId: id,
          actorUserId: owner.user.id,
          action: "updated",
          changes: {},
        }),
      ]);
    },
  );

  it("keeps a courier reactivated after an unchanged deactivation", async () => {
    const endpoint = `/api/couriers/${courierId}`;
    const patch = (isActive: boolean, actionId = crypto.randomUUID()) =>
      send(t, owner.cookie, endpoint, { actionId, isActive }, "PATCH");
    await patch(false);
    const actionId = crypto.randomUUID();
    expect((await patch(false, actionId)).status).toBe(200);
    await patch(true);

    const replay = await patch(false, actionId);

    expect(replay.status).toBe(200);
    expect(replay.body["isActive"]).toBe(true);
    const [row] = await database.db.select().from(couriers).where(eq(couriers.id, courierId));
    expect(row?.isActive).toBe(true);
    expect(await receipts(actionId)).toHaveLength(1);
  });

  it("remembers simultaneous unchanged edits once without touching the courier", async () => {
    const [before] = await database.db.select().from(couriers).where(eq(couriers.id, courierId));
    t.setNow("2026-10-01T15:05:00Z");
    const actionId = crypto.randomUUID();
    const patch = () =>
      send(t, owner.cookie, `/api/couriers/${courierId}`, { actionId, isActive: true }, "PATCH");

    const results = await Promise.all([patch(), patch()]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const [after] = await database.db.select().from(couriers).where(eq(couriers.id, courierId));
    expect(after).toEqual(before);
    expect(await receipts(actionId)).toEqual([
      expect.objectContaining({ changes: {}, occurredAt: t.now() }),
    ]);
  });

  it("keeps invalid edits without a success receipt", async () => {
    const id = crypto.randomUUID();
    await send(t, owner.cookie, "/api/carriers", { id, name: "Transportes Sur" });
    const actionId = crypto.randomUUID();

    const refused = await send(
      t,
      owner.cookie,
      `/api/carriers/${id}`,
      { actionId, name: "Coonorte" },
      "PATCH",
    );

    expect(refused.status).toBe(400);
    expect(await receipts(actionId)).toEqual([]);
    const unchanged = await send<{ items: { id: string; name: string }[] }>(
      t,
      owner.cookie,
      "/api/carriers",
    );
    expect(unchanged.body.items.find((row) => row.id === id)?.name).toBe("Transportes Sur");
  });
});
