import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { courierRecords, couriers, recordPhotos } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";

/**
 * The courier's photos from the private bucket (feature 003, research R6, FR-036): the office
 * sees any of them, a courier only those of their own records.
 */

const idParam = z.object({ id: z.uuid() });

export const photoRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher", "courier"))
  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const [photo] = await c
      .get("db")
      .select({
        storageKey: recordPhotos.storageKey,
        uploadedAt: recordPhotos.uploadedAt,
        courierUserId: couriers.userId,
      })
      .from(recordPhotos)
      .innerJoin(courierRecords, eq(courierRecords.id, recordPhotos.recordId))
      .innerJoin(couriers, eq(couriers.id, courierRecords.courierId))
      .where(eq(recordPhotos.id, c.req.valid("param").id));
    // Another courier's photo does not exist for this one.
    if (!photo || (user.role === "courier" && photo.courierUserId !== user.id)) {
      throw new AppError("not_found", { message: "No encontramos esa foto." });
    }
    if (!photo.uploadedAt) {
      throw new AppError("not_found", { message: "La foto todavía no ha llegado." });
    }
    // Gone after the bucket's 12-month retention; the record stays.
    const image = await c.get("storage").getPhoto(photo.storageKey);
    if (!image) throw new AppError("not_found", { message: "Esta foto ya no está disponible." });
    return c.body(image, 200, {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=86400",
    });
  });
