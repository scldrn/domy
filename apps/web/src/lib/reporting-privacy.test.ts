import * as Sentry from "@sentry/react";
import { afterEach, expect, it, vi } from "vitest";
import { reportingPrivacy } from "./reporting-privacy";

afterEach(async () => {
  await Sentry.close();
  vi.restoreAllMocks();
});

it("does not report native browser spans or warn about ignored hooks", async () => {
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
  expect(output.includes(marker), "the complete browser envelope must omit span names").toBe(false);
  expect(warning).not.toHaveBeenCalledWith(
    expect.stringContaining("`beforeSendTransaction` and `ignoreTransactions` are ignored"),
  );
  const options = Sentry.getClient()?.getOptions();
  expect(options?.tracesSampleRate).toBe(0);
  expect(options ? Object.hasOwn(options, "beforeSendTransaction") : false).toBe(false);
});

it("delivers native browser errors without arbitrary message, cause, URLs or scope (FR-041/T152)", async () => {
  const marker = crypto.randomUUID();
  const envelopes: unknown[] = [];
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
  Sentry.withScope((scope) => {
    scope.addAttachment({ filename: marker, data: marker });
    scope.setTransactionName(`/api/auth/reset-password/${marker}`);
    scope.setUser({ email: `${marker}@example.test` });
    scope.setContext("private", { marker });
    scope.setTag("private", marker);
    scope.addBreadcrumb({ message: marker, data: { url: `/rastrear/${marker}` } });
    const error = new TypeError(marker, { cause: new Error(marker) });
    error.stack = `TypeError: ${marker}\n    at private (https://example.test/assets/private.js?token=${marker}:5:9)`;
    Sentry.captureException(error);
  });
  expect(await Sentry.flush(5000)).toBe(true);
  const output = JSON.stringify(envelopes);
  expect(output.includes('"type":"event"'), "an actual error envelope must arrive").toBe(true);
  expect(output.includes("TypeError")).toBe(true);
  expect(output.includes(marker), "the complete browser envelope must omit private values").toBe(
    false,
  );
  expect(envelopes).toHaveLength(1);
  expect(output.includes("reporting_site")).toBe(true);
  expect(
    Sentry.getClient()
      ?.getOptions()
      .integrations.some((integration) => integration.name === "BrowserSession"),
  ).toBe(false);
});

it("retains only exact artifact source positions and native classes from enriched events", async () => {
  const marker = crypto.randomUUID().replaceAll("-", "");
  const privateTimestamp = 1_000_000_000 + Number.parseInt(marker.slice(0, 7), 16);
  const envelopes: unknown[] = [];
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
  const error = new RangeError(marker, { cause: new Error(marker) });
  error.name = marker;
  Sentry.captureEvent(
    {
      event_id: marker,
      timestamp: privateTimestamp,
      message: marker,
      request: {
        url: `/rastrear/${marker}`,
        query_string: marker,
        headers: { cookie: marker },
        data: marker,
      },
      contexts: { private: { marker } },
      extra: { marker },
      exception: {
        values: [
          {
            type: marker,
            value: marker,
            stacktrace: {
              frames: [
                {
                  filename: new URL("./reporting-privacy.ts", import.meta.url).href,
                  function: marker,
                  lineno: 1,
                  colno: 1,
                  vars: { marker },
                },
                { filename: `https://example.test/assets/${marker}.js`, lineno: 1, colno: 1 },
              ],
            },
          },
        ],
      },
    },
    { originalException: error },
  );
  expect(await Sentry.flush(5000)).toBe(true);
  expect(envelopes).toHaveLength(1);
  const output = JSON.stringify(envelopes);
  expect(output.includes("RangeError")).toBe(true);
  expect(output.includes(String(privateTimestamp))).toBe(false);
  expect(/"event_id":"[a-f0-9]{32}"/.test(output)).toBe(true);
  expect(output.includes("application.js")).toBe(true);
  expect(output.includes('"function":"source"')).toBe(true);
  expect(
    output.includes(marker),
    "only static diagnostics and artifact positions may survive",
  ).toBe(false);
});

it("does not deliver native browser events without a DSN", async () => {
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
