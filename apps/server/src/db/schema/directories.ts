import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { createdAt, publicCodeDefault, updatedAt } from "./columns.ts";
import { neighborhoods } from "./geography.ts";

export const merchants = pgTable(
  "merchants",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    nameNormalized: text().notNull().unique("merchants_name_normalized_key"),
    linkCode: text().notNull().default(publicCodeDefault()).unique("merchants_link_code_key"),
    linkReplacedAt: timestamp({ withTimezone: true }),
    whatsappPhone: text(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("merchants_link_code_format_check", sql`${table.linkCode} ~ '^[A-Za-z0-9_-]{22}$'`),
  ],
);

export const merchantAliases = pgTable("merchant_aliases", {
  id: uuid().primaryKey(),
  merchantId: uuid()
    .notNull()
    .references(() => merchants.id),
  alias: text().notNull(),
  aliasNormalized: text().notNull().unique("merchant_aliases_alias_normalized_key"),
  createdAt: createdAt(),
});

export const pickupPoints = pgTable(
  "pickup_points",
  {
    id: uuid().primaryKey(),
    merchantId: uuid()
      .notNull()
      .references(() => merchants.id),
    label: text().notNull(),
    address: text().notNull(),
    neighborhoodId: uuid()
      .notNull()
      .references(() => neighborhoods.id),
    instructions: text(),
    isDefault: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("pickup_points_one_default_per_merchant")
      .on(table.merchantId)
      .where(sql`${table.isDefault}`),
    index("pickup_points_merchant_idx").on(table.merchantId),
  ],
);

export const couriers = pgTable("couriers", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  userId: uuid()
    .unique("couriers_user_id_key")
    .references(() => users.id),
  isActive: boolean().notNull().default(true),
  /** The courier app's last snapshot request (feature 003, FR-033). */
  lastSyncedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const courierAliases = pgTable("courier_aliases", {
  id: uuid().primaryKey(),
  courierId: uuid()
    .notNull()
    .references(() => couriers.id),
  alias: text().notNull(),
  aliasNormalized: text().notNull().unique("courier_aliases_alias_normalized_key"),
  createdAt: createdAt(),
});

export const carriers = pgTable("carriers", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  nameNormalized: text().notNull().unique("carriers_name_normalized_key"),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
