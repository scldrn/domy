import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { build, preview, type PreviewServer } from "vite";
import { test, expect } from "@playwright/test";
import { accessibilityViolations } from "./fixtures";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const envelopes: string[] = [];
let intake: Server;
const previews: PreviewServer[] = [];
const origins: string[] = [];

test.beforeAll(async () => {
  test.setTimeout(120_000);
  intake = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      if (body) envelopes.push(body);
      response.writeHead(200, { "access-control-allow-origin": "*" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => intake.listen(0, "127.0.0.1", resolve));
  const address = intake.address();
  if (!address || typeof address === "string") throw new Error("Missing loopback intake");
  const dsn = `http://public@127.0.0.1:${String(address.port)}/1`;
  for (const [index, enabled] of [true, false].entries()) {
    const outDir = `${webRoot}test-results/reporting-privacy-${String(index)}/dist`;
    await build({
      root: webRoot,
      envDir: false,
      logLevel: "error",
      define: { "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(enabled ? dsn : "") },
      build: { outDir, emptyOutDir: true },
    });
    const server = await preview({
      root: webRoot,
      envDir: false,
      logLevel: "error",
      build: { outDir },
      preview: { host: "127.0.0.1", port: 0 },
    });
    previews.push(server);
    const listener = server.httpServer.address();
    if (!listener || typeof listener === "string") throw new Error("Missing compiled preview");
    origins.push(`http://127.0.0.1:${String(listener.port)}`);
  }
});

test.afterAll(async () => {
  for (const server of previews) {
    if ("closeAllConnections" in server.httpServer) server.httpServer.closeAllConnections();
    await new Promise<void>((resolve) =>
      server.httpServer.close(() => {
        resolve();
      }),
    );
  }
  {
    intake.closeAllConnections();
    await new Promise<void>((resolve) =>
      intake.close(() => {
        resolve();
      }),
    );
  }
});

for (const [index, enabled] of [true, false].entries()) {
  test(`compiled lazy browser reporter ${enabled ? "enabled and private" : "disabled"} (T152)`, async ({
    page,
  }) => {
    const marker = crypto.randomUUID();
    const receivedBefore = envelopes.length;
    await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
    await page.goto(`${origins[index] ?? ""}/ingresar?phone=${marker}`);
    await page.waitForLoadState("networkidle");
    await page.evaluate((secret) => {
      history.replaceState({}, "", `/api/auth/reset-password/${secret}?phone=${secret}`);
      window.setTimeout(() => {
        throw new TypeError(secret, { cause: new Error(secret) });
      }, 0);
    }, marker);
    if (enabled) {
      await expect
        .poll(() => envelopes.slice(receivedBefore).some((body) => body.includes('"type":"event"')))
        .toBe(true);
      const output = envelopes.slice(receivedBefore).join("\n");
      expect(output.includes("TypeError")).toBe(true);
      expect(
        output.includes(marker),
        "whole compiled browser envelopes must omit private values",
      ).toBe(false);
    } else {
      // Native dispatch and all resource requests must settle; no lazy SDK or intake allowed.
      await page.waitForLoadState("networkidle");
      expect(envelopes.length).toBe(receivedBefore);
    }
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
