import webPush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import type { Logger } from "pino";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { courierNotices, couriers, pushSubscriptions, routes } from "../db/schema/index.ts";

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

/** FR-040/R8: only committed notices, no recipient data, and never awaited by the action. */
export async function sendNoticePushes(
  db: Db,
  ids: string[],
  config: PushConfig | null,
  logger: Logger,
): Promise<void> {
  if (!config || ids.length === 0) return;
  try {
    const notices = await db
      .select({ type: courierNotices.type, routeNumber: routes.number, userId: couriers.userId })
      .from(courierNotices)
      .innerJoin(couriers, eq(couriers.id, courierNotices.courierId))
      .leftJoin(routes, eq(routes.id, courierNotices.routeId))
      .where(inArray(courierNotices.id, [...new Set(ids)]));
    await Promise.all(
      notices.map(async (notice) => {
        if (!notice.userId) return;
        const subscriptions = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.userId, notice.userId));
        await Promise.all(
          subscriptions.map(async (subscription) => {
            try {
              await webPush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: { p256dh: subscription.p256dh, auth: subscription.auth },
                },
                JSON.stringify({
                  type: notice.type,
                  ...(notice.routeNumber !== null && { routeNumber: notice.routeNumber }),
                }),
                { vapidDetails: config, timeout: 5000 },
              );
            } catch (error: unknown) {
              const result = z.object({ statusCode: z.number() }).safeParse(error);
              if (result.success && [404, 410].includes(result.data.statusCode)) {
                // Delete this exact subscription, not a newly registered replacement.
                await db
                  .delete(pushSubscriptions)
                  .where(
                    and(
                      eq(pushSubscriptions.id, subscription.id),
                      eq(pushSubscriptions.p256dh, subscription.p256dh),
                      eq(pushSubscriptions.auth, subscription.auth),
                    ),
                  );
              } else logger.warn("phone notification unavailable; in-app notice retained");
            }
          }),
        );
      }),
    );
  } catch {
    // No endpoint, keys, response body or personal data enters logs (Constitution IX).
    logger.warn("phone notification unavailable; in-app notice retained");
  }
}
