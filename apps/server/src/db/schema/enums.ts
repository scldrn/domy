import {
  neighborhoodKinds,
  packageSizes,
  paymentModes,
  rateEntryKinds,
  serviceLevels,
  shipmentKinds,
  shipmentStatuses,
  userRoles,
} from "@domy/domain";
import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", userRoles);
export const shipmentKind = pgEnum("shipment_kind", shipmentKinds);
export const shipmentStatus = pgEnum("shipment_status", shipmentStatuses);
export const paymentMode = pgEnum("payment_mode", paymentModes);
export const serviceLevel = pgEnum("service_level", serviceLevels);
export const packageSize = pgEnum("package_size", packageSizes);
export const neighborhoodKind = pgEnum("neighborhood_kind", neighborhoodKinds);
export const rateEntryKind = pgEnum("rate_entry_kind", rateEntryKinds);
export const shipmentEventType = pgEnum("shipment_event_type", [
  "created",
  "updated",
  "fee_confirmed",
  "voided",
  "status_changed",
]);
export const auditAction = pgEnum("audit_action", [
  "created",
  "updated",
  "deactivated",
  "reactivated",
]);
