import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { rateZones } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";

export const rateZoneRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select({ id: rateZones.id, name: rateZones.name, isActive: rateZones.isActive })
      .from(rateZones)
      .orderBy(rateZones.name);
    return c.json({ items: rows });
  });
