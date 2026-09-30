import { normalizeText } from "@domy/domain";
import type { Db } from "../../src/db/client.ts";
import {
  carriers,
  merchantAliases,
  merchants,
  municipalities,
  neighborhoods,
  neighborhoodVariants,
  pickupPoints,
  rateCardEntries,
  rateZones,
} from "../../src/db/schema/index.ts";

/**
 * A small catalog for integration tests: rate zones with the standard rates of the business
 * master, a few places, two merchants (one with its own rate card), and a carrier.
 */
export async function createCatalog(db: Db, ownerId: string) {
  const id = () => crypto.randomUUID();
  const effectiveFrom = new Date("2026-01-01T05:00:00Z");
  const zone = { medellin: id(), belloItagui: id(), terminals: id(), noRate: id() };
  await db.insert(rateZones).values([
    { id: zone.medellin, name: "Medellín" },
    { id: zone.belloItagui, name: "Bello–Itagüí" },
    { id: zone.terminals, name: "Terminales y aeropuerto" },
    { id: zone.noRate, name: "Girardota" },
  ]);
  const municipality = { medellin: id(), itagui: id(), copacabana: id(), girardota: id() };
  await db.insert(municipalities).values([
    { id: municipality.medellin, name: "Medellín" },
    { id: municipality.itagui, name: "Itagüí" },
    { id: municipality.copacabana, name: "Copacabana" },
    { id: municipality.girardota, name: "Girardota" },
  ]);
  const place = {
    laureles: id(),
    estadio: id(),
    itagui: id(),
    copacabana: id(),
    terminalNorte: id(),
    girardota: id(),
  };
  const neighborhood = (
    placeId: string,
    name: string,
    municipalityId: string,
    rateZoneId: string,
    kind: "neighborhood" | "municipality" | "terminal" = "neighborhood",
  ) => ({
    id: placeId,
    name,
    nameNormalized: normalizeText(name),
    municipalityId,
    rateZoneId,
    kind,
  });
  await db
    .insert(neighborhoods)
    .values([
      neighborhood(place.laureles, "Laureles", municipality.medellin, zone.medellin),
      neighborhood(place.estadio, "El Estadio", municipality.medellin, zone.medellin),
      neighborhood(place.itagui, "Itagüí", municipality.itagui, zone.belloItagui, "municipality"),
      neighborhood(
        place.copacabana,
        "Copacabana",
        municipality.copacabana,
        zone.belloItagui,
        "municipality",
      ),
      neighborhood(
        place.terminalNorte,
        "Terminal del Norte",
        municipality.medellin,
        zone.terminals,
        "terminal",
      ),
      neighborhood(
        place.girardota,
        "Girardota",
        municipality.girardota,
        zone.noRate,
        "municipality",
      ),
    ]);
  await db.insert(neighborhoodVariants).values([
    { id: id(), neighborhoodId: place.estadio, variantNormalized: "estadio" },
    { id: id(), neighborhoodId: place.terminalNorte, variantNormalized: "terminal norte" },
  ]);

  const merchant = { bullish: id(), amy: id(), noSurcharge: id() };
  await db.insert(merchants).values([
    {
      id: merchant.bullish,
      name: "Bullish Hype",
      nameNormalized: "bullish hype",
      whatsappPhone: "3000000001",
    },
    { id: merchant.amy, name: "Amy Tecnology", nameNormalized: "amy tecnology" },
    { id: merchant.noSurcharge, name: "Tienda Sin Recargo", nameNormalized: "tienda sin recargo" },
  ]);
  await db
    .insert(merchantAliases)
    .values([
      { id: id(), merchantId: merchant.amy, alias: "Amy Tech", aliasNormalized: "amy tech" },
    ]);
  const pickup = { bullish: id(), bullishSecondary: id(), amy: id(), noSurcharge: id() };
  await db.insert(pickupPoints).values([
    {
      id: pickup.bullish,
      merchantId: merchant.bullish,
      label: "Bodega Estadio",
      address: "Cra 70 # 45-10",
      neighborhoodId: place.estadio,
      isDefault: true,
    },
    {
      id: pickup.bullishSecondary,
      merchantId: merchant.bullish,
      label: "Local Laureles",
      address: "Cq 1 # 70-20",
      neighborhoodId: place.laureles,
    },
    {
      id: pickup.amy,
      merchantId: merchant.amy,
      label: "Bodega Amy",
      address: "Cl 30 # 65-15",
      neighborhoodId: place.laureles,
      isDefault: true,
    },
    {
      id: pickup.noSurcharge,
      merchantId: merchant.noSurcharge,
      label: "Tienda",
      address: "Cl 10 # 40-12",
      neighborhoodId: place.laureles,
      isDefault: true,
    },
  ]);

  const rate = (
    kind: "zone_rate" | "express_surcharge",
    amount: number,
    rateZoneId: string | null,
    merchantId: string | null = null,
  ) => ({ id: id(), kind, amount, rateZoneId, merchantId, effectiveFrom, createdBy: ownerId });
  await db
    .insert(rateCardEntries)
    .values([
      rate("zone_rate", 13000, zone.medellin),
      rate("zone_rate", 15000, zone.belloItagui),
      rate("zone_rate", 15000, zone.terminals),
      rate("express_surcharge", 4500, null),
      rate("zone_rate", 9700, zone.medellin, merchant.amy),
      rate("zone_rate", 10700, zone.belloItagui, merchant.amy),
      rate("express_surcharge", 0, null, merchant.noSurcharge),
    ]);

  const carrier = id();
  await db.insert(carriers).values({ id: carrier, name: "Coonorte", nameNormalized: "coonorte" });

  return { zone, municipality, place, merchant, pickup, carrier };
}

export type Catalog = Awaited<ReturnType<typeof createCatalog>>;
