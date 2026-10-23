import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono().get("/hold", async (c) => {
  process.stdout.write("HOLD_STARTED\n");
  await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
  return c.text("finished");
});

// Node ignores listener return values; the Hono listener handles asynchronous requests.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(getRequestListener(app.fetch));
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback listener");
  process.stdout.write(`LISTENING:${String(address.port)}\n`);
});
