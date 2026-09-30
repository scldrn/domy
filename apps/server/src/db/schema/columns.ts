import { timestamp } from "drizzle-orm/pg-core";

/** Fresh column builders: a builder must not be shared between tables. */
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
