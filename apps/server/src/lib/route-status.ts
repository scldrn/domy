import { isRouteFinished } from "@domy/domain";
import { and, eq, or, sql } from "drizzle-orm";
import type { Executor } from "../db/client.ts";
import { handovers, routes } from "../db/schema/index.ts";
import { loadPlan, loadRouteRow, recordRouteEvents } from "./route-store.ts";

/**
 * The automatic finish (FR-012, research R9): a route in progress becomes "Finalizada" when it
 * has no pending task and no pending handover, never by the clock. Every transaction that
 * changes a task calls it, with the author of that change; a finished route never reopens.
 * Returns whether the route finished now.
 */
export async function refreshRouteStatus(
  tx: Executor,
  routeId: string,
  by: { actorUserId: string; now: Date; onBehalf?: boolean },
): Promise<boolean> {
  const route = await loadRouteRow(tx, routeId);
  if (route.status !== "in_progress") return false;
  const [pending] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(handovers)
    .where(
      and(
        eq(handovers.status, "pending"),
        or(eq(handovers.fromRouteId, routeId), eq(handovers.toRouteId, routeId)),
      ),
    );
  if (!isRouteFinished(await loadPlan(tx, routeId), pending?.count ?? 0)) return false;
  await tx
    .update(routes)
    .set({
      status: "finished",
      finishedAt: by.now,
      version: sql`${routes.version} + 1`,
      updatedAt: by.now,
    })
    .where(eq(routes.id, routeId));
  await recordRouteEvents(tx, [
    {
      routeId,
      type: "finished",
      actorUserId: by.actorUserId,
      occurredAt: by.now,
      onBehalf: by.onBehalf ?? false,
    },
  ]);
  return true;
}
