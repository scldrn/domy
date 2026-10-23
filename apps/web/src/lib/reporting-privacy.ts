import type { BrowserOptions } from "@sentry/react";

const bundleUrl = import.meta.url;

/** FR-041/R14/T152: native SDK hooks; no runtime context is an allowed diagnostic. */
export const reportingPrivacy = {
  tracesSampleRate: 0,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  integrations: (integrations) =>
    integrations.filter((integration) => integration.name !== "BrowserSession"),
  beforeBreadcrumb: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  beforeSend(event, hint) {
    hint.attachments = [];
    const error = hint.originalException;
    // Built-in instances, never mutable names, messages, cause chains or source text.
    const type =
      error instanceof TypeError
        ? "TypeError"
        : error instanceof RangeError
          ? "RangeError"
          : error instanceof SyntaxError
            ? "SyntaxError"
            : error instanceof ReferenceError
              ? "ReferenceError"
              : error instanceof URIError
                ? "URIError"
                : error instanceof EvalError
                  ? "EvalError"
                  : error instanceof AggregateError
                    ? "AggregateError"
                    : "Error";
    const frames =
      event.exception?.values
        ?.at(-1)
        ?.stacktrace?.frames?.slice(-32)
        .flatMap((frame) =>
          frame.filename === bundleUrl &&
          typeof frame.lineno === "number" &&
          typeof frame.colno === "number" &&
          Number.isSafeInteger(frame.lineno) &&
          Number.isSafeInteger(frame.colno) &&
          (frame.lineno ?? 0) > 0 &&
          (frame.lineno ?? 0) < 1_000_000 &&
          (frame.colno ?? 0) > 0 &&
          (frame.colno ?? 0) < 10_000_000
            ? [
                {
                  filename: "application.js",
                  function: "source",
                  lineno: frame.lineno,
                  colno: frame.colno,
                  in_app: true,
                },
              ]
            : [],
        ) ?? [];
    return {
      type: undefined,
      // Caller-provided IDs/timestamps can themselves encode private data.
      event_id: crypto.randomUUID().replaceAll("-", ""),
      ...(event.environment &&
        ["test", "development", "production"].includes(event.environment) && {
          environment: event.environment,
        }),
      platform: "javascript",
      level: "error",
      exception: {
        values: [
          {
            type,
            value: "Unexpected application error.",
            stacktrace: {
              frames: frames.length
                ? frames
                : [{ filename: "application", function: "reporting_site", in_app: true }],
            },
          },
        ],
      },
    };
  },
} satisfies BrowserOptions;
