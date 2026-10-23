import type { CompanySettings } from "@domy/domain";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, companySettings } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: string;
let dispatcher: string;
let courier: string;

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  const ownerAccount = await t.signIn("owner");
  owner = ownerAccount.cookie;
  dispatcher = (await t.signIn("dispatcher")).cookie;
  courier = (await t.signIn("courier")).cookie;
  catalog = await createCatalog(database.db, ownerAccount.user.id);
});

const getSettings = (cookie: string) => send<CompanySettings>(t, cookie, "/api/settings");

const patchSettings = (
  cookie: string,
  values: Record<string, unknown>,
  actionId = crypto.randomUUID(),
) => send<CompanySettings>(t, cookie, "/api/settings", { actionId, ...values }, "PATCH");

describe("company support settings (FR-009, T008, R16)", () => {
  it("returns approved defaults to owner and dispatcher without creating a row", async () => {
    const expected = {
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: null,
      companyName: "Cohex",
    };

    for (const cookie of [owner, dispatcher]) {
      const response = await getSettings(cookie);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
    }
    expect((await getSettings(courier)).status).toBe(403);
    expect(await database.db.select().from(companySettings)).toEqual([]);
  });

  it("allows only the owner to patch support settings", async () => {
    expect((await patchSettings(owner, { supportPhone: "3001234567" })).status).toBe(200);
    expect((await patchSettings(dispatcher, { supportPhone: "3001234568" })).status).toBe(403);
    expect((await patchSettings(courier, { supportPhone: "3001234569" })).status).toBe(403);
    expect((await getSettings(dispatcher)).body).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: "3001234567",
      companyName: "Cohex",
    });
  });

  it("updates support fields independently and preserves the configured office pair", async () => {
    const office = await patchSettings(owner, {
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhoodId: catalog.place.estadio,
    });
    expect(office.status).toBe(200);

    const phone = await patchSettings(owner, { supportPhone: "3001234567" });
    expect(phone.status).toBe(200);
    expect(phone.body).toEqual({
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: "3001234567",
      companyName: "Cohex",
    });

    const name = await patchSettings(owner, { companyName: "  Cohex Medellín  " });
    expect(name.status).toBe(200);
    expect(name.body).toEqual({
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: "3001234567",
      companyName: "Cohex Medellín",
    });

    const cleared = await patchSettings(owner, { supportPhone: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual({
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: null,
      companyName: "Cohex Medellín",
    });
    expect(await database.db.select().from(auditEvents)).toHaveLength(4);
  });

  it("rejects invalid support values and one-sided office edits without persisting anything", async () => {
    for (const body of [
      { supportPhone: "300123456" },
      { companyName: "   " },
      { officeAddress: "Carrera 90 # 65C-10" },
      { officeNeighborhoodId: catalog.place.estadio },
    ]) {
      expect((await patchSettings(owner, body)).status).toBe(400);
    }
    expect(await database.db.select().from(companySettings)).toEqual([]);
    expect(await database.db.select().from(auditEvents)).toEqual([]);
  });

  it("keeps accepted no-op and concurrent replays from undoing a later contact edit", async () => {
    await database.db.insert(companySettings).values({ supportPhone: "3001234567" });
    const noOpActionId = crypto.randomUUID();
    const noOpRequests = await Promise.all([
      patchSettings(owner, { supportPhone: "3001234567" }, noOpActionId),
      patchSettings(owner, { supportPhone: "3001234567" }, noOpActionId),
    ]);
    expect(noOpRequests.map(({ status }) => status)).toEqual([200, 200]);
    const receipt = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.clientEventId, noOpActionId));
    expect(receipt).toHaveLength(1);
    expect(receipt[0]?.changes).toEqual({});

    const emptyPatchActionId = crypto.randomUUID();
    expect((await patchSettings(owner, {}, emptyPatchActionId)).status).toBe(200);
    const emptyPatchReceipt = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.clientEventId, emptyPatchActionId));
    expect(emptyPatchReceipt).toHaveLength(1);
    expect(emptyPatchReceipt[0]?.changes).toEqual({});

    await patchSettings(owner, { companyName: "Cohex Mensajería" });
    const beforeReplay = await database.db.select().from(companySettings);
    const replay = await patchSettings(owner, { supportPhone: "3001234567" }, noOpActionId);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: "3001234567",
      companyName: "Cohex Mensajería",
    });
    expect(await database.db.select().from(companySettings)).toEqual(beforeReplay);
    expect(await database.db.select().from(auditEvents)).toHaveLength(3);
  });
});
