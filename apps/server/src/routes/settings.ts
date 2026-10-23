import { Hono } from "hono";
import { companySettingsInput, type CompanySettings } from "@domy/domain";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../app.ts";
import type { Executor } from "../db/client.ts";
import { companySettings, companySettingsId, neighborhoods } from "../db/schema/index.ts";
import { requireRole } from "../lib/auth-guard.ts";
import { auditedChange, diffValues } from "../lib/master-data.ts";
import { AppError } from "../lib/errors.ts";
import { validate } from "../lib/validate.ts";

/**
 * The company's office and support settings (features 003 and 004), changed by the owner only.
 */
async function loadSettings(db: Executor): Promise<CompanySettings> {
  const [row] = await db
    .select({
      officeAddress: companySettings.officeAddress,
      neighborhoodId: neighborhoods.id,
      neighborhoodName: neighborhoods.name,
      supportPhone: companySettings.supportPhone,
      companyName: companySettings.companyName,
    })
    .from(companySettings)
    .leftJoin(neighborhoods, eq(neighborhoods.id, companySettings.officeNeighborhoodId));
  return {
    officeAddress: row?.officeAddress ?? null,
    officeNeighborhood:
      row?.neighborhoodId && row.neighborhoodName
        ? { id: row.neighborhoodId, name: row.neighborhoodName }
        : null,
    supportPhone: row?.supportPhone ?? null,
    companyName: row?.companyName ?? "Cohex",
  };
}

export const settingsRoutes = new Hono<AppEnv>()
  .use(requireRole("owner", "dispatcher"))
  .get("/", async (c) => c.json(await loadSettings(c.get("db"))))
  .patch("/", requireRole("owner"), validate("json", companySettingsInput), async (c) => {
    const { actionId, ...input } = c.req.valid("json");
    await auditedChange(
      c,
      { type: "company_settings", id: companySettingsId, actionId },
      async (tx) => {
        if (input.officeNeighborhoodId !== undefined) {
          const [hood] = await tx
            .select({ id: neighborhoods.id })
            .from(neighborhoods)
            .where(eq(neighborhoods.id, input.officeNeighborhoodId));
          if (!hood)
            throw new AppError("invalid_request", {
              fields: { officeNeighborhoodId: "Elige un barrio de la lista." },
            });
        }
        await tx.insert(companySettings).values({}).onConflictDoNothing();
        const [before] = await tx
          .select()
          .from(companySettings)
          .where(eq(companySettings.id, companySettingsId))
          .for("update");
        if (!before) throw new Error("The settings singleton was not created");
        const changes = diffValues(before, input);
        if (Object.keys(changes).length === 0) return null;
        await tx
          .update(companySettings)
          .set({ ...input, updatedAt: c.get("clock")() })
          .where(eq(companySettings.id, companySettingsId));
        return changes;
      },
    );
    return c.json(await loadSettings(c.get("db")));
  });
