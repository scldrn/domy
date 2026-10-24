import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import type { Db } from "../db/client.ts";
import type { RuntimeState } from "../lib/runtime-lifecycle.ts";

const READINESS_DECISION_TIMEOUT_MS = 1_000;

/**
 * Release review DEPLOY-3: the migrations this build ships, read once at startup from the
 * drizzle-kit journal next to the SQL files (the image copies apps/server/src whole).
 */
const shippedMigrations = z
  .object({ entries: z.array(z.object({ idx: z.number().int().nonnegative() })).min(1) })
  .parse(
    JSON.parse(
      readFileSync(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"),
    ),
  ).entries.length;

async function probeDatabase(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await tx.execute(sql`SET LOCAL statement_timeout = '750ms'`);
    // A database behind this build's schema is not ready (DEPLOY-3): run the migrate profile.
    const [row] = await tx.execute<{ applied: number }>(
      sql`SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations`,
    );
    if ((row?.applied ?? 0) < shippedMigrations) throw new Error("Pending migrations");
  });
}

function sharedReadinessProbe(db: Db, runtime: RuntimeState): Promise<void> {
  if (runtime.readinessProbe) return runtime.readinessProbe;

  const probe = probeDatabase(db);
  runtime.readinessProbe = probe;
  const clearProbe = (): void => {
    if (runtime.readinessProbe === probe) runtime.readinessProbe = undefined;
  };
  void probe.then(clearProbe, clearProbe);
  return probe;
}

type ReadinessDecision = "ready" | "failed" | "deadline";

async function decideReadiness(probe: Promise<void>): Promise<ReadinessDecision> {
  let deadlineTimer: NodeJS.Timeout | undefined;
  const deadline = new Promise<"deadline">((resolve) => {
    deadlineTimer = setTimeout(() => {
      resolve("deadline");
    }, READINESS_DECISION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      probe.then(
        () => "ready" as const,
        () => "failed" as const,
      ),
      deadline,
    ]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}

function healthResponse(
  c: Context<AppEnv>,
  status: "ok" | "ready" | "unavailable",
  statusCode: 200 | 503 = 200,
) {
  c.header("Cache-Control", "no-store");
  return c.json({ status }, statusCode);
}

export const healthRoutes = new Hono<AppEnv>()
  .get("/live", (c) => healthResponse(c, "ok"))
  .get("/ready", async (c) => {
    const runtime = c.get("runtime");
    if (runtime.draining) return healthResponse(c, "unavailable", 503);

    const result = await decideReadiness(sharedReadinessProbe(c.get("db"), runtime));
    // SIGTERM can change shared state while the database probe is awaited.
    if (c.get("runtime").draining || result !== "ready") {
      return healthResponse(c, "unavailable", 503);
    }
    return healthResponse(c, "ready");
  });
