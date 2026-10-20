import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { courierRecords, couriers, recordPhotos, routes, shipments } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";

/**
 * Photos from the private bucket (feature 003, research R6, FR-009, FR-023, FR-036, Finding IV-31, Finding IV-05 / D2):
 * - Uploads are immutable once acknowledged: identical byte replay is an idempotent 204 without
 *   mutating uploadedAt; differing bytes are rejected with 409 photo_immutable.
 * - Downloads are authorized: dispatchers and owners can view any photo; couriers can only view
 *   their own photos of active route work or work held in their custody. Unauthorized couriers receive 403.
 * - Browser cache isolation: Cache-Control is set to private, no-cache, no-store, must-revalidate to prevent
 *   stale evidence across account switches.
 */

export const photoType = "image/jpeg";

const idParam = z.object({ id: z.uuid() });

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  return Buffer.compare(a, b) === 0;
}

export async function signedInCourier(c: Context<AppEnv>): Promise<{ id: string }> {
  const [courier] = await c
    .get("db")
    .select({ id: couriers.id })
    .from(couriers)
    .where(eq(couriers.userId, c.get("user").id));
  if (!courier) {
    throw new AppError("forbidden", {
      message: "Tu cuenta no está vinculada a un mensajero. Pide al propietario que la vincule.",
    });
  }
  return courier;
}

/** Handles proof-photo upload with row-level serialization, immutability checks, and orphan cleanup. */
export async function uploadPhoto(
  c: Context<AppEnv>,
  photoId: string,
  courierIdFilter?: string,
): Promise<Response> {
  const db = c.get("db");
  const storage = c.get("storage");
  const clock = c.get("clock");
  const logger = c.get("logger");

  if (c.req.header("content-type") !== photoType) {
    throw new AppError("invalid_request", { message: "La foto debe ser una imagen JPEG." });
  }
  const image = new Uint8Array(await c.req.arrayBuffer());
  if (image.byteLength === 0) {
    throw new AppError("invalid_request", { message: "La foto llegó vacía." });
  }

  await db.transaction(async (tx) => {
    const query = tx
      .select({
        id: recordPhotos.id,
        storageKey: recordPhotos.storageKey,
        uploadedAt: recordPhotos.uploadedAt,
        byteSize: recordPhotos.byteSize,
        courierId: courierRecords.courierId,
      })
      .from(recordPhotos)
      .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
      .where(
        courierIdFilter
          ? and(eq(recordPhotos.id, photoId), eq(courierRecords.courierId, courierIdFilter))
          : eq(recordPhotos.id, photoId),
      )
      .for("update");

    const [photo] = await query;
    if (!photo) {
      throw new AppError("not_found", { message: "No encontramos esa foto." });
    }

    // If already uploaded (first-acknowledged proof-photo immutability, Finding IV-31)
    if (photo.uploadedAt !== null) {
      if (photo.byteSize !== image.byteLength) {
        throw new AppError("photo_immutable", {
          message: "Esta foto ya fue subida y no puede modificarse.",
        });
      }
      const existing = await storage.getPhoto(photo.storageKey);
      if (!existing || !bytesEqual(existing, image)) {
        throw new AppError("photo_immutable", {
          message: "Esta foto ya fue subida y no puede modificarse.",
        });
      }
      // Identical byte replay: idempotent success without modifying uploadedAt or rewriting bytes
      return;
    }

    // First acknowledged upload: write to S3, then persist metadata
    await storage.putPhoto(photo.storageKey, image);

    try {
      await tx
        .update(recordPhotos)
        .set({ uploadedAt: clock(), byteSize: image.byteLength })
        .where(eq(recordPhotos.id, photo.id));
    } catch (dbError) {
      try {
        await storage.deletePhoto(photo.storageKey);
      } catch (cleanupError) {
        logger.warn({ err: cleanupError }, "Failed to clean up orphan S3 photo on DB error");
      }
      throw dbError;
    }
  });

  return c.body(null, 204);
}

export const photoRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher", "courier"))
  .put("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    let courierIdFilter: string | undefined;
    if (user.role === "courier") {
      const courier = await signedInCourier(c);
      courierIdFilter = courier.id;
    }
    return uploadPhoto(c, c.req.valid("param").id, courierIdFilter);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const photoId = c.req.valid("param").id;

    const [row] = await db
      .select({
        id: recordPhotos.id,
        storageKey: recordPhotos.storageKey,
        uploadedAt: recordPhotos.uploadedAt,
        recordId: recordPhotos.recordId,
        courierId: courierRecords.courierId,
        shipmentId: courierRecords.shipmentId,
        recordRouteId: courierRecords.routeId,
        shipmentStatus: shipments.status,
        custodyCourierId: shipments.custodyCourierId,
        shipmentRouteId: shipments.routeId,
      })
      .from(recordPhotos)
      .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
      .innerJoin(shipments, eq(shipments.id, courierRecords.shipmentId))
      .where(eq(recordPhotos.id, photoId));

    if (!row) {
      throw new AppError("not_found", { message: "No encontramos esa foto." });
    }

    if (user.role === "courier") {
      const courier = await signedInCourier(c);

      // Decision D2 / 003 FR-036:
      // Courier photo access is restricted to the courier's own photos of work currently present
      // in the app / active on their route or custody.
      // Unauthorized couriers receive 403 Forbidden.
      let authorized = false;

      // 1. Is the shipment currently in this courier's custody off-route?
      if (
        row.custodyCourierId === courier.id &&
        !["delivered", "returned", "voided"].includes(row.shipmentStatus)
      ) {
        authorized = true;
      }

      // 2. Is the shipment currently on an active (in_progress) route of this courier?
      if (!authorized && row.shipmentRouteId) {
        const [activeShipmentRoute] = await db
          .select({ id: routes.id })
          .from(routes)
          .where(
            and(
              eq(routes.id, row.shipmentRouteId),
              eq(routes.courierId, courier.id),
              eq(routes.status, "in_progress"),
            ),
          );
        if (activeShipmentRoute) {
          authorized = true;
        }
      }

      // 3. Or did the courier upload the photo themselves for current work on their active route?
      if (
        !authorized &&
        row.courierId === courier.id &&
        row.recordRouteId &&
        row.shipmentRouteId === row.recordRouteId
      ) {
        const [activeRecordRoute] = await db
          .select({ id: routes.id })
          .from(routes)
          .where(
            and(
              eq(routes.id, row.recordRouteId),
              eq(routes.courierId, courier.id),
              eq(routes.status, "in_progress"),
            ),
          );
        if (activeRecordRoute) {
          authorized = true;
        }
      }

      if (!authorized) {
        throw new AppError("forbidden");
      }
    }

    if (!row.uploadedAt) {
      throw new AppError("not_found", { message: "La foto todavía no ha llegado." });
    }

    const image = await c.get("storage").getPhoto(row.storageKey);
    if (!image) {
      throw new AppError("not_found", { message: "Esta foto ya no está disponible." });
    }

    return c.body(image, 200, {
      "content-type": "image/jpeg",
      "cache-control": "private, no-cache, no-store, must-revalidate",
    });
  });
