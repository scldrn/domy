import { normalizeText } from "@domy/domain";
import { and, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { carriers } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { validate } from "../lib/validate.ts";

const listQuery = z.object({
  q: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const carrierRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", validate("query", listQuery), async (c) => {
    const { q, active } = c.req.valid("query");
    const rows = await c
      .get("db")
      .select({ id: carriers.id, name: carriers.name, isActive: carriers.isActive })
      .from(carriers)
      .where(
        and(
          active ? eq(carriers.isActive, active === "true") : undefined,
          q ? ilike(carriers.nameNormalized, `%${normalizeText(q)}%`) : undefined,
        ),
      )
      .orderBy(carriers.nameNormalized);
    return c.json({ items: rows });
  });
