import {
  collectedTotal,
  isWithinPhotoWait,
  recordFlags,
  type CourierRecord,
  type RecordFlagKind,
} from "@domy/domain";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../db/client.ts";
import {
  courierRecords,
  couriers,
  recordPhotos,
  routeTasks,
  shipments,
  users,
} from "../db/schema/index.ts";

/**
 * The courier's records as the panel shows them (feature 003, FR-033, FR-036): the flags of
 * the board (research R11) and the records of a shipment.
 */

/** The record flags of each shipment, by id; a shipment without records has none. */
export async function loadRecordFlags(
  db: Executor,
  shipmentIds: string[],
  now: Date,
): Promise<Map<string, RecordFlagKind[]>> {
  const result = new Map<string, RecordFlagKind[]>();
  if (shipmentIds.length === 0) return result;
  const [rows, records, problems] = await Promise.all([
    db
      .select({
        id: shipments.id,
        codAmount: shipments.codAmount,
        needsReview: shipments.needsReview,
      })
      .from(shipments)
      .where(inArray(shipments.id, shipmentIds)),
    db
      .select()
      .from(courierRecords)
      .where(
        and(
          inArray(courierRecords.shipmentId, shipmentIds),
          eq(courierRecords.outcome, "applied"),
          isNull(courierRecords.revertedAt),
        ),
      )
      .orderBy(asc(courierRecords.occurredAt), asc(courierRecords.recordedAt)),
    db
      .selectDistinct({ shipmentId: routeTasks.shipmentId })
      .from(routeTasks)
      .where(
        and(
          inArray(routeTasks.shipmentId, shipmentIds),
          eq(routeTasks.status, "pending"),
          isNotNull(routeTasks.problemNote),
        ),
      ),
  ]);
  const photos =
    records.length === 0
      ? []
      : await db
          .select()
          .from(recordPhotos)
          .where(
            inArray(
              recordPhotos.recordId,
              records.map((record) => record.id),
            ),
          );
  const withProblem = new Set(problems.map((problem) => problem.shipmentId));
  for (const row of rows) {
    const own = records.filter((record) => record.shipmentId === row.id);
    // The latest delivery (or completed errand) or return proves it (FR-009).
    const proof = own.findLast((record) => record.kind === "delivery" || record.kind === "return");
    const proofPhotos = photos.filter(
      (photo) => photo.recordId === proof?.id && photo.kind === "proof",
    );
    const pendingPhotos = photos.filter((photo) => {
      const record = own.find((each) => each.id === photo.recordId);
      return (
        record &&
        !proofPhotos.includes(photo) &&
        photo.uploadedAt === null &&
        isWithinPhotoWait(record.recordedAt, now)
      );
    }).length;
    result.set(
      row.id,
      recordFlags(
        {
          proof: proof
            ? {
                recordedAt: proof.recordedAt,
                photos: proofPhotos.map((photo) => ({ uploaded: photo.uploadedAt !== null })),
              }
            : null,
          collection:
            proof?.kind === "delivery"
              ? { total: collectedTotal(proof), codAmount: row.codAmount }
              : null,
          pickupProblem: withProblem.has(row.id),
          needsReview: row.needsReview,
          pendingPhotos,
        },
        now,
      ),
    );
  }
  return result;
}

const authors = alias(users, "authors");
const reverters = alias(users, "reverters");

/** A shipment's courier records, oldest first, with their photos (FR-036). */
export async function loadShipmentRecords(
  db: Executor,
  shipmentId: string,
): Promise<CourierRecord[]> {
  const rows = await db
    .select({
      record: courierRecords,
      courier: { id: couriers.id, name: couriers.name },
      author: { id: authors.id, name: authors.name },
      reverter: { id: reverters.id, name: reverters.name },
    })
    .from(courierRecords)
    .innerJoin(couriers, eq(couriers.id, courierRecords.courierId))
    .innerJoin(authors, eq(authors.id, courierRecords.authorUserId))
    .leftJoin(reverters, eq(reverters.id, courierRecords.revertedBy))
    .where(eq(courierRecords.shipmentId, shipmentId))
    .orderBy(asc(courierRecords.occurredAt), asc(courierRecords.recordedAt));
  const photos =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(recordPhotos)
          .where(
            inArray(
              recordPhotos.recordId,
              rows.map(({ record }) => record.id),
            ),
          );
  return rows.map(({ record, courier, author, reverter }) => ({
    id: record.id,
    shipmentId: record.shipmentId,
    kind: record.kind,
    outcome: record.outcome,
    courier,
    author,
    onBehalf: record.onBehalf,
    occurredAt: record.occurredAt.toISOString(),
    recordedAt: record.recordedAt.toISOString(),
    location:
      record.latitude !== null && record.longitude !== null && record.locationAccuracyM !== null
        ? {
            latitude: record.latitude,
            longitude: record.longitude,
            accuracyM: record.locationAccuracyM,
          }
        : null,
    receivedByName: record.receivedByName,
    cashAmount: record.cashAmount,
    companyTransferAmount: record.companyTransferAmount,
    merchantTransferAmount: record.merchantTransferAmount,
    exceptionReason: record.exceptionReason,
    note: record.note,
    disbursementAmount: record.disbursementAmount,
    payee: record.payee,
    photos: photos
      .filter((photo) => photo.recordId === record.id)
      .map((photo) => ({ id: photo.id, kind: photo.kind, uploaded: photo.uploadedAt !== null })),
    reverted:
      record.revertedAt && reverter?.id && reverter.name && record.revertReason
        ? {
            at: record.revertedAt.toISOString(),
            by: { id: reverter.id, name: reverter.name },
            reason: record.revertReason,
          }
        : null,
  }));
}
