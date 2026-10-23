/** T132: native import-time production checks in an isolated process, sharing only a test DB. */
import { Writable } from "node:stream";
import { inspect } from "node:util";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { createDb } from "../../src/db/client.ts";
import { createLogger } from "../../src/lib/logger.ts";
import { createTestApp } from "./app.ts";

process.stdin.setEncoding("utf8");
let raw = "";
for await (const chunk of process.stdin) {
  const value: unknown = chunk;
  if (typeof value !== "string") throw new Error("Invalid production probe input");
  raw += value;
}
const input = z
  .object({
    url: z.string(),
    cookie: z.string(),
    actorId: z.uuid(),
    userId: z.uuid(),
    sentinel: z.string(),
  })
  .parse(JSON.parse(raw) as unknown);
const db = createDb(input.url);
let captured = "";
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    captured += chunk.toString();
    done();
  },
});
const capture = (...values: unknown[]) => {
  captured += inspect(values);
};
const original = { error: console.error, info: console.info, warn: console.warn, log: console.log };
console.error = capture;
console.info = capture;
console.warn = capture;
console.log = capture;
try {
  const t = createTestApp(db, { logger: createLogger("debug", sink) });
  const intent = crypto.randomUUID();
  const request = (actionId: string, headers: Record<string, string>) =>
    t.app.request(
      new Request("http://localhost:3000/api/auth/admin/ban-user", {
        method: "POST",
        headers: {
          cookie: input.cookie,
          "content-type": "application/json",
          "X-Domy-Actor-Id": input.actorId,
          ...headers,
        },
        body: JSON.stringify({ actionId, userId: input.userId }),
      }),
    );
  const initial = await request(intent, { origin: "http://localhost:3000" });
  const before = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from account_action_receipts`,
  );
  const statuses: number[] = [];
  for (const actionId of [crypto.randomUUID(), intent]) {
    for (const headers of [
      { origin: `https://untrusted.example/?private=${input.sentinel}` },
      {},
      { referer: `https://untrusted.example/?private=${input.sentinel}` },
    ])
      statuses.push((await request(actionId, headers)).status);
  }
  const after = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from account_action_receipts`,
  );
  process.stdout.write(
    JSON.stringify({
      initial: initial.status,
      statuses,
      noReceiptConsumed: before[0]?.count === after[0]?.count,
      diagnosticRetained: captured.includes("Authentication diagnostic."),
      secretLeaked: captured.includes(input.sentinel),
    }),
  );
} finally {
  Object.assign(console, original);
  await db.$client.end();
}
