import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { createdAt, updatedAt } from "./columns.ts";
import { merchants } from "./directories.ts";
import { neighborhoodKind, rateEntryKind } from "./enums.ts";

export const municipalities = pgTable("municipalities", {
  id: uuid().primaryKey(),
  name: text().notNull().unique("municipalities_name_key"),
  createdAt: createdAt(),
});

export const rateZones = pgTable("rate_zones", {
  id: uuid().primaryKey(),
  name: text().notNull().unique("rate_zones_name_key"),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    nameNormalized: text().notNull(),
    municipalityId: uuid()
      .notNull()
      .references(() => municipalities.id),
    rateZoneId: uuid()
      .notNull()
      .references(() => rateZones.id),
    kind: neighborhoodKind().notNull(),
    isActive: boolean().notNull().default(true),
    needsReview: boolean().notNull().default(false),
    createdBy: uuid().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("neighborhoods_name_municipality_key").on(table.nameNormalized, table.municipalityId),
    index("neighborhoods_name_trgm_idx").using("gin", sql`${table.nameNormalized} gin_trgm_ops`),
  ],
);

export const neighborhoodVariants = pgTable(
  "neighborhood_variants",
  {
    id: uuid().primaryKey(),
    neighborhoodId: uuid()
      .notNull()
      .references(() => neighborhoods.id),
    variantNormalized: text().notNull().unique("neighborhood_variants_variant_normalized_key"),
    createdAt: createdAt(),
  },
  (table) => [
    index("neighborhood_variants_trgm_idx").using(
      "gin",
      sql`${table.variantNormalized} gin_trgm_ops`,
    ),
  ],
);

/** Append-only: rows are never updated or deleted (FR-028). */
export const rateCardEntries = pgTable(
  "rate_card_entries",
  {
    id: uuid().primaryKey(),
    kind: rateEntryKind().notNull(),
    merchantId: uuid().references(() => merchants.id),
    rateZoneId: uuid().references(() => rateZones.id),
    amount: integer().notNull(),
    effectiveFrom: timestamp({ withTimezone: true }).notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (table) => [
    check(
      "rate_card_entries_amount_check",
      sql`(${table.kind} = 'zone_rate' and ${table.amount} > 0) or (${table.kind} = 'express_surcharge' and ${table.amount} >= 0)`,
    ),
    check(
      "rate_card_entries_zone_check",
      sql`(${table.kind} = 'zone_rate') = (${table.rateZoneId} is not null)`,
    ),
    index("rate_card_entries_lookup_idx").on(
      table.kind,
      table.merchantId,
      table.rateZoneId,
      table.effectiveFrom,
    ),
  ],
);
