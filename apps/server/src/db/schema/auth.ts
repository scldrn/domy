import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.ts";
import { userRole } from "./enums.ts";

/** Better Auth tables (mapped to plural names) with the admin plugin and lockout columns. */

const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });

export const users = pgTable(
  "users",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: userRole().notNull().default("courier"),
    banned: boolean().notNull().default(false),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true }),
    failedSignInCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_email_lower_key").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable("sessions", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  token: text().notNull().unique("sessions_token_key"),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ipAddress: text(),
  userAgent: text(),
  impersonatedBy: uuid(),
  ...timestamps(),
});

export const accounts = pgTable("accounts", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  accountId: text().notNull(),
  providerId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  ...timestamps(),
});

export const verifications = pgTable("verifications", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ...timestamps(),
});
