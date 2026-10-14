import { readFile } from "node:fs/promises";
import { bogotaLocalTimeToInstant, normalizeText, type NeighborhoodKind } from "@domy/domain";
import { and, eq, isNull } from "drizzle-orm";
import { createAuth, type Auth } from "../../auth.ts";
import { createDb, type Db } from "../client.ts";
import {
  carriers,
  companySettings,
  merchants,
  municipalities,
  neighborhoods,
  neighborhoodVariants,
  rateCardEntries,
  rateZones,
  users,
} from "../schema/index.ts";

/**
 * Go-live data (idempotent: running it again adds only what is missing). Standard rates come
 * from the business master §6; the catalog from neighborhoods.csv.
 */

const standardRates: Record<string, number | null> = {
  Medellín: 13000,
  "Bello–Itagüí": 15000,
  "Envigado–Sabaneta–La Estrella": 16000,
  Copacabana: 20000,
  "San Antonio de Prado": 19000,
  "Terminales y aeropuerto": 15000,
  // No confirmed rate: shipments get a manual fee and are flagged for the owner's review.
  Caldas: null,
  Girardota: null,
};
const standardExpressSurcharge = 4500;

// Inferred from the ledger; confirm with the owner before production.
const amyTecnologyRates: Record<string, number> = {
  Medellín: 9700,
  "Bello–Itagüí": 10700,
  "Envigado–Sabaneta–La Estrella": 10700,
  Copacabana: 10700,
  "Terminales y aeropuerto": 15000,
};

const carrierNames = [
  "Interrapidísimo",
  "Envientrega",
  "Coordinadora",
  "Servientrega",
  "Maxienvíos",
  "Envía",
  "Coonorte",
  "Rápido Ochoa",
  "Gómez Hernández",
  "Copetran",
  "Expreso Brasilia",
];

const effectiveFrom = bogotaLocalTimeToInstant("2026-01-01", "00:00");

type CatalogRow = {
  name: string;
  municipality: string;
  rateZone: string;
  kind: NeighborhoodKind;
  variants: string[];
};

async function readCatalog(): Promise<CatalogRow[]> {
  const text = await readFile(new URL("neighborhoods.csv", import.meta.url), "utf8");
  const [, ...lines] = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const [name = "", municipality = "", rateZone = "", kind = "", variants = ""] = line.split(",");
    return {
      name,
      municipality,
      rateZone,
      kind: kind as NeighborhoodKind,
      variants: variants ? variants.split("|") : [],
    };
  });
}

async function ensureOwner(db: Db, auth: Auth, log: (line: string) => void): Promise<string> {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "owner"));
  if (owner) {
    return owner.id;
  }
  const email = "propietario@example.com";
  const password = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const { user } = await auth.api.createUser({
    body: { email, password, name: "Propietario", role: "owner" },
  });
  log(`Owner account created. Email: ${email} · Password (shown once): ${password}`);
  return user.id;
}

export async function seed(db: Db, auth: Auth, log: (line: string) => void): Promise<void> {
  const ownerId = await ensureOwner(db, auth, log);
  const catalog = await readCatalog();

  const municipalityIds = new Map<string, string>();
  for (const name of new Set(catalog.map((row) => row.municipality))) {
    await db.insert(municipalities).values({ id: crypto.randomUUID(), name }).onConflictDoNothing();
    const [row] = await db.select().from(municipalities).where(eq(municipalities.name, name));
    if (row) municipalityIds.set(name, row.id);
  }

  const zoneIds = new Map<string, string>();
  for (const name of Object.keys(standardRates)) {
    await db.insert(rateZones).values({ id: crypto.randomUUID(), name }).onConflictDoNothing();
    const [row] = await db.select().from(rateZones).where(eq(rateZones.name, name));
    if (row) zoneIds.set(name, row.id);
  }

  for (const row of catalog) {
    const municipalityId = municipalityIds.get(row.municipality);
    const rateZoneId = zoneIds.get(row.rateZone);
    if (!municipalityId || !rateZoneId) {
      throw new Error(`Unknown municipality or rate zone in neighborhoods.csv: ${row.name}`);
    }
    const nameNormalized = normalizeText(row.name);
    await db
      .insert(neighborhoods)
      .values({
        id: crypto.randomUUID(),
        name: row.name,
        nameNormalized,
        municipalityId,
        rateZoneId,
        kind: row.kind,
      })
      .onConflictDoNothing();
    const [neighborhood] = await db
      .select({ id: neighborhoods.id })
      .from(neighborhoods)
      .where(
        and(
          eq(neighborhoods.nameNormalized, nameNormalized),
          eq(neighborhoods.municipalityId, municipalityId),
        ),
      );
    for (const variant of row.variants) {
      await db
        .insert(neighborhoodVariants)
        .values({
          id: crypto.randomUUID(),
          neighborhoodId: neighborhood?.id ?? "",
          variantNormalized: variant,
        })
        .onConflictDoNothing();
    }
  }

  for (const name of carrierNames) {
    await db
      .insert(carriers)
      .values({ id: crypto.randomUUID(), name, nameNormalized: normalizeText(name) })
      .onConflictDoNothing();
  }

  const addRate = async (
    kind: "zone_rate" | "express_surcharge",
    merchantId: string | null,
    zone: string | null,
    amount: number,
  ) => {
    const rateZoneId = zone ? (zoneIds.get(zone) ?? null) : null;
    const existing = await db
      .select({ id: rateCardEntries.id })
      .from(rateCardEntries)
      .where(
        and(
          eq(rateCardEntries.kind, kind),
          merchantId
            ? eq(rateCardEntries.merchantId, merchantId)
            : isNull(rateCardEntries.merchantId),
          rateZoneId
            ? eq(rateCardEntries.rateZoneId, rateZoneId)
            : isNull(rateCardEntries.rateZoneId),
        ),
      );
    if (existing.length === 0) {
      await db.insert(rateCardEntries).values({
        id: crypto.randomUUID(),
        kind,
        merchantId,
        rateZoneId,
        amount,
        effectiveFrom,
        createdBy: ownerId,
      });
    }
  };

  for (const [zone, amount] of Object.entries(standardRates)) {
    if (amount !== null) await addRate("zone_rate", null, zone, amount);
  }
  await addRate("express_surcharge", null, null, standardExpressSurcharge);

  const amyName = "Amy Tecnology";
  await db
    .insert(merchants)
    .values({ id: crypto.randomUUID(), name: amyName, nameNormalized: normalizeText(amyName) })
    .onConflictDoNothing();
  const [amy] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.nameNormalized, normalizeText(amyName)));
  if (amy) {
    for (const [zone, amount] of Object.entries(amyTecnologyRates)) {
      await addRate("zone_rate", amy.id, zone, amount);
    }
    log(
      "Amy Tecnology rates are inferred from the ledger; confirm with the owner before production.",
    );
  }
  log("Caldas and Girardota have no confirmed rate: their shipments need a manual fee.");

  // Feature 003, FR-041: the office, the only place besides couriers that holds packages,
  // as the owner gave it on 2026-10-14. Never overwrites an address already set.
  const [office] = await db
    .select({ id: neighborhoods.id })
    .from(neighborhoods)
    .where(eq(neighborhoods.nameNormalized, normalizeText("Robledo")));
  if (office) {
    await db
      .insert(companySettings)
      .values({
        officeAddress: "Carrera 90 # 65C-10, Urbanización Mirador de Barcelona",
        officeNeighborhoodId: office.id,
      })
      .onConflictDoNothing();
  }
}

if (import.meta.main) {
  const url = process.env["DATABASE_URL"];
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!url || !secret) {
    console.error("DATABASE_URL and BETTER_AUTH_SECRET are required");
    process.exit(1);
  }
  const db = createDb(url);
  const auth = createAuth({
    db,
    secret,
    baseUrl: process.env["APP_URL"] ?? "http://localhost:5173",
    sendResetPassword: () => Promise.resolve(),
  });
  await seed(db, auth, (line) => {
    console.log(line);
  });
  await db.$client.end();
  console.log("Seed complete");
}
