import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, { now: "2026-10-01T15:00:00Z" });
  owner = await t.signIn("owner", { name: "Santiago Marín" });
  await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
});

async function csv(dataset: string): Promise<string[][]> {
  const response = await t.request(`/api/export/${dataset}?format=csv`, { cookie: owner.cookie });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain(`${dataset}-2026-10-01.csv`);
  const text = new TextDecoder().decode(await response.arrayBuffer());
  return text
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
    .map((line) => line.split(","));
}

describe("GET /api/export/:dataset (FR-025)", () => {
  it("exports merchants with aliases and pickup points", async () => {
    const [header, ...rows] = await csv("merchants");
    expect(header).toEqual([
      "Cliente",
      "Alias",
      "WhatsApp",
      "Activo",
      "Punto de recogida",
      "Dirección",
      "Barrio",
      "Predeterminado",
      "Punto activo",
    ]);
    expect(rows).toContainEqual([
      "Amy Tecnology",
      "Amy Tech",
      "",
      "Sí",
      "Bodega Amy",
      "Cl 30 # 65-15",
      "Laureles",
      "Sí",
      "Sí",
    ]);
    // One row per pickup point: Bullish Hype has two.
    expect(rows.filter((row) => row[0] === "Bullish Hype")).toHaveLength(2);
  });

  it("exports couriers, carriers, neighborhoods, and the rate card with history", async () => {
    await t.request("/api/couriers", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        id: crypto.randomUUID(),
        name: "Carlos Pérez",
        phone: "3004445566",
        aliases: ["Carlitos", "CP"],
      },
    });
    expect(await csv("couriers")).toEqual([
      ["Mensajero", "Alias", "Teléfono", "Activo"],
      ["Carlos Pérez", "Carlitos; CP", "3004445566", "Sí"],
    ]);
    expect((await csv("carriers"))[0]).toEqual(["Transportadora", "Activa"]);

    const [placeHeader, ...places] = await csv("neighborhoods");
    expect(placeHeader).toEqual([
      "Barrio",
      "Tipo",
      "Municipio",
      "Zona",
      "Variantes",
      "Por revisar",
      "Activo",
    ]);
    expect(places).toContainEqual([
      "El Estadio",
      "Barrio",
      "Medellín",
      "Medellín",
      "estadio",
      "No",
      "Sí",
    ]);

    const [rateHeader, ...rates] = await csv("rate-card");
    expect(rateHeader).toEqual([
      "Tipo",
      "Cliente",
      "Zona",
      "Valor",
      "Vigente desde",
      "Registrado por",
      "Registrado el",
    ]);
    const amy = rates.find((row) => row[1] === "Amy Tecnology" && row[2] === "Medellín");
    expect(amy?.slice(0, 6)).toEqual([
      "Tarifa de zona",
      "Amy Tecnology",
      "Medellín",
      "9700",
      "01/01/2026",
      "Santiago Marín",
    ]);
    expect(amy?.[6]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it("is only for the owner", async () => {
    const response = await t.request("/api/export/merchants?format=csv", {
      cookie: dispatcher.cookie,
    });
    expect(response.status).toBe(403);
  });
});
