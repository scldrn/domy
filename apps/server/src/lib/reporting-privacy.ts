import type { NodeOptions } from "@sentry/node";
import { errorForLog } from "./errors.ts";

const classes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
]);
const root = new URL("../../../../", import.meta.url);

/** FR-041/R14/T152: native SDK allowlist, independent of automatic HTTP enrichment. */
export const reportingPrivacy = {
  // Override SENTRY_TRACES_SAMPLE_RATE: this policy admits errors only.
  tracesSampleRate: 0,
  sendClientReports: false,
  maxBreadcrumbs: 0,
  includeServerName: false,
  integrations: (integrations) =>
    integrations.filter((integration) => integration.name !== "ProcessSession"),
  beforeBreadcrumb: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  beforeSend(event, hint) {
    // Attachments bypass event projection when the native client assembles its envelope.
    hint.attachments = [];
    const original = hint.originalException;
    const error = original instanceof Error ? original : new Error("Unexpected application error.");
    const diagnostic = errorForLog(error);
    let type = diagnostic.type;
    let message = diagnostic.message;
    let stack = diagnostic.stack;
    let name = "";
    let text = "";
    let originalStack = "";
    try {
      if (typeof error.name === "string") name = error.name;
      if (typeof error.message === "string") text = error.message;
      if (typeof error.stack === "string") originalStack = error.stack;
    } catch {
      // Native failures and mutable accessors retain only T153's safe fallback.
    }
    // T153's existing reporter sends an independent Error with fixed labels/messages.
    // These labels bound disclosure; they do not authenticate a mutable Error's provenance.
    const database = /^Database operation failed(?: \(SQLSTATE ([0-9A-Z]{5})\))?\.$/.exec(text);
    if (name === "DatabaseError" && database) {
      type = "DatabaseError";
      message = `Database operation failed${database[1] ? ` (SQLSTATE ${database[1]})` : ""}.`;
    } else if (text === "Unexpected application error." && classes.has(name)) {
      type = name;
    }
    // Revalidate project-relative locations from T153 using its existing filesystem bounds.
    const projected = new Error("Unexpected application error.");
    projected.stack = `Error\n${originalStack
      .slice(0, 65_536)
      .split("\n")
      .slice(1, 33)
      .map((line) => {
        const match =
          /^ {4}at source \(((?:apps\/server\/src|packages\/domain\/src)\/[a-zA-Z0-9_./-]+\.ts):(\d+):(\d+)\)$/.exec(
            line,
          );
        return match?.[1] && match[2]
          ? `    at ${new URL(match[1], root).href}:${match[2]}:${match[3] ?? ""}`
          : "";
      })
      .join("\n")}`;
    const revalidated = errorForLog(projected);
    if (revalidated.stack.includes("at source (")) stack = revalidated.stack;
    const frames = stack
      .split("\n")
      .slice(1)
      .flatMap((line) => {
        const match = /^ {4}at (source|reporting_site) \(([^()]+):(\d+):(\d+)\)$/.exec(line);
        return match?.[1] && match[2]
          ? [
              {
                filename: match[2],
                function: match[1],
                lineno: Number(match[3]),
                colno: Number(match[4]),
                in_app: true,
              },
            ]
          : [];
      })
      .reverse();
    return {
      type: undefined,
      // Caller-provided IDs/timestamps can themselves encode private data.
      event_id: crypto.randomUUID().replaceAll("-", ""),
      ...(event.environment &&
        ["test", "development", "production"].includes(event.environment) && {
          environment: event.environment,
        }),
      platform: "node",
      level: "error",
      exception: { values: [{ type, value: message, stacktrace: { frames } }] },
    };
  },
} satisfies NodeOptions;
