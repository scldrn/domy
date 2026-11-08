import { rateEntryKindLabels, type AuditEvent } from "@domy/domain";
import { eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client.ts";
import {
  carriers,
  companySettings,
  couriers,
  merchants,
  municipalities,
  neighborhoods,
  pickupPoints,
  rateCardEntries,
  rateZones,
  users,
} from "../db/schema/index.ts";

/**
 * Names for the audit log instead of identifiers (feature 006, FR-020, research R10,
 * contracts/audit-read.md): each event's record, and the records its reference fields point
 * to, resolved for the whole page with one query per table. Records are deactivated, never
 * deleted, so a deactivated record keeps its name; an unresolved one reads «Registro
 * eliminado» rather than its identifier.
 */

export const unresolvedLabel = "Registro eliminado";

const namedTables = {
  merchant: merchants,
  courier: couriers,
  carrier: carriers,
  neighborhood: neighborhoods,
  user: users,
  rate_zone: rateZones,
  municipality: municipalities,
} as const;
type Named = keyof typeof namedTables;

/** The fields of `changes` that hold another record's identifier. */
const referenceFields: Record<string, Named> = {
  merchantId: "merchant",
  courierId: "courier",
  carrierId: "carrier",
  neighborhoodId: "neighborhood",
  officeNeighborhoodId: "neighborhood",
  userId: "user",
  rateZoneId: "rate_zone",
  municipalityId: "municipality",
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Unlabeled = Omit<AuditEvent, "entityLabel" | "changeLabels">;

export async function labelAuditEvents(db: Executor, events: Unlabeled[]): Promise<AuditEvent[]> {
  const wanted = new Map<Named, Set<string>>();
  const want = (kind: Named, id: unknown) => {
    if (typeof id !== "string" || !uuid.test(id)) return;
    let ids = wanted.get(kind);
    if (!ids) wanted.set(kind, (ids = new Set()));
    ids.add(id);
  };
  const idsOf = (type: string) =>
    events.filter((event) => event.entityType === type).map((event) => event.entityId);
  for (const event of events) {
    if (event.entityType in namedTables) want(event.entityType as Named, event.entityId);
    for (const [field, values] of Object.entries(event.changes ?? {})) {
      const kind = referenceFields[field];
      if (kind) for (const value of values) want(kind, value);
    }
  }

  const names = new Map<string, string>();
  const key = (kind: string, id: string) => `${kind}:${id}`;
  await Promise.all(
    [...wanted].map(async ([kind, ids]) => {
      const table = namedTables[kind];
      const rows = await db
        .select({ id: table.id, name: table.name })
        .from(table)
        .where(inArray(table.id, [...ids]));
      for (const row of rows) names.set(key(kind, row.id), row.name);
    }),
  );

  const pickupIds = idsOf("pickup_point");
  const rateIds = idsOf("rate_card_entry");
  const [pickups, rates, settings] = await Promise.all([
    pickupIds.length
      ? db
          .select({ id: pickupPoints.id, label: pickupPoints.label })
          .from(pickupPoints)
          .where(inArray(pickupPoints.id, pickupIds))
      : [],
    rateIds.length
      ? db
          .select({
            id: rateCardEntries.id,
            kind: rateCardEntries.kind,
            zone: rateZones.name,
            merchant: merchants.name,
          })
          .from(rateCardEntries)
          .leftJoin(rateZones, eq(rateZones.id, rateCardEntries.rateZoneId))
          .leftJoin(merchants, eq(merchants.id, rateCardEntries.merchantId))
          .where(inArray(rateCardEntries.id, rateIds))
      : [],
    idsOf("company_settings").length
      ? db
          .select({ id: companySettings.id, name: companySettings.companyName })
          .from(companySettings)
      : [],
  ]);
  for (const row of pickups) names.set(key("pickup_point", row.id), row.label);
  for (const row of settings) names.set(key("company_settings", row.id), row.name);
  // A rate has no name: its kind, then its zone and the merchant whose rate it is.
  for (const row of rates)
    names.set(
      key("rate_card_entry", row.id),
      [rateEntryKindLabels[row.kind], row.zone, row.merchant].filter(Boolean).join(" · "),
    );

  const label = (kind: string, id: unknown): string | null => {
    if (id === null || id === undefined) return null;
    return (typeof id === "string" && names.get(key(kind, id))) || unresolvedLabel;
  };
  return events.map((event) => ({
    ...event,
    entityLabel: label(event.entityType, event.entityId) ?? unresolvedLabel,
    changeLabels: Object.fromEntries(
      Object.entries(event.changes ?? {}).flatMap(([field, [from, to]]) => {
        const kind = referenceFields[field];
        return kind ? [[field, [label(kind, from), label(kind, to)]]] : [];
      }),
    ),
  }));
}
