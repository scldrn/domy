import * as Sentry from "@sentry/node";
import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { setErrorReporter } from "../src/lib/errors.ts";
import { reportingPrivacy } from "../src/lib/reporting-privacy.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  setErrorReporter(null);
  await Sentry.close();
  await database.stop();
});
afterEach(async () => {
  setErrorReporter(null);
  await Sentry.close();
  vi.restoreAllMocks();
});

it("does not report native server spans or warn about ignored hooks", async () => {
  const marker = crypto.randomUUID();
  const envelopes: unknown[] = [];
  const warning = vi.spyOn(console, "warn");
  Sentry.init({
    ...reportingPrivacy,
    dsn: "http://public@127.0.0.1:1/1",
    transport: () => ({
      send: (envelope) => {
        envelopes.push(envelope);
        return Promise.resolve({ statusCode: 200 });
      },
      flush: () => Promise.resolve(true),
    }),
  });
  Sentry.startSpan({ name: marker }, () => {
    Sentry.captureException(new TypeError("ordinary failure"));
  });
  expect(await Sentry.flush(5000)).toBe(true);
  expect(envelopes).toHaveLength(1);
  const output = JSON.stringify(envelopes);
  expect(output.includes('"type":"event"')).toBe(true);
  expect(output.includes('"type":"span"')).toBe(false);
  expect(output.includes('"type":"transaction"')).toBe(false);
  expect(output.includes("TypeError")).toBe(true);
  expect(output.includes("Unexpected application error.")).toBe(true);
  expect(output.includes(marker), "the complete server envelope must omit span names").toBe(false);
  expect(warning).not.toHaveBeenCalledWith(
    expect.stringContaining("`beforeSendTransaction` and `ignoreTransactions` are ignored"),
  );
  const options = Sentry.getClient()?.getOptions();
  expect(options?.tracesSampleRate).toBe(0);
  expect(options ? Object.hasOwn(options, "beforeSendTransaction") : false).toBe(false);
});

it("keeps raw exceptions, scope attachments and event metadata inside the native boundary", async () => {
  const envelopes: unknown[] = [];
  const marker = crypto.randomUUID().replaceAll("-", "");
  const privateTimestamp = 1_000_000_000 + Number.parseInt(marker.slice(0, 7), 16);
  Sentry.init({
    ...reportingPrivacy,
    dsn: "http://public@127.0.0.1:1/1",
    transport: () => ({
      send: (envelope) => {
        envelopes.push(envelope);
        return Promise.resolve({ statusCode: 200 });
      },
      flush: () => Promise.resolve(true),
    }),
  });
  Sentry.withScope((scope) => {
    scope.addAttachment({ filename: marker, data: marker });
    scope.setTransactionName(`/rastrear/${marker}`);
    const error = new TypeError(marker, { cause: new Error(marker) });
    error.name = marker;
    error.stack = `${marker}\n    at private (https://example.test/${marker}:1:1)`;
    Sentry.captureEvent(
      {
        event_id: marker,
        timestamp: privateTimestamp,
        message: marker,
        request: {
          url: `/api/auth/reset-password/${marker}`,
          query_string: marker,
          headers: { authorization: marker },
          data: marker,
        },
        contexts: { private: { marker } },
        extra: { marker },
        logentry: { message: marker },
        fingerprint: [marker],
      },
      { originalException: error },
    );
  });
  expect(await Sentry.flush(5000)).toBe(true);
  expect(envelopes).toHaveLength(1);
  const output = JSON.stringify(envelopes);
  expect(output.includes('"type":"event"')).toBe(true);
  expect(output.includes("TypeError")).toBe(true);
  expect(output.includes("reporting_site")).toBe(true);
  expect(output.includes(String(privateTimestamp))).toBe(false);
  expect(/"event_id":"[a-f0-9]{32}"/.test(output)).toBe(true);
  expect(output.includes(marker), "no raw error, attachment or automatic context may survive").toBe(
    false,
  );
  expect(
    Sentry.getClient()
      ?.getOptions()
      .integrations.some((integration) => integration.name === "ProcessSession"),
  ).toBe(false);
});

it("does not send anything when the native reporter has no DSN", async () => {
  let deliveries = 0;
  Sentry.init({
    ...reportingPrivacy,
    dsn: undefined,
    transport: () => ({
      send: () => {
        deliveries++;
        return Promise.resolve({ statusCode: 200 });
      },
      flush: () => Promise.resolve(true),
    }),
  });
  Sentry.captureException(new TypeError("ordinary failure"));
  await Sentry.flush(5000);
  expect(deliveries).toBe(0);
});

it("keeps reporting-site fallback distinct from a validated original source", () => {
  const location = "apps/server/src/lib/errors.ts:1:1";
  for (const kind of ["source", "reporting_site"] as const) {
    const error = new Error("Unexpected application error.");
    error.name = "RangeError";
    error.stack = `RangeError: Unexpected application error.\n    at ${kind} (${location})`;
    const output = JSON.stringify(
      reportingPrivacy.beforeSend({ type: undefined }, { originalException: error }),
    );
    expect(output.includes("RangeError")).toBe(true);
    expect(output.includes(`"function":"${kind}"`)).toBe(true);
    expect(output.includes(`"function":"${kind === "source" ? "reporting_site" : "source"}"`)).toBe(
      false,
    );
  }
});

it("delivers useful native error envelopes without HTTP, SQL or scope data (FR-041/T152)", async () => {
  const envelopes: unknown[] = [];
  const marker = crypto.randomUUID();
  Sentry.init({
    ...reportingPrivacy,
    dsn: "http://public@127.0.0.1:1/1",
    environment: "test",
    transport: () => ({
      send: (envelope) => {
        envelopes.push(envelope);
        return Promise.resolve({ statusCode: 200 });
      },
      flush: () => Promise.resolve(true),
    }),
  });
  setErrorReporter((error) => Sentry.captureException(error));
  const t = createTestApp(database.db);
  t.app.post("/api/test/t152/:token", async (c) => {
    Sentry.setUser({ email: `${marker}@example.test` });
    Sentry.setContext("private", { marker });
    Sentry.setTag("private", marker);
    Sentry.addBreadcrumb({ message: marker, data: { url: c.req.url } });
    await database.db.execute(sql`select ${marker}::integer`);
    return c.json({ unreachable: true });
  });
  const server = serve({ fetch: t.app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback listener");
    const response = await fetch(
      `http://127.0.0.1:${String(address.port)}/api/test/t152/${marker}?phone=${marker}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${marker}` },
        body: JSON.stringify({ recipient: marker }),
      },
    );
    expect(response.status).toBe(500);
    expect((await response.text()).includes(marker)).toBe(false);
    expect(await Sentry.flush(5000)).toBe(true);
    const output = JSON.stringify(envelopes);
    expect(output.includes('"type":"event"'), "an error, not just a session, must arrive").toBe(
      true,
    );
    expect(output.includes("DatabaseError")).toBe(true);
    expect(output.includes("22P02")).toBe(true);
    expect(output.includes("apps/server/src/")).toBe(true);
    expect(output.includes(marker), "the complete native envelope must omit private values").toBe(
      false,
    );
  } finally {
    setErrorReporter(null);
    await Sentry.close();
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
});
