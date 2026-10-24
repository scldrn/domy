import { isFinal } from "@domy/domain";
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

/** JPEG files start with the SOI marker and the first segment's marker byte (SEC-6). */
function isJpeg(image: Uint8Array): boolean {
  return image.byteLength >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

/** A bucket failure or timeout is a catalogued 503 the phone retries, not a 500 (ROB-1, FR-023). */
async function inBucket<T>(c: Context<AppEnv>, operation: () => Promise<T>, message?: string) {
  try {
    return await operation();
  } catch {
    c.get("logger").warn({ outcome: "failed" }, "Photo storage unavailable");
    throw new AppError("storage_unavailable", message ? { message } : {});
  }
}

/**
 * Uploads of the same photo in this process run one after another, so a concurrent writer
 * with different bytes can never overwrite the first acknowledged image (Finding IV-31, T134)
 * while no database connection is held across the bucket call (ROB-1). The server runs as a
 * single process, as the in-memory public rate limit already assumes (research R14).
 */
const photoUploads = new Map<string, Promise<unknown>>();

async function oneAtATime<T>(photoId: string, task: () => Promise<T>): Promise<T> {
  const previous = photoUploads.get(photoId) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.catch(() => undefined);
  photoUploads.set(photoId, settled);
  try {
    return await run;
  } finally {
    if (photoUploads.get(photoId) === settled) photoUploads.delete(photoId);
  }
}

/**
 * Handles proof-photo upload (FR-009, FR-023, Finding IV-31, ROB-1): authorize and check
 * immutability with a plain read, write the bucket with no transaction open, then acknowledge
 * in a short transaction that re-checks the row under FOR UPDATE.
 */
export async function uploadPhoto(
  c: Context<AppEnv>,
  photoId: string,
  courierIdFilter?: string,
): Promise<Response> {
  const db = c.get("db");
  const storage = c.get("storage");
  const clock = c.get("clock");
  const logger = c.get("logger");

  const notJpeg = "La foto debe ser una imagen JPEG.";
  if (c.req.header("content-type") !== photoType) {
    throw new AppError("invalid_request", { message: notJpeg });
  }
  const image = new Uint8Array(await c.req.arrayBuffer());
  if (image.byteLength === 0) {
    throw new AppError("invalid_request", { message: "La foto llegó vacía." });
  }
  if (!isJpeg(image)) {
    throw new AppError("invalid_request", { message: notJpeg });
  }

  /** First-acknowledged proof-photo immutability: identical bytes are an idempotent success. */
  async function assertSameImage(acknowledged: { storageKey: string; byteSize: number | null }) {
    if (acknowledged.byteSize !== image.byteLength) {
      throw new AppError("photo_immutable");
    }
    const existing = await inBucket(c, () => storage.getPhoto(acknowledged.storageKey));
    if (!existing || !bytesEqual(existing, image)) {
      throw new AppError("photo_immutable");
    }
  }

  await oneAtATime(photoId, async () => {
    const [photo] = await db
      .select({
        id: recordPhotos.id,
        storageKey: recordPhotos.storageKey,
        uploadedAt: recordPhotos.uploadedAt,
        byteSize: recordPhotos.byteSize,
      })
      .from(recordPhotos)
      .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
      .where(
        courierIdFilter
          ? and(eq(recordPhotos.id, photoId), eq(courierRecords.courierId, courierIdFilter))
          : eq(recordPhotos.id, photoId),
      );
    if (!photo) {
      throw new AppError("not_found", { message: "No encontramos esa foto." });
    }
    if (photo.uploadedAt !== null) {
      // Replay without mutating uploadedAt or rewriting bytes (FR-023 / IV-31).
      await assertSameImage(photo);
      return;
    }

    await inBucket(c, () => storage.putPhoto(photo.storageKey, image));

    let winner: { byteSize: number | null } | undefined;
    try {
      winner = await db.transaction(async (tx) => {
        const [current] = await tx
          .select({ uploadedAt: recordPhotos.uploadedAt, byteSize: recordPhotos.byteSize })
          .from(recordPhotos)
          .where(eq(recordPhotos.id, photo.id))
          .for("update");
        if (current?.uploadedAt) return current;
        await tx
          .update(recordPhotos)
          .set({ uploadedAt: clock(), byteSize: image.byteLength })
          .where(eq(recordPhotos.id, photo.id));
        return undefined;
      });
    } catch (dbError) {
      // Nothing acknowledges the object we just wrote: remove it (DATA-3).
      try {
        await storage.deletePhoto(photo.storageKey);
      } catch {
        logger.warn({ outcome: "failed" }, "Failed to clean up orphan S3 photo on DB error");
      }
      throw dbError;
    }
    // Another writer acknowledged the photo first: same rules as a replay.
    if (winner) await assertSameImage({ ...photo, byteSize: winner.byteSize });
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
        courierId: courierRecords.courierId,
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

      // 003 FR-036 / owner decision D2: a courier sees only their own photos (the author of
      // the record), and only of work still in their app: the shipment is on their in-progress
      // route, or they hold it and it is not final. Anyone else gets 403.
      let authorized = false;
      if (row.courierId === courier.id) {
        authorized = row.custodyCourierId === courier.id && !isFinal(row.shipmentStatus);
        if (!authorized && row.shipmentRouteId) {
          const [activeRoute] = await db
            .select({ id: routes.id })
            .from(routes)
            .where(
              and(
                eq(routes.id, row.shipmentRouteId),
                eq(routes.courierId, courier.id),
                eq(routes.status, "in_progress"),
              ),
            );
          authorized = Boolean(activeRoute);
        }
      }

      if (!authorized) {
        throw new AppError("forbidden");
      }
    }

    if (!row.uploadedAt) {
      throw new AppError("not_found", { message: "La foto todavía no ha llegado." });
    }

    const image = await inBucket(
      c,
      () => c.get("storage").getPhoto(row.storageKey),
      "No pudimos cargar la foto. Intenta de nuevo.",
    );
    if (!image) {
      throw new AppError("not_found", { message: "Esta foto ya no está disponible." });
    }

    return c.body(image, 200, {
      "content-type": "image/jpeg",
      "cache-control": "private, no-cache, no-store, must-revalidate",
    });
  });
