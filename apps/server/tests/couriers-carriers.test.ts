import type { Carrier, Courier } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { couriers } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
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
  await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function call(method: string, path: string, body?: unknown) {
  const response = await t.request(path, { method, cookie: dispatcher.cookie, body });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("couriers", () => {
  it("creates, edits, and deactivates couriers once per identifier (FR-026, FR-042)", async () => {
    const id = crypto.randomUUID();
    const body = { id, name: "Carlos Pérez", phone: "3004445566", aliases: ["Carlitos"] };
    expect((await call("POST", "/api/couriers", body)).status).toBe(201);
    expect((await call("POST", "/api/couriers", body)).status).toBe(200);
    expect(await database.db.select().from(couriers).where(eq(couriers.id, id))).toHaveLength(1);

    const edited = await call("PATCH", `/api/couriers/${id}`, {
      actionId: crypto.randomUUID(),
      phone: "3007778899",
      isActive: false,
    });
    expect(edited.body).toMatchObject({ phone: "3007778899", isActive: false });
    expect((await call("GET", "/api/couriers?active=true")).body["items"]).toEqual([]);
    const found = (await call("GET", "/api/couriers?q=carlitos")).body["items"] as Courier[];
    expect(found.map((courier) => courier.name)).toEqual(["Carlos Pérez"]);
  });

  it("keeps courier aliases apart from merchants but unique among couriers (FR-027)", async () => {
    // "Amy Tech" is a merchant alias: a courier may use it.
    const first = await call("POST", "/api/couriers", {
      id: crypto.randomUUID(),
      name: "Juan Mesa",
      phone: "3001112233",
      aliases: ["Amy Tech"],
    });
    expect(first.status).toBe(201);
    const second = await call("POST", "/api/couriers", {
      id: crypto.randomUUID(),
      name: "Pedro Ruiz",
      phone: "3001112244",
      aliases: ["amy tech"],
    });
    expect(second.status).toBe(409);
    const sameName = await call("POST", "/api/couriers", {
      id: crypto.randomUUID(),
      name: "Otro",
      phone: "3001112255",
      aliases: ["Juan Mesa"],
    });
    expect(sameName.status).toBe(409);
  });
});

describe("carriers", () => {
  it("creates, renames, and deactivates carriers", async () => {
    const id = crypto.randomUUID();
    const created = await call("POST", "/api/carriers", { id, name: "Transportes Sur" });
    expect(created.status).toBe(201);
    expect((await call("POST", "/api/carriers", { id, name: "Transportes Sur" })).status).toBe(200);
    const duplicate = await call("POST", "/api/carriers", {
      id: crypto.randomUUID(),
      name: "transportes  sur",
    });
    expect(duplicate.status).toBe(400);
    const edited = await call("PATCH", `/api/carriers/${id}`, {
      actionId: crypto.randomUUID(),
      name: "Transportes del Sur",
      isActive: false,
    });
    expect(edited.body).toMatchObject({ name: "Transportes del Sur", isActive: false });
    const active = (await call("GET", "/api/carriers?active=true")).body["items"] as Carrier[];
    expect(active.map((carrier) => carrier.name)).not.toContain("Transportes del Sur");
  });
});
