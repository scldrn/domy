import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";

/** Handovers of picked-up packages between couriers (FR-025). */
export const handoverRoutes = new Hono<AppEnv>().use(requireRole("owner", "dispatcher"));
