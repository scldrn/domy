import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../../../src/db/client.ts";
import { createLogger } from "../../../src/lib/logger.ts";
import { registerGracefulShutdown } from "../../../src/lib/runtime-lifecycle.ts";
import type { RuntimeState } from "../../../src/lib/runtime-lifecycle.ts";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is required for the lifecycle test child");

const db = createDb(databaseUrl);
const logger = createLogger("silent");
const runtime: RuntimeState = { draining: false, readinessProbe: undefined };
const app = new Hono();
app.get("/hold", async (c) => {
  process.stdout.write("HOLD_STARTED\n");
  await db.execute(sql`select pg_sleep(0.15)`);
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  return c.text("finished");
});
app.get("/linger", async (c) => {
  await db.execute(sql`select pg_sleep(0.15)`);
  process.stdout.write("LINGERING_STARTED\n");
  await new Promise<void>(() => {});
  return c.text("unreachable");
});

// Node ignores listener return values; the Hono listener handles asynchronous requests.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(getRequestListener(app.fetch));
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback listener");
  process.stdout.write(`LISTENING:${String(address.port)}\n`);
});
registerGracefulShutdown({ server, db, runtime, logger });
process.on("SIGTERM", () => process.stdout.write("DRAINING\n"));
