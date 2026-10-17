import {
  handoverStatuses,
  routeStatuses,
  routeEventTypes,
  stopKinds,
  taskStatuses,
} from "@domy/domain";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { createdAt, updatedAt } from "./columns.ts";
import { couriers } from "./directories.ts";
import { neighborhoods } from "./geography.ts";
import { shipments } from "./shipments.ts";

/** Routes and dispatch (feature 002, data-model.md). */

export const routeStatus = pgEnum("route_status", routeStatuses);
export const stopKind = pgEnum("stop_kind", stopKinds);
export const taskStatus = pgEnum("task_status", taskStatuses);
export const handoverStatus = pgEnum("handover_status", handoverStatuses);
export const routeEventType = pgEnum("route_event_type", routeEventTypes);

export const routes = pgTable(
  "routes",
  {
    id: uuid().primaryKey(),
    serviceDate: date({ mode: "string" }).notNull(),
    number: integer().notNull(),
    courierId: uuid().references(() => couriers.id),
    status: routeStatus().notNull().default("draft"),
    cancelReason: text(),
    dispatchedAt: timestamp({ withTimezone: true }),
    dispatchedBy: uuid().references(() => users.id),
    finishedAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("routes_service_date_number_key").on(table.serviceDate, table.number),
    // One route in progress per courier, across service dates (FR-009, research R6).
    uniqueIndex("routes_one_in_progress_per_courier")
      .on(table.courierId)
      .where(sql`${table.status} = 'in_progress'`),
    check(
      "routes_courier_check",
      sql`${table.status} not in ('in_progress', 'finished') or ${table.courierId} is not null`,
    ),
    check(
      "routes_cancel_reason_check",
      sql`(${table.status} = 'cancelled') = (${table.cancelReason} is not null)
        and (${table.cancelReason} is null or char_length(${table.cancelReason}) between 5 and 200)`,
    ),
    index("routes_service_date_idx").on(table.serviceDate, table.status),
  ],
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: uuid().primaryKey(),
    routeId: uuid()
      .notNull()
      .references(() => routes.id),
    position: integer().notNull(),
    kind: stopKind().notNull(),
    address: text().notNull(),
    neighborhoodId: uuid().references(() => neighborhoods.id),
    createdAt: createdAt(),
  },
  // A reorder moves positions out of the way first, so the pair stays unique at every step.
  (table) => [unique("route_stops_route_position_key").on(table.routeId, table.position)],
);

export const handovers = pgTable(
  "handovers",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    shipmentId: uuid()
      .notNull()
      .references(() => shipments.id),
    fromCourierId: uuid()
      .notNull()
      .references(() => couriers.id),
    toCourierId: uuid()
      .notNull()
      .references(() => couriers.id),
    fromRouteId: uuid().references(() => routes.id),
    toRouteId: uuid()
      .notNull()
      .references(() => routes.id),
    reason: text().notNull(),
    status: handoverStatus().notNull().default("pending"),
    requestedBy: uuid()
      .notNull()
      .references(() => users.id),
    requestedAt: timestamp({ withTimezone: true }).notNull(),
    resolvedBy: uuid().references(() => users.id),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedOnBehalf: boolean().notNull().default(false),
  },
  (table) => [
    uniqueIndex("handovers_one_pending_per_shipment")
      .on(table.shipmentId)
      .where(sql`${table.status} = 'pending'`),
    check("handovers_couriers_check", sql`${table.fromCourierId} <> ${table.toCourierId}`),
    check("handovers_reason_check", sql`char_length(${table.reason}) between 5 and 200`),
  ],
);

export const routeTasks = pgTable(
  "route_tasks",
  {
    // Time-ordered, so the tasks of a stop keep the order in which shipments joined it.
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    stopId: uuid()
      .notNull()
      .references(() => routeStops.id),
    shipmentId: uuid()
      .notNull()
      .references(() => shipments.id),
    kind: stopKind().notNull(),
    status: taskStatus().notNull().default("pending"),
    completedAt: timestamp({ withTimezone: true }),
    completedByCourierId: uuid().references(() => couriers.id),
    blockedByHandoverId: uuid().references(() => handovers.id),
    /** "Problema de recogida", cleared when the task is completed (feature 003, FR-014). */
    problemNote: text(),
  },
  (table) => [
    uniqueIndex("route_tasks_one_pending_per_shipment_kind")
      .on(table.shipmentId, table.kind)
      .where(sql`${table.status} = 'pending'`),
    // A task waiting for a handover cannot be completed (FR-025).
    check(
      "route_tasks_blocked_check",
      sql`${table.blockedByHandoverId} is null or ${table.status} = 'pending'`,
    ),
    check(
      "route_tasks_problem_note_check",
      sql`${table.problemNote} is null or char_length(${table.problemNote}) between 5 and 200`,
    ),
    index("route_tasks_stop_idx").on(table.stopId),
  ],
);

/** Append-only history of every route action (FR-022). */
export const routeEvents = pgTable(
  "route_events",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    routeId: uuid()
      .notNull()
      .references(() => routes.id),
    type: routeEventType().notNull(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    shipmentId: uuid().references(() => shipments.id),
    fromCourierId: uuid().references(() => couriers.id),
    toCourierId: uuid().references(() => couriers.id),
    reason: text(),
    changes: jsonb(),
    clientEventId: uuid().unique("route_events_client_event_id_key"),
    /** Recorded by dispatch for a courier, as confirming a handover (FR-025). */
    onBehalf: boolean().notNull().default(false),
  },
  (table) => [index("route_events_route_idx").on(table.routeId, table.occurredAt)],
);
