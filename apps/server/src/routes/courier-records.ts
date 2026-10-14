import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";

/**
 * The office's corrections and reverts of courier records (feature 003, FR-035); they arrive
 * with user story 6 (tasks.md T075).
 */
export const courierRecordRoutes = new Hono<AppEnv>().use(requireRole("owner", "dispatcher"));
