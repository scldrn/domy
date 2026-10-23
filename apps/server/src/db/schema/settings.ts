import { sql } from "drizzle-orm";
import { check, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { updatedAt } from "./columns.ts";
import { neighborhoods } from "./geography.ts";

/** The id of the only row of `company_settings`, also its entity id in the audit history. */
export const companySettingsId = "00000000-0000-7000-8000-000000000001";

/** The company's settings: a single row (feature 003, FR-041). */
export const companySettings = pgTable(
  "company_settings",
  {
    id: uuid().primaryKey().default(companySettingsId),
    officeAddress: text(),
    officeNeighborhoodId: uuid().references(() => neighborhoods.id),
    supportPhone: text(),
    companyName: text().notNull().default("Cohex"),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "company_settings_single_row_check",
      sql`${table.id} = ${sql.raw(`'${companySettingsId}'`)}`,
    ),
    check(
      "company_settings_office_check",
      sql`(${table.officeAddress} is null) = (${table.officeNeighborhoodId} is null)
        and (${table.officeAddress} is null or char_length(${table.officeAddress}) between 5 and 200)`,
    ),
    check(
      "company_settings_support_phone_check",
      sql`${table.supportPhone} is null or ${table.supportPhone} ~ '^[0-9]{10}$'`,
    ),
    check("company_settings_company_name_check", sql`char_length(btrim(${table.companyName})) > 0`),
  ],
);
