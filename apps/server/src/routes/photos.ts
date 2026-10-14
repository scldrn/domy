import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";

/**
 * The courier's photos from the private bucket (feature 003, research R6, FR-036): the office
 * sees any of them, a courier only those of their own records (tasks.md T033).
 */
export const photoRoutes = new Hono<AppEnv>().use(requireRole("owner", "dispatcher", "courier"));
