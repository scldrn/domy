import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  type AnyPgColumn,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { createdAt, updatedAt } from "./columns.ts";
import { carriers, couriers, merchants, pickupPoints } from "./directories.ts";
import {
  packageSize,
  paymentMode,
  serviceLevel,
  shipmentEventType,
  shipmentKind,
  shipmentStatus,
} from "./enums.ts";
import { neighborhoods, rateZones } from "./geography.ts";
import { routes } from "./routes.ts";

export const bulkBatches = pgTable("bulk_batches", {
  id: uuid().primaryKey(),
  merchantId: uuid()
    .notNull()
    .references(() => merchants.id),
  createdBy: uuid()
    .notNull()
    .references(() => users.id),
  rowCount: integer().notNull(),
  createdCount: integer().notNull(),
  createdAt: createdAt(),
});

export const shipments = pgTable(
  "shipments",
  {
    id: uuid().primaryKey(),
    trackingNumber: char({ length: 8 }).notNull().unique("shipments_tracking_number_key"),
    kind: shipmentKind().notNull(),
    status: shipmentStatus().notNull().default("registered"),
    serviceDate: date({ mode: "string" }).notNull(),
    merchantId: uuid()
      .notNull()
      .references(() => merchants.id),
    pickupPointId: uuid().references(() => pickupPoints.id),
    pickupAddress: text().notNull(),
    pickupNeighborhoodId: uuid()
      .notNull()
      .references(() => neighborhoods.id),
    recipientName: text(),
    recipientNameNormalized: text(),
    recipientPhone: text(),
    recipientAddress: text(),
    recipientNeighborhoodId: uuid().references(() => neighborhoods.id),
    carrierId: uuid().references(() => carriers.id),
    destinationTown: text(),
    errandDescription: text(),
    rateZoneId: uuid().references(() => rateZones.id),
    serviceLevel: serviceLevel().notNull().default("standard"),
    calculatedFee: integer(),
    fee: integer().notNull(),
    feeOverrideReason: text(),
    feeNeedsReview: boolean().notNull().default(false),
    paymentMode: paymentMode().notNull(),
    codAmount: integer().notNull().default(0),
    windowStart: timestamp({ withTimezone: true }),
    windowEnd: timestamp({ withTimezone: true }),
    packageSize: packageSize(),
    packageCount: integer(),
    merchantReference: text(),
    instructions: text(),
    voidReason: text(),
    bulkBatchId: uuid().references(() => bulkBatches.id),
    /** The route currently carrying the shipment (feature 002, FR-004). */
    routeId: uuid().references((): AnyPgColumn => routes.id),
    /** Who holds the package: set at pickup, changed only by a confirmed handover (FR-025). */
    custodyCourierId: uuid().references(() => couriers.id),
    /** The office holds the package (feature 003, FR-041). */
    heldAtOffice: boolean().notNull().default(false),
    /** A return to sender was decided and is not completed: "Devolución en curso" (FR-029). */
    returnDecided: boolean().notNull().default(false),
    /** "Por revisar" (feature 003, FR-025, FR-026). */
    needsReview: boolean().notNull().default(false),
    version: integer().notNull().default(1),
    registeredAt: timestamp({ withTimezone: true }).notNull(),
    registeredBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "shipments_payment_mode_check",
      sql`(${table.paymentMode} = 'cash_on_delivery' and ${table.codAmount} > 0)
        or (${table.paymentMode} = 'recipient_pays_fee' and ${table.codAmount} = ${table.fee})
        or (${table.paymentMode} = 'merchant_account' and ${table.codAmount} = 0)`,
    ),
    check(
      "shipments_kind_fields_check",
      sql`case ${table.kind}
        when 'delivery' then ${table.recipientName} is not null and ${table.recipientPhone} is not null
          and ${table.recipientAddress} is not null and ${table.recipientNeighborhoodId} is not null
        when 'reverse_pickup' then ${table.recipientName} is not null and ${table.recipientPhone} is not null
          and ${table.recipientAddress} is not null and ${table.recipientNeighborhoodId} is not null
        when 'carrier_handoff' then ${table.recipientNeighborhoodId} is not null
          and ${table.carrierId} is not null and ${table.destinationTown} is not null
        when 'errand' then ${table.errandDescription} is not null
      end`,
    ),
    check(
      "shipments_void_reason_check",
      sql`(${table.status} = 'voided') = (${table.voidReason} is not null)`,
    ),
    check(
      "shipments_fee_override_check",
      sql`(${table.calculatedFee} is not null and ${table.fee} = ${table.calculatedFee})
        or ${table.feeOverrideReason} is not null`,
    ),
    check(
      "shipments_reason_length_check",
      sql`(${table.feeOverrideReason} is null or char_length(${table.feeOverrideReason}) between 5 and 200)
        and (${table.voidReason} is null or char_length(${table.voidReason}) between 5 and 200)`,
    ),
    check("shipments_fee_check", sql`${table.fee} > 0`),
    check(
      "shipments_route_check",
      sql`(${table.status} <> 'registered' or ${table.routeId} is null)
        and (${table.status} not in ('assigned', 'dispatched') or ${table.routeId} is not null)`,
    ),
    index("shipments_route_idx").on(table.routeId),
    // Feature 003: the holder is a courier or the office, never both.
    check(
      "shipments_custody_check",
      sql`not (${table.heldAtOffice} and ${table.custodyCourierId} is not null)`,
    ),
    check(
      "shipments_return_decided_check",
      sql`not ${table.returnDecided} or ${table.status} in ('exception', 'returned')`,
    ),
    check("shipments_cod_amount_check", sql`${table.codAmount} >= 0`),
    check(
      "shipments_window_check",
      sql`${table.windowStart} is null or ${table.windowEnd} is null or ${table.windowStart} < ${table.windowEnd}`,
    ),
    check(
      "shipments_package_count_check",
      sql`${table.packageCount} is null or ${table.packageCount} >= 1`,
    ),
    index("shipments_board_idx").on(table.serviceDate, table.status),
    index("shipments_pending_idx")
      .on(table.serviceDate)
      .where(sql`${table.status} not in ('delivered', 'returned', 'voided')`),
    index("shipments_recipient_name_trgm_idx").using(
      "gin",
      sql`${table.recipientNameNormalized} gin_trgm_ops`,
    ),
    index("shipments_recipient_phone_idx").on(table.recipientPhone),
    index("shipments_merchant_reference_idx").on(
      table.merchantId,
      table.merchantReference,
      table.serviceDate,
    ),
  ],
);

/** Append-only history of every shipment change (FR-016). */
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    shipmentId: uuid()
      .notNull()
      .references(() => shipments.id),
    type: shipmentEventType().notNull(),
    fromStatus: shipmentStatus(),
    toStatus: shipmentStatus(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reason: text(),
    changes: jsonb(),
    clientEventId: uuid().unique("shipment_events_client_event_id_key"),
    /** The route a status change, reassignment, or handover refers to (feature 002). */
    routeId: uuid().references((): AnyPgColumn => routes.id),
    /** Recorded by dispatch for a courier, as confirming a handover (feature 002, FR-025). */
    onBehalf: boolean().notNull().default(false),
  },
  (table) => [index("shipment_events_shipment_idx").on(table.shipmentId, table.occurredAt)],
);
