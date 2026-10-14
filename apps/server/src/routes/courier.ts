import { Hono } from "hono";
import type { AppEnv } from "../app.ts";
import { requireRole } from "../lib/auth-guard.ts";

/**
 * The courier app's API (feature 003, contracts/http-api.md): the route snapshot, records,
 * photos, notices, and push subscriptions, for the signed-in courier only (FR-002). Each
 * endpoint arrives with its user story (tasks.md T032, T033, T066).
 */
export const courierAppRoutes = new Hono<AppEnv>().use(requireRole("courier"));
