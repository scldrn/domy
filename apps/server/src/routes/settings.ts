import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";

/**
 * The company's settings (feature 003, FR-041): the office address, read by the office and
 * changed by the owner only (tasks.md T057).
 */
export const settingsRoutes = new Hono<AppEnv>().use(requireRole("owner", "dispatcher"));
