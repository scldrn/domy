import type { NoticeType } from "@domy/domain";
import type { Executor } from "../db/client.ts";
import { courierNotices } from "../db/schema/index.ts";

/** FR-027/R9: caller's transaction owns the notice; request-local ids are sent only after commit. */
export async function notifyCourier(
  tx: Executor,
  courierId: string | null,
  type: NoticeType,
  about: { routeId?: string | null; shipmentId?: string | null },
  now: Date,
  noticeIds?: string[],
): Promise<void> {
  if (!courierId) return;
  const [notice] = await tx
    .insert(courierNotices)
    .values({ courierId, type, ...about, createdAt: now })
    .returning({ id: courierNotices.id });
  if (notice) noticeIds?.push(notice.id);
}
