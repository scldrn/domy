import {
  courierRecordKinds,
  exceptionReasons,
  notAppliedReasons,
  noticeTypes,
  photoKinds,
  recordOutcomes,
} from "@domy/domain";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { createdAt } from "./columns.ts";
import { couriers } from "./directories.ts";
import { routes } from "./routes.ts";
import { shipments } from "./shipments.ts";

/** The courier's records, their photos, notices, and push subscriptions (feature 003). */

export const courierRecordKind = pgEnum("courier_record_kind", courierRecordKinds);
export const recordOutcome = pgEnum("record_outcome", recordOutcomes);
export const exceptionReason = pgEnum("exception_reason", exceptionReasons);
export const notAppliedReason = pgEnum("not_applied_reason", notAppliedReasons);
export const photoKind = pgEnum("photo_kind", photoKinds);
export const noticeType = pgEnum("notice_type", noticeTypes);

/** One row per courier action, including those that could not be applied (FR-024). */
export const courierRecords = pgTable(
  "courier_records",
  {
    /** Generated on the phone: the key that makes every record exactly-once (FR-019). */
    id: uuid().primaryKey(),
    shipmentId: uuid()
      .notNull()
      .references(() => shipments.id),
    kind: courierRecordKind().notNull(),
    courierId: uuid()
      .notNull()
      .references(() => couriers.id),
    authorUserId: uuid()
      .notNull()
      .references(() => users.id),
    /** "Registrado por despacho" (FR-034). */
    onBehalf: boolean().notNull().default(false),
    routeId: uuid().references(() => routes.id),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    locationAccuracyM: integer(),
    outcome: recordOutcome().notNull(),
    /** Why a record was kept without effect (FR-026). */
    notAppliedReason: notAppliedReason(),
    receivedByName: text(),
    cashAmount: integer().notNull().default(0),
    companyTransferAmount: integer().notNull().default(0),
    merchantTransferAmount: integer().notNull().default(0),
    exceptionReason: exceptionReason(),
    note: text(),
    disbursementAmount: integer(),
    payee: text(),
    revertedAt: timestamp({ withTimezone: true }),
    revertedBy: uuid().references(() => users.id),
    revertReason: text(),
  },
  (table) => [
    check("courier_records_time_check", sql`${table.occurredAt} <= ${table.recordedAt}`),
    check(
      "courier_records_outcome_check",
      sql`(${table.outcome} = 'not_applied') = (${table.notAppliedReason} is not null)`,
    ),
    check(
      "courier_records_location_check",
      sql`(${table.latitude} is null) = (${table.longitude} is null)
        and (${table.latitude} is null) = (${table.locationAccuracyM} is null)
        and (${table.locationAccuracyM} is null or ${table.locationAccuracyM} >= 0)`,
    ),
    // A return always names who received it; a delivery does unless it is an errand (FR-008).
    check(
      "courier_records_received_by_check",
      sql`(${table.kind} <> 'return' or ${table.receivedByName} is not null)
        and (${table.kind} in ('delivery', 'return') or ${table.receivedByName} is null)
        and (${table.receivedByName} is null or char_length(${table.receivedByName}) between 2 and 100)`,
    ),
    // FR-010: only a delivery collects.
    check(
      "courier_records_amounts_check",
      sql`${table.cashAmount} >= 0 and ${table.companyTransferAmount} >= 0
        and ${table.merchantTransferAmount} >= 0
        and (${table.kind} = 'delivery'
          or ${table.cashAmount} + ${table.companyTransferAmount} + ${table.merchantTransferAmount} = 0)`,
    ),
    check(
      "courier_records_exception_reason_check",
      sql`(${table.kind} = 'exception') = (${table.exceptionReason} is not null)`,
    ),
    // FR-014: a pickup problem always has its note; FR-011 is checked against the COD amount.
    check(
      "courier_records_note_check",
      sql`(${table.note} is null or char_length(${table.note}) between 5 and 200)
        and (${table.kind} <> 'problem' or ${table.note} is not null)`,
    ),
    check(
      "courier_records_disbursement_check",
      sql`(${table.kind} = 'disbursement') = (${table.disbursementAmount} is not null)
        and (${table.kind} = 'disbursement') = (${table.payee} is not null)
        and (${table.disbursementAmount} is null or ${table.disbursementAmount} > 0)
        and (${table.payee} is null or char_length(${table.payee}) between 2 and 100)`,
    ),
    // FR-035: a revert sets its time, author, and reason together.
    check(
      "courier_records_revert_check",
      sql`(${table.revertedAt} is null) = (${table.revertedBy} is null)
        and (${table.revertedAt} is null) = (${table.revertReason} is null)
        and (${table.revertReason} is null or char_length(${table.revertReason}) between 5 and 200)`,
    ),
    index("courier_records_shipment_idx").on(table.shipmentId, table.occurredAt),
    index("courier_records_courier_idx").on(table.courierId, table.occurredAt),
  ],
);

/** Photos declared by a record; the image arrives later (FR-009, FR-023). */
export const recordPhotos = pgTable(
  "record_photos",
  {
    /** Generated on the phone and declared in the record, so the server expects it. */
    id: uuid().primaryKey(),
    recordId: uuid()
      .notNull()
      .references(() => courierRecords.id),
    kind: photoKind().notNull(),
    storageKey: text().notNull(),
    /** Null until the image arrives: "Foto pendiente" for 24 hours, then missing (FR-023). */
    uploadedAt: timestamp({ withTimezone: true }),
    byteSize: integer(),
  },
  (table) => [
    // At most 1 MB, the body limit of every request (feature 002, research R13).
    check(
      "record_photos_upload_check",
      sql`(${table.uploadedAt} is null) = (${table.byteSize} is null)
        and (${table.byteSize} is null or ${table.byteSize} between 1 and 1048576)`,
    ),
    index("record_photos_record_idx").on(table.recordId),
  ],
);

/** A change to a courier's route that the courier must acknowledge (FR-027). */
export const courierNotices = pgTable(
  "courier_notices",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    courierId: uuid()
      .notNull()
      .references(() => couriers.id),
    type: noticeType().notNull(),
    routeId: uuid().references(() => routes.id),
    shipmentId: uuid().references(() => shipments.id),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    /** Set once, when the courier taps "Entendido". */
    acknowledgedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("courier_notices_unacknowledged_idx")
      .on(table.courierId)
      .where(sql`${table.acknowledgedAt} is null`),
  ],
);

/** Web Push subscriptions of a user's devices (FR-040). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    endpoint: text().notNull().unique("push_subscriptions_endpoint_key"),
    p256dh: text().notNull(),
    auth: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)],
);
