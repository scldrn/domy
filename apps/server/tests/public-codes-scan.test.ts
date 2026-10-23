import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { merchants, shipments } from "../src/db/schema/index.ts";
import { PUBLIC_RATE_LIMIT_WINDOW_MS } from "../src/lib/rate-limit.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog } from "./setup/catalog.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { registerShipment } from "./setup/routes.ts";

const publicErrorSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }).strict(),
  })
  .strict();
const publicObjectSchema = z.record(z.string(), z.unknown());
const scanSize = 1_000;
const scanBatchSize = 25;
const expectedInvalidResponse = JSON.stringify({
  status: 404,
  contentType: "application/json",
  noStore: true,
  noIndex: true,
  error: { code: "link_not_found", message: "Este enlace no es válido" },
});

type PublicResponse = {
  status: number;
  cacheControl: string | null;
  robotsTag: string | null;
  contentType: string | null;
  body: unknown;
};

let database: TestDatabase;

beforeAll(async () => {
  database = await startDatabase();
}, 120_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.truncate();
});

async function withNativeServer<Result>(
  app: ReturnType<typeof createTestApp>["app"],
  action: (origin: string) => Promise<Result>,
): Promise<Result> {
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback listener");
    return await action(`http://127.0.0.1:${String(address.port)}`);
  } finally {
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}

function hasPublicHeaders(response: PublicResponse): boolean {
  const cacheControl = response.cacheControl?.toLowerCase() ?? "";
  const noStore = cacheControl.split(",").some((directive) => directive.trim() === "no-store");
  const noIndex = response.robotsTag?.toLowerCase().includes("noindex") ?? false;
  return noStore && noIndex;
}

function invalidResponseFingerprint(response: PublicResponse): string {
  const cacheControl = response.cacheControl?.toLowerCase() ?? "";
  const noStore = cacheControl.split(",").some((directive) => directive.trim() === "no-store");
  const noIndex = response.robotsTag?.toLowerCase().includes("noindex") ?? false;
  const contentType = response.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const parsed = publicErrorSchema.safeParse(response.body);
  const error = parsed.success ? parsed.data.error : null;
  const fingerprint = JSON.stringify({
    status: response.status,
    contentType,
    noStore,
    noIndex,
    error,
  });

  expect(
    fingerprint === expectedInvalidResponse,
    "unknown public codes must have one permitted invalid-link response",
  ).toBe(true);
  return fingerprint;
}

async function requestPublic(origin: string, path: string): Promise<PublicResponse> {
  const response = await fetch(`${origin}${path}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    robotsTag: response.headers.get("x-robots-tag"),
    contentType: response.headers.get("content-type"),
    body,
  };
}

async function assertLegitimateResponses(
  origin: string,
  fixture: { trackingCode: string; trackingNumber: string; merchantCode: string },
): Promise<void> {
  const tracking = await requestPublic(
    origin,
    `/api/public/tracking/${encodeURIComponent(fixture.trackingCode)}`,
  );
  const trackingBody = publicObjectSchema.safeParse(tracking.body);
  expect(
    tracking.status === 200 &&
      hasPublicHeaders(tracking) &&
      trackingBody.success &&
      trackingBody.data["trackingNumber"] === fixture.trackingNumber,
    "a real tracking code must continue to return its shipment guide",
  ).toBe(true);

  const merchant = await requestPublic(
    origin,
    `/api/public/merchant/${encodeURIComponent(fixture.merchantCode)}?date=2026-10-01`,
  );
  const merchantBody = publicObjectSchema.safeParse(merchant.body);
  const shipmentRows = merchantBody.success ? merchantBody.data["shipments"] : null;
  const containsFixtureShipment =
    Array.isArray(shipmentRows) &&
    shipmentRows.some((row) => {
      const parsed = publicObjectSchema.safeParse(row);
      return parsed.success && parsed.data["trackingNumber"] === fixture.trackingNumber;
    });
  expect(
    merchant.status === 200 &&
      hasPublicHeaders(merchant) &&
      merchantBody.success &&
      merchantBody.data["merchantName"] === "Bullish Hype" &&
      containsFixtureShipment,
    "a real merchant code must continue to return its shipment guide",
  ).toBe(true);
}

async function createLegitimateFixture(
  app: ReturnType<typeof createTestApp>,
): Promise<{ trackingCode: string; trackingNumber: string; merchantCode: string }> {
  const owner = await app.signIn("owner");
  const catalog = await createCatalog(database.db, owner.user.id);
  const dispatcher = await app.signIn("dispatcher");
  const shipment = await registerShipment(app, dispatcher.cookie, catalog, {
    serviceDate: "2026-10-01",
  });
  const [shipmentCodeRow] = await database.db
    .select({ code: shipments.trackingCode })
    .from(shipments)
    .where(eq(shipments.id, shipment.id))
    .limit(1);
  const [merchantCodeRow] = await database.db
    .select({ code: merchants.linkCode })
    .from(merchants)
    .where(eq(merchants.id, catalog.merchant.bullish))
    .limit(1);
  if (!shipmentCodeRow || !merchantCodeRow) {
    throw new Error("The legitimate public-code fixtures are missing");
  }
  return {
    trackingCode: shipmentCodeRow.code,
    trackingNumber: shipment.trackingNumber,
    merchantCode: merchantCodeRow.code,
  };
}

describe("004/T031 public random-code negative scan", () => {
  it("uniformly rejects 1,000 random unknown codes on tracking and merchant endpoints", async () => {
    let monotonicTime = 0;
    const app = createTestApp(database.db, {
      now: "2026-10-01T15:00:00Z",
      monotonicNow: () => monotonicTime,
    });
    const fixture = await createLegitimateFixture(app);
    const [shipmentCodeRows, merchantCodeRows] = await Promise.all([
      database.db.select({ code: shipments.trackingCode }).from(shipments).limit(1_000),
      database.db.select({ code: merchants.linkCode }).from(merchants).limit(1_000),
    ]);
    const issuedCodes = new Set([
      ...shipmentCodeRows.map((row) => row.code),
      ...merchantCodeRows.map((row) => row.code),
    ]);
    const samples = Array.from({ length: scanSize }, () => randomBytes(16).toString("base64url"));
    const samplesAreDistinctAndUnknown =
      new Set(samples).size === scanSize && samples.every((code) => !issuedCodes.has(code));
    expect(
      samplesAreDistinctAndUnknown,
      "scan samples must be distinct and absent from fixtures",
    ).toBe(true);

    await withNativeServer(app.app, async (origin) => {
      for (let batchStart = 0; batchStart < samples.length; batchStart += scanBatchSize) {
        if (batchStart > 0) monotonicTime += PUBLIC_RATE_LIMIT_WINDOW_MS;

        await assertLegitimateResponses(origin, fixture);
        const batchEnd = Math.min(batchStart + scanBatchSize, samples.length);
        for (const code of samples.slice(batchStart, batchEnd)) {
          const tracking = await requestPublic(origin, `/api/public/tracking/${code}`);
          const merchant = await requestPublic(
            origin,
            `/api/public/merchant/${code}?date=2026-10-01`,
          );
          const trackingFingerprint = invalidResponseFingerprint(tracking);
          const merchantFingerprint = invalidResponseFingerprint(merchant);
          expect(
            trackingFingerprint === merchantFingerprint,
            "tracking and merchant lookups must hide code existence in the same response",
          ).toBe(true);
        }
        await assertLegitimateResponses(origin, fixture);
      }
    });
  }, 240_000);

  it("retains the native 60-request limit and accepts the exact window reset", async () => {
    let monotonicTime = 0;
    const app = createTestApp(database.db, { monotonicNow: () => monotonicTime });
    const code = randomBytes(16).toString("base64url");

    await withNativeServer(app.app, async (origin) => {
      let firstSixtyAreAllowed = true;
      for (let attempt = 1; attempt <= 60; attempt++) {
        const response = await requestPublic(origin, `/api/public/tracking/${code}`);
        firstSixtyAreAllowed =
          firstSixtyAreAllowed &&
          response.status === 404 &&
          hasPublicHeaders(response) &&
          publicErrorSchema.safeParse(response.body).success;
      }
      expect(firstSixtyAreAllowed, "the first 60 requests must reach the lookup endpoint").toBe(
        true,
      );

      const refused = await requestPublic(origin, `/api/public/tracking/${code}`);
      const refusedBody = publicErrorSchema.safeParse(refused.body);
      const isRateLimited =
        refused.status === 429 &&
        hasPublicHeaders(refused) &&
        refusedBody.success &&
        refusedBody.data.error.code === "rate_limited" &&
        /solicitudes|minuto|intenta|espera/iu.test(refusedBody.data.error.message);
      expect(isRateLimited, "the 61st request must receive the Spanish rate-limit response").toBe(
        true,
      );

      monotonicTime += PUBLIC_RATE_LIMIT_WINDOW_MS;
      const reset = await requestPublic(origin, `/api/public/tracking/${code}`);
      invalidResponseFingerprint(reset);
    });
  });
});
