import type { Merchant, MerchantDetail, PickupPoint } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, merchants } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
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
  const owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function call(method: string, path: string, body?: unknown) {
  const response = await t.request(path, { method, cookie: dispatcher.cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
const action = () => crypto.randomUUID();

async function createMerchant(body: Record<string, unknown>): Promise<Merchant> {
  const result = await call("POST", "/api/merchants", { id: crypto.randomUUID(), ...body });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body as unknown as Merchant;
}

async function addPoint(merchantId: string, body: Record<string, unknown> = {}) {
  const result = await call("POST", `/api/merchants/${merchantId}/pickup-points`, {
    id: crypto.randomUUID(),
    label: "Bodega",
    address: "Cl 1 # 2-3",
    neighborhoodId: catalog.place.laureles,
    ...body,
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body as unknown as PickupPoint;
}

const detail = async (id: string) =>
  (await call("GET", `/api/merchants/${id}`)).body as unknown as MerchantDetail;

describe("merchants", () => {
  it("creates a merchant with aliases once per identifier (FR-026, FR-042)", async () => {
    const id = crypto.randomUUID();
    const body = { id, name: "Tienda Luna", whatsappPhone: "3001112233", aliases: ["Luna"] };
    const first = await call("POST", "/api/merchants", body);
    const again = await call("POST", "/api/merchants", body);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(first.body).toMatchObject({ name: "Tienda Luna", aliases: ["Luna"], isActive: true });
    expect(await database.db.select().from(merchants).where(eq(merchants.id, id))).toHaveLength(1);
    const audit = await database.db.select().from(auditEvents).where(eq(auditEvents.entityId, id));
    expect(audit).toMatchObject([{ entityType: "merchant", action: "created" }]);
  });

  it("keeps every alias for exactly one merchant (scenario 3, FR-027)", async () => {
    // "Amy Tech" is Amy Tecnology's alias; "Bullish Hype" is a merchant's name.
    for (const aliases of [["amy tech"], ["Bullish Hype"]]) {
      const result = await call("POST", "/api/merchants", {
        id: crypto.randomUUID(),
        name: "Otra tienda",
        aliases,
      });
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ error: { code: "duplicate_alias" } });
    }
    // A name may not equal another merchant's alias either.
    const named = await call("POST", "/api/merchants", {
      id: crypto.randomUUID(),
      name: "Amy Tech",
    });
    expect(named.status).toBe(409);
    const duplicateName = await call("POST", "/api/merchants", {
      id: crypto.randomUUID(),
      name: "bullish  hype",
    });
    expect(duplicateName.status).toBe(400);
    expect(duplicateName.body).toMatchObject({ error: { fields: { name: expect.any(String) } } });
  });

  it("edits name, contact, and aliases with an audit of old and new values", async () => {
    const merchant = await createMerchant({ name: "Tienda Luna", aliases: ["Luna"] });
    const actionId = action();
    const result = await call("PATCH", `/api/merchants/${merchant.id}`, {
      actionId,
      name: "Tienda Luna Llena",
      aliases: ["Luna", "Luna Llena"],
    });
    expect(result.body).toMatchObject({
      name: "Tienda Luna Llena",
      aliases: ["Luna", "Luna Llena"],
    });
    // Repeating the action changes nothing more.
    await call("PATCH", `/api/merchants/${merchant.id}`, { actionId, name: "Otro nombre" });
    expect((await detail(merchant.id)).name).toBe("Tienda Luna Llena");
    const [event] = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.clientEventId, actionId));
    expect(event?.changes).toEqual({
      name: ["Tienda Luna", "Tienda Luna Llena"],
      aliases: [["Luna"], ["Luna", "Luna Llena"]],
    });
  });

  it("warns about open shipments on deactivation and hides it from lookups (scenario 7, 2)", async () => {
    for (let i = 0; i < 3; i++) {
      const created = await call("POST", "/api/shipments", {
        id: crypto.randomUUID(),
        kind: "delivery",
        merchantId: catalog.merchant.bullish,
        pickupPointId: catalog.pickup.bullish,
        recipientName: "Laura Gómez",
        recipientPhone: "3001234567",
        recipientAddress: "Calle 10 # 43-12",
        recipientNeighborhoodId: catalog.place.laureles,
        paymentMode: "merchant_account",
        fee: 13000,
      });
      expect(created.status).toBe(201);
    }
    expect((await detail(catalog.merchant.bullish)).openShipments).toBe(3);
    const result = await call("PATCH", `/api/merchants/${catalog.merchant.bullish}`, {
      actionId: action(),
      isActive: false,
    });
    expect(result.body).toMatchObject({ isActive: false, openShipments: 3 });

    const active = (await call("GET", "/api/merchants?q=bullish&active=true")).body;
    expect(active["items"]).toEqual([]);
    const all = (await call("GET", "/api/merchants?q=bullish")).body;
    expect(all["items"]).toHaveLength(1);
    // New shipments cannot use it; its shipments stay in history.
    const refused = await call("POST", "/api/shipments", {
      id: crypto.randomUUID(),
      kind: "errand",
      merchantId: catalog.merchant.bullish,
      pickupPointId: catalog.pickup.bullish,
      errandDescription: "Pagar un recibo",
      paymentMode: "merchant_account",
      fee: 12000,
      feeOverrideReason: "Diligencia en el centro",
    });
    expect(refused.status).toBe(400);
    const history = (await call("GET", "/api/shipments/search?q=bullish")).body;
    expect(history["items"]).toHaveLength(3);
  });
});

describe("pickup points (FR-029)", () => {
  it("makes the first point the default and keeps exactly one default", async () => {
    const merchant = await createMerchant({ name: "Tienda Luna" });
    const first = await addPoint(merchant.id, { label: "Bodega Norte" });
    expect(first.isDefault).toBe(true);
    const second = await addPoint(merchant.id, { label: "Local Sur", isDefault: true });
    let points = (await detail(merchant.id)).pickupPoints;
    expect(points.filter((point) => point.isDefault).map((point) => point.id)).toEqual([second.id]);

    await call("PATCH", `/api/pickup-points/${first.id}`, { actionId: action(), isDefault: true });
    points = (await detail(merchant.id)).pickupPoints;
    expect(points.filter((point) => point.isDefault).map((point) => point.id)).toEqual([first.id]);

    // Deactivating the default passes it to the other active point.
    await call("PATCH", `/api/pickup-points/${first.id}`, { actionId: action(), isActive: false });
    points = (await detail(merchant.id)).pickupPoints;
    expect(points.find((point) => point.id === second.id)?.isDefault).toBe(true);
    expect(points.find((point) => point.id === first.id)).toMatchObject({
      isActive: false,
      isDefault: false,
    });
    const listed = (await call("GET", `/api/merchants/${merchant.id}/pickup-points`)).body;
    expect(listed["items"]).toHaveLength(1);
  });

  it("edits a point with its audit", async () => {
    const merchant = await createMerchant({ name: "Tienda Luna" });
    const point = await addPoint(merchant.id);
    const result = await call("PATCH", `/api/pickup-points/${point.id}`, {
      actionId: action(),
      address: "Cl 9 # 9-9",
      neighborhoodId: catalog.place.estadio,
    });
    expect(result.body).toMatchObject({
      address: "Cl 9 # 9-9",
      neighborhood: { id: catalog.place.estadio, name: "El Estadio" },
    });
    const audit = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, point.id))
      .orderBy(auditEvents.id);
    expect(audit.map((event) => event.action)).toEqual(["created", "updated"]);
  });
});
