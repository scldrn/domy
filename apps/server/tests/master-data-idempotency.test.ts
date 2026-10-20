import { bogotaToday } from "@domy/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, couriers, merchants, pickupPoints } from "../src/db/schema/index.ts";
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

async function withInsertBarrier(
  db: TestDatabase,
  table: string,
  fn: (release: () => Promise<void>) => Promise<void>,
) {
  const barrierId = "88888";
  const conn = await db.db.$client.reserve();
  await conn`SELECT pg_advisory_lock(${barrierId})`;
  await db.db.execute(
    sql.raw(`
    CREATE OR REPLACE FUNCTION test_insert_barrier() RETURNS TRIGGER AS $$
    BEGIN
      PERFORM pg_advisory_lock(${barrierId});
      PERFORM pg_advisory_unlock(${barrierId});
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS test_insert_trg ON "${table}";
    CREATE TRIGGER test_insert_trg
    BEFORE INSERT ON "${table}"
    FOR EACH ROW EXECUTE FUNCTION test_insert_barrier();
  `),
  );

  let released = false;
  const release = async () => {
    if (!released) {
      released = true;
      await conn`SELECT pg_advisory_unlock(${barrierId})`;
      conn.release();
    }
  };

  try {
    await fn(release);
  } finally {
    await release();
    await db.db.execute(
      sql.raw(`
      DROP TRIGGER IF EXISTS test_insert_trg ON "${table}";
      DROP FUNCTION IF EXISTS test_insert_barrier();
    `),
    );
  }
}

async function withUpdateBarrier(
  db: TestDatabase,
  table: string,
  fn: (release: () => Promise<void>) => Promise<void>,
) {
  const barrierId = "88889";
  const conn = await db.db.$client.reserve();
  await conn`SELECT pg_advisory_lock(${barrierId})`;
  await db.db.execute(
    sql.raw(`
    CREATE OR REPLACE FUNCTION test_update_barrier() RETURNS TRIGGER AS $$
    BEGIN
      PERFORM pg_advisory_lock(${barrierId});
      PERFORM pg_advisory_unlock(${barrierId});
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS test_update_trg ON "${table}";
    CREATE TRIGGER test_update_trg
    BEFORE UPDATE ON "${table}"
    FOR EACH ROW EXECUTE FUNCTION test_update_barrier();
  `),
  );

  let released = false;
  const release = async () => {
    if (!released) {
      released = true;
      await conn`SELECT pg_advisory_unlock(${barrierId})`;
      conn.release();
    }
  };

  try {
    await fn(release);
  } finally {
    await release();
    await db.db.execute(
      sql.raw(`
      DROP TRIGGER IF EXISTS test_update_trg ON "${table}";
      DROP FUNCTION IF EXISTS test_update_barrier();
    `),
    );
  }
}

describe("master data concurrent creation (IV-28 / 001/T134)", () => {
  it("returns 201 and 200 replay for same-ID concurrent merchant creation rather than 500", async () => {
    await withInsertBarrier(database, "merchants", async (release) => {
      const id = crypto.randomUUID();
      const body = { id, name: "Tienda Concurrente", aliases: ["TC"] };
      const req1 = send(t, owner.cookie, "/api/merchants", body);
      const req2 = send(t, owner.cookie, "/api/merchants", body);

      await new Promise((r) => setTimeout(r, 60));
      await release();

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 201]);

      const stored = await database.db.select().from(merchants).where(eq(merchants.id, id));
      expect(stored).toHaveLength(1);
      const audits = await database.db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, id));
      expect(audits).toHaveLength(1);
      expect(audits[0]?.action).toBe("created");
    });
  });

  it("returns 201 and 200 replay for same-ID concurrent courier creation rather than 500", async () => {
    await withInsertBarrier(database, "couriers", async (release) => {
      const id = crypto.randomUUID();
      const body = { id, name: "Mensajero Concurrente", phone: "3009998877", aliases: ["MC"] };
      const req1 = send(t, owner.cookie, "/api/couriers", body);
      const req2 = send(t, owner.cookie, "/api/couriers", body);

      await new Promise((r) => setTimeout(r, 60));
      await release();

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 201]);

      const stored = await database.db.select().from(couriers).where(eq(couriers.id, id));
      expect(stored).toHaveLength(1);
      const audits = await database.db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, id));
      expect(audits).toHaveLength(1);
    });
  });

  it("rejects a different-ID duplicate name with 400 rather than swallowing as a replay", async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const first = await send(t, owner.cookie, "/api/merchants", {
      id: id1,
      name: "Tienda Original",
      aliases: [],
    });
    expect(first.status).toBe(201);

    const second = await send(t, owner.cookie, "/api/merchants", {
      id: id2,
      name: "tienda original",
      aliases: [],
    });
    expect(second.status).toBe(400);
    expect(second.body).toMatchObject({ error: { fields: { name: expect.any(String) } } });
  });
});

describe("truthful serialized master data audit chains (IV-29 / 001/T135)", () => {
  it("serializes concurrent edits into a truthful A -> B -> C audit chain", async () => {
    const merchantId = catalog.merchant.bullish;
    const [initial] = await database.db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId));
    expect(initial?.name).toBe("Bullish Hype");

    await withUpdateBarrier(database, "merchants", async (release) => {
      const action1 = crypto.randomUUID();
      const action2 = crypto.randomUUID();

      const req1 = send(
        t,
        owner.cookie,
        `/api/merchants/${merchantId}`,
        { actionId: action1, name: "Bullish Alfa" },
        "PATCH",
      );
      const req2 = send(
        t,
        owner.cookie,
        `/api/merchants/${merchantId}`,
        { actionId: action2, name: "Bullish Beta" },
        "PATCH",
      );

      await new Promise((r) => setTimeout(r, 60));
      await release();

      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const events = await database.db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, merchantId))
        .orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id));

      const updateEvents = events.filter((e) => e.action === "updated");
      expect(updateEvents.length).toBeGreaterThanOrEqual(2);

      const [first, second] = updateEvents.slice(-2);
      const firstChanges = first?.changes as Record<string, [unknown, unknown]>;
      const secondChanges = second?.changes as Record<string, [unknown, unknown]>;

      expect(firstChanges["name"]?.[0]).toBe("Bullish Hype");
      const intermediateName = firstChanges["name"]?.[1];
      expect(secondChanges["name"]?.[0]).toBe(intermediateName);
      expect(["Bullish Alfa", "Bullish Beta"]).toContain(secondChanges["name"]?.[1]);
    });
  });

  it("handles concurrent pickup point default updates without unique index conflict", async () => {
    const merchantId = catalog.merchant.bullish;
    const pointId1 = catalog.pickup.bullish;
    const pointId2 = crypto.randomUUID();

    const createdPoint = await send(t, owner.cookie, `/api/merchants/${merchantId}/pickup-points`, {
      id: pointId2,
      label: "Bodega Estadio 2",
      address: "Cra 70 # 1-50",
      neighborhoodId: catalog.place.estadio,
      isDefault: false,
    });
    expect(createdPoint.status).toBe(201);

    const action1 = crypto.randomUUID();
    const action2 = crypto.randomUUID();

    const [res1, res2] = await Promise.all([
      send(
        t,
        owner.cookie,
        `/api/pickup-points/${pointId1}`,
        { actionId: action1, isDefault: true },
        "PATCH",
      ),
      send(
        t,
        owner.cookie,
        `/api/pickup-points/${pointId2}`,
        { actionId: action2, isDefault: true },
        "PATCH",
      ),
    ]);

    expect([200, 200]).toEqual([res1.status, res2.status]);
    const defaults = await database.db
      .select()
      .from(pickupPoints)
      .where(and(eq(pickupPoints.merchantId, merchantId), eq(pickupPoints.isDefault, true)));
    expect(defaults).toHaveLength(1);
  });
});

describe("accepted rate card entry replay across day rollover (IV-18 / 001/T142)", () => {
  it("replays accepted rate entry creation tomorrow without being refused by effectiveFrom guard", async () => {
    t.setNow("2026-10-20T10:00:00Z");
    const today = bogotaToday(t.now());
    const id = crypto.randomUUID();
    const body = {
      id,
      kind: "zone_rate" as const,
      rateZoneId: catalog.zone.medellin,
      amount: 14000,
      effectiveFrom: today,
    };

    const first = await send(t, owner.cookie, "/api/rate-card/entries", body);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ amount: 14000, effectiveFrom: today });

    // Advance clock by one day (day rollover)
    t.setNow("2026-10-21T10:00:00Z");
    const replay = await send(t, owner.cookie, "/api/rate-card/entries", body);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ amount: 14000, effectiveFrom: today });

    const audits = await database.db.select().from(auditEvents).where(eq(auditEvents.entityId, id));
    expect(audits).toHaveLength(1);
  });

  it("replays accepted rate entry creation when rate zone is later deactivated", async () => {
    t.setNow("2026-10-20T10:00:00Z");
    const today = bogotaToday(t.now());
    const id = crypto.randomUUID();
    const body = {
      id,
      kind: "zone_rate" as const,
      rateZoneId: catalog.zone.medellin,
      amount: 15000,
      effectiveFrom: today,
    };

    const first = await send(t, owner.cookie, "/api/rate-card/entries", body);
    expect(first.status).toBe(201);

    // Deactivate the rate zone
    await send(
      t,
      owner.cookie,
      `/api/rate-zones/${catalog.zone.medellin}`,
      { actionId: crypto.randomUUID(), isActive: false },
      "PATCH",
    );

    // Replay accepted entry
    const replay = await send(t, owner.cookie, "/api/rate-card/entries", body);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ amount: 15000 });

    // A genuinely new entry with this deactivated zone must be refused
    const newEntry = await send(t, owner.cookie, "/api/rate-card/entries", {
      id: crypto.randomUUID(),
      kind: "zone_rate",
      rateZoneId: catalog.zone.medellin,
      amount: 16000,
      effectiveFrom: today,
    });
    expect(newEntry.status).toBe(400);
    expect(newEntry.body).toMatchObject({ error: { fields: { rateZoneId: expect.any(String) } } });
  });

  it("refuses a genuinely new rate entry starting in the past", async () => {
    t.setNow("2026-10-25T10:00:00Z");
    const newEntry = await send(t, owner.cookie, "/api/rate-card/entries", {
      id: crypto.randomUUID(),
      kind: "zone_rate",
      rateZoneId: catalog.zone.medellin,
      amount: 16000,
      effectiveFrom: "2026-10-20",
    });
    expect(newEntry.status).toBe(400);
    expect(newEntry.body).toMatchObject({
      error: { fields: { effectiveFrom: expect.any(String) } },
    });
  });
});

describe("concurrent name and alias uniqueness (IV-30 / 001/T148)", () => {
  it("prevents merchant name clashing with another merchant's alias under concurrent creation", async () => {
    await withInsertBarrier(database, "merchants", async (release) => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const shared = "Comercio Estrella";

      // M1 sets name to shared
      const req1 = send(t, owner.cookie, "/api/merchants", {
        id: id1,
        name: shared,
        aliases: ["Otro Alias"],
      });
      // M2 sets alias to shared
      const req2 = send(t, owner.cookie, "/api/merchants", {
        id: id2,
        name: "Comercio Diferente",
        aliases: [shared],
      });

      await new Promise((r) => setTimeout(r, 60));
      await release();

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();
      // One succeeds (201), the other is rejected (409 duplicate_alias)
      expect(statuses).toEqual([201, 409]);

      const failed = res1.status === 409 ? res1 : res2;
      expect(failed.body).toMatchObject({ error: { code: "duplicate_alias" } });
    });
  });

  it("prevents courier name clashing with another courier's alias under concurrent creation", async () => {
    await withInsertBarrier(database, "couriers", async (release) => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const shared = "Rayo Veloz";

      // C1 sets name to shared
      const req1 = send(t, owner.cookie, "/api/couriers", {
        id: id1,
        name: shared,
        phone: "3001119900",
        aliases: [],
      });
      // C2 sets alias to shared
      const req2 = send(t, owner.cookie, "/api/couriers", {
        id: id2,
        name: "Otro Conductor",
        phone: "3001119911",
        aliases: [shared],
      });

      await new Promise((r) => setTimeout(r, 60));
      await release();

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const failed = res1.status === 409 ? res1 : res2;
      expect(failed.body).toMatchObject({ error: { code: "duplicate_alias" } });
    });
  });

  it("keeps merchant and courier namespaces independent", async () => {
    const shared = "Mismo Nombre";
    const mRes = await send(t, owner.cookie, "/api/merchants", {
      id: crypto.randomUUID(),
      name: shared,
      aliases: [],
    });
    expect(mRes.status).toBe(201);

    const cRes = await send(t, owner.cookie, "/api/couriers", {
      id: crypto.randomUUID(),
      name: shared,
      phone: "3007778899",
      aliases: [shared],
    });
    // Couriers directory allows this name and alias because merchant directory is separate
    expect(cRes.status).toBe(201);
  });
});
