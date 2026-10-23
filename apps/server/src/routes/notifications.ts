import {
  bogotaToday,
  notificationListQuery,
  notificationListSchema,
  notificationMarkInput,
} from "@domy/domain";
import type { NotificationList, NotificationMerchant, NotificationMarkInput } from "@domy/domain";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { merchants, neighborhoods, shipmentEvents, shipments } from "../db/schema/index.ts";
import { assertAccountActor } from "../lib/account-actor.ts";
import { AppError } from "../lib/errors.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const notificationReceiptSchema = z.strictObject({
  operation: z.literal("notification_mark"),
  shipmentIds: z.array(z.uuid()),
});

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export const notificationRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", validate("query", notificationListQuery), async (c) => {
    const { date: requestedDate } = c.req.valid("query");
    const date = requestedDate ?? bogotaToday(c.get("clock")());
    const rows = await c
      .get("db")
      .select({
        merchantId: merchants.id,
        merchantName: merchants.name,
        whatsappPhone: merchants.whatsappPhone,
        linkCode: merchants.linkCode,
        isActive: merchants.isActive,
        shipmentId: shipments.id,
        trackingNumber: shipments.trackingNumber,
        trackingCode: shipments.trackingCode,
        recipientName: shipments.recipientName,
        neighborhood: neighborhoods.name,
        status: shipments.status,
        notifiedAt: shipments.notifiedAt,
        registeredAt: shipments.registeredAt,
      })
      .from(shipments)
      .innerJoin(merchants, eq(merchants.id, shipments.merchantId))
      .leftJoin(neighborhoods, eq(neighborhoods.id, shipments.recipientNeighborhoodId))
      .where(and(eq(shipments.serviceDate, date), ne(shipments.status, "voided")))
      .orderBy(
        asc(merchants.name),
        asc(merchants.id),
        asc(shipments.registeredAt),
        asc(shipments.id),
      );

    const byMerchant = new Map<string, NotificationMerchant>();
    for (const row of rows) {
      let merchant = byMerchant.get(row.merchantId);
      if (!merchant) {
        merchant = {
          merchantId: row.merchantId,
          name: row.merchantName,
          whatsappPhone: row.whatsappPhone,
          linkCode: row.linkCode,
          isActive: row.isActive,
          shipments: [],
        };
        byMerchant.set(row.merchantId, merchant);
      }
      merchant.shipments.push({
        id: row.shipmentId,
        trackingNumber: row.trackingNumber,
        trackingCode: row.trackingCode,
        recipientName: row.recipientName,
        neighborhood: row.neighborhood,
        status: row.status,
        notifiedAt: row.notifiedAt?.toISOString() ?? null,
      });
    }

    const result: NotificationList = { merchants: [...byMerchant.values()] };
    return c.json(notificationListSchema.parse(result));
  })
  .post("/", validate("json", notificationMarkInput), async (c) => {
    const input: NotificationMarkInput = c.req.valid("json");
    const actorId = c.get("user").id;
    const expectedActorId = c.req.header("X-Domy-Actor-Id");
    if (expectedActorId !== undefined) assertAccountActor(expectedActorId, actorId);

    const actionId = input.actionId.toLowerCase();
    const shipmentIds = input.shipmentIds.map((id) => id.toLowerCase()).sort();
    const db = c.get("db");

    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('domy:notifications:' || ${actionId}, 0))`,
        );

        const [receipt] = await tx
          .select({
            type: shipmentEvents.type,
            actorUserId: shipmentEvents.actorUserId,
            changes: shipmentEvents.changes,
          })
          .from(shipmentEvents)
          .where(eq(shipmentEvents.clientEventId, actionId))
          .limit(1);
        if (receipt) {
          const parsed = notificationReceiptSchema.safeParse(receipt.changes);
          const receiptIds = parsed.success
            ? parsed.data.shipmentIds.map((id) => id.toLowerCase()).sort()
            : [];
          if (
            receipt.type === "notified" &&
            receipt.actorUserId === actorId &&
            parsed.success &&
            sameIds(receiptIds, shipmentIds)
          ) {
            return;
          }
          throw new AppError("idempotency_conflict");
        }

        const lockedShipments = await tx
          .select({
            id: shipments.id,
            notifiedAt: shipments.notifiedAt,
          })
          .from(shipments)
          .where(inArray(shipments.id, shipmentIds))
          .orderBy(asc(shipments.id))
          .for("update");
        if (lockedShipments.length !== shipmentIds.length) {
          throw new AppError("not_found", { message: "No encontramos uno o más envíos." });
        }

        const now = c.get("clock")();
        const unnotifiedIds = lockedShipments
          .filter((shipment) => shipment.notifiedAt === null)
          .map((shipment) => shipment.id);
        if (unnotifiedIds.length > 0) {
          await tx
            .update(shipments)
            .set({ notifiedAt: now, notifiedBy: actorId })
            .where(inArray(shipments.id, unnotifiedIds));
        }

        const eventRows = shipmentIds.map((shipmentId, index) => ({
          shipmentId,
          type: "notified" as const,
          fromStatus: null,
          toStatus: null,
          actorUserId: actorId,
          occurredAt: now,
          recordedAt: now,
          changes: index === 0 ? { operation: "notification_mark", shipmentIds } : null,
          clientEventId: index === 0 ? actionId : null,
        }));
        await tx.insert(shipmentEvents).values(eventRows);
      });
    } catch (error) {
      if (isUniqueViolation(error, "shipment_events_client_event_id_key")) {
        throw new AppError("idempotency_conflict");
      }
      throw error;
    }

    return c.body(null, 204);
  });
