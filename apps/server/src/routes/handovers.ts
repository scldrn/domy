import { handoverActionInput, type Handover } from "@domy/domain";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { handovers } from "../db/schema/index.ts";
import { findRouteAction } from "../lib/action-id.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { AppError } from "../lib/errors.ts";
import { cancelHandover, confirmHandover } from "../lib/reassignment.ts";
import { loadHandovers } from "../lib/route-store.ts";
import { isUniqueViolation, validate } from "../lib/validate.ts";

const idParam = z.object({ id: z.uuid() });

async function loadHandover(db: Executor, id: string): Promise<Handover> {
  const [handover] = await loadHandovers(db, eq(handovers.id, id));
  if (!handover) throw new AppError("not_found", { message: "No encontramos ese traspaso." });
  return handover;
}

/** Resolves a handover exactly once (FR-020); the action identifier lives on its route event. */
async function resolve(
  c: Context<AppEnv>,
  id: string,
  actionId: string,
  apply: typeof confirmHandover,
) {
  const db = c.get("db");
  if (!(await findRouteAction(db, actionId))) {
    const by = {
      actorUserId: c.get("user").id,
      now: c.get("clock")(),
      actionId,
      noticeIds: c.get("noticeIds"),
    };
    await db
      .transaction((tx) => apply(tx, id, by))
      .catch((error: unknown) => {
        if (isUniqueViolation(error, "route_events_client_event_id_key")) return;
        throw error;
      });
  }
  return c.json(await loadHandover(db, id));
}

/**
 * Handovers of picked-up packages between couriers (FR-025). The owner and the dispatcher
 * confirm one on the receiving courier's behalf or cancel it; the courier's own confirmation
 * is feature 003.
 */
export const handoverRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .post("/:id/confirm", validate("param", idParam), validate("json", handoverActionInput), (c) =>
    resolve(c, c.req.valid("param").id, c.req.valid("json").actionId, confirmHandover),
  )
  .post("/:id/cancel", validate("param", idParam), validate("json", handoverActionInput), (c) =>
    resolve(c, c.req.valid("param").id, c.req.valid("json").actionId, cancelHandover),
  );
