import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, neighborhoods } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string };
let dispatcher: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  const ownerSession = await t.signIn("owner");
  owner = ownerSession;
  catalog = await createCatalog(database.db, ownerSession.user.id);
  dispatcher = await t.signIn("dispatcher");
});

const get = async <T>(path: string, cookie: string) =>
  (await (await t.request(path, { cookie })).json()) as T;

describe("merchants", () => {
  it("finds merchants by name and by alias", async () => {
    const byName = await get<{ items: { name: string }[] }>(
      "/api/merchants?q=bullish",
      dispatcher.cookie,
    );
    expect(byName.items.map((item) => item.name)).toEqual(["Bullish Hype"]);
    const byAlias = await get<{ items: { name: string }[] }>(
      "/api/merchants?q=amy%20tech",
      dispatcher.cookie,
    );
    expect(byAlias.items.map((item) => item.name)).toEqual(["Amy Tecnology"]);
  });

  it("lists pickup points with the default first", async () => {
    const points = await get<{ items: { label: string; isDefault: boolean }[] }>(
      `/api/merchants/${catalog.merchant.bullish}/pickup-points`,
      dispatcher.cookie,
    );
    expect(points.items.map((point) => [point.label, point.isDefault])).toEqual([
      ["Bodega Estadio", true],
      ["Local Laureles", false],
    ]);
  });

  it("suggests recipients from the same merchant only (FR-004)", async () => {
    const register = (
      merchantId: string,
      pickupPointId: string,
      recipientName: string,
      recipientPhone: string,
    ) =>
      t.request("/api/shipments", {
        method: "POST",
        cookie: dispatcher.cookie,
        body: {
          id: crypto.randomUUID(),
          kind: "delivery",
          merchantId,
          pickupPointId,
          recipientName,
          recipientPhone,
          recipientAddress: "Calle 1",
          recipientNeighborhoodId: catalog.place.laureles,
          paymentMode: "merchant_account",
          fee: merchantId === catalog.merchant.amy ? 9700 : 13000,
        },
      });
    await register(catalog.merchant.bullish, catalog.pickup.bullish, "Laura Gómez", "3001234567");
    await register(catalog.merchant.amy, catalog.pickup.amy, "Laura Pérez", "3007654321");

    const byName = await get<{ items: { recipientName: string }[] }>(
      `/api/merchants/${catalog.merchant.bullish}/recipients?q=laura`,
      dispatcher.cookie,
    );
    expect(byName.items.map((item) => item.recipientName)).toEqual(["Laura Gómez"]);
    const byPhone = await get<{ items: { recipientPhone: string }[] }>(
      `/api/merchants/${catalog.merchant.bullish}/recipients?q=300123`,
      dispatcher.cookie,
    );
    expect(byPhone.items.map((item) => item.recipientPhone)).toEqual(["3001234567"]);
  });
});

describe("neighborhoods", () => {
  it("finds neighborhoods tolerating accents, case, and spelling variants (FR-005)", async () => {
    const accented = await get<{ items: { name: string }[] }>(
      "/api/neighborhoods?q=cop%C3%A0cabana",
      dispatcher.cookie,
    );
    expect(accented.items[0]?.name).toBe("Copacabana");
    const variant = await get<{ items: { name: string; rateZone: { name: string } }[] }>(
      "/api/neighborhoods?q=terminal%20norte",
      dispatcher.cookie,
    );
    expect(variant.items[0]).toMatchObject({
      name: "Terminal del Norte",
      rateZone: { name: "Terminales y aeropuerto" },
    });
    const typo = await get<{ items: { name: string }[] }>(
      "/api/neighborhoods?q=lauereles",
      dispatcher.cookie,
    );
    expect(typo.items[0]?.name).toBe("Laureles");
  });

  it("adds a neighborhood for the owner's review when a dispatcher adds it, exactly once (FR-036, FR-042)", async () => {
    const body = {
      id: crypto.randomUUID(),
      name: "Belén Rincón",
      municipalityId: catalog.municipality.medellin,
      rateZoneId: catalog.zone.medellin,
      kind: "neighborhood",
    };
    const first = await t.request("/api/neighborhoods", {
      method: "POST",
      cookie: dispatcher.cookie,
      body,
    });
    const second = await t.request("/api/neighborhoods", {
      method: "POST",
      cookie: dispatcher.cookie,
      body,
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const rows = await database.db
      .select()
      .from(neighborhoods)
      .where(eq(neighborhoods.id, body.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.needsReview).toBe(true);
    const audit = await database.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.entityType, "neighborhood"), eq(auditEvents.entityId, body.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("created");
  });

  it("does not flag a neighborhood added by the owner", async () => {
    const body = {
      id: crypto.randomUUID(),
      name: "Calasanz Parte Alta",
      municipalityId: catalog.municipality.medellin,
      rateZoneId: catalog.zone.medellin,
      kind: "neighborhood",
    };
    await t.request("/api/neighborhoods", { method: "POST", cookie: owner.cookie, body });
    const [row] = await database.db
      .select()
      .from(neighborhoods)
      .where(eq(neighborhoods.id, body.id));
    expect(row?.needsReview).toBe(false);
  });
});

describe("carriers and reference lists", () => {
  it("lists carriers, municipalities, and rate zones", async () => {
    const carriers = await get<{ items: { name: string }[] }>("/api/carriers", dispatcher.cookie);
    expect(carriers.items.map((item) => item.name)).toEqual(["Coonorte"]);
    const municipalities = await get<{ items: { name: string }[] }>(
      "/api/municipalities",
      dispatcher.cookie,
    );
    expect(municipalities.items.map((item) => item.name)).toContain("Itagüí");
    const zones = await get<{ items: { name: string }[] }>("/api/rate-zones", dispatcher.cookie);
    expect(zones.items).toHaveLength(4);
  });
});
