import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

/**
 * Release review ROB-6: the real entry point (src/index.ts) drains on SIGINT as on SIGTERM, and
 * an unhandled rejection or uncaught exception is logged without its text and drains with exit
 * code 1 instead of dying mid-request or running on in an unknown state.
 */
let database: TestDatabase;
const preload = new URL("./fixtures/process-failures/preload.ts", import.meta.url).href;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address !== "string") resolve(address.port);
        else reject(new Error("Expected a TCP port"));
      });
    });
  });
}

type Started = {
  child: ChildProcess;
  port: number;
  output: () => string;
  exited: Promise<number | null>;
};

async function startEntryPoint(): Promise<Started> {
  const port = await freePort();
  const child = spawn(process.execPath, ["--import", preload, "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      PATH: process.env["PATH"],
      NODE_ENV: "test",
      DATABASE_URL: database.url,
      BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
      BETTER_AUTH_TELEMETRY: "false",
      APP_URL: "http://localhost:5173",
      EMAIL_FROM: "Domy <no-reply@example.com>",
      API_PORT: String(port),
      // A closed loopback port: the entry point's bucket check fails fast and touches nothing.
      S3_ENDPOINT: "http://127.0.0.1:9",
      S3_BUCKET: "domy-fotos",
      S3_ACCESS_KEY_ID: "domy",
      S3_SECRET_ACCESS_KEY: "domy-secreto",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => (output += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (output += chunk));
  const exited = new Promise<number | null>((resolve) => {
    child.once("close", (code) => {
      resolve(code);
    });
  });
  const deadline = Date.now() + 20_000;
  while (!output.includes("server listening")) {
    if (child.exitCode !== null) throw new Error(`Entry point exited early:\n${output}`);
    if (Date.now() > deadline) throw new Error(`Entry point did not listen:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const live = await fetch(`http://127.0.0.1:${String(port)}/health/live`);
  expect(live.status).toBe(200);
  return { child, port, output: () => output, exited };
}

async function exitCodeWithin(started: Started, ms: number): Promise<number | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      started.exited,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Entry point did not exit:\n${started.output()}`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (started.child.exitCode === null) started.child.kill("SIGKILL");
  }
}

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

describe("entry point process failures", () => {
  it("drains and exits cleanly on SIGINT", async () => {
    const started = await startEntryPoint();
    started.child.kill("SIGINT");
    expect(await exitCodeWithin(started, 12_000)).toBe(0);
  }, 40_000);

  it.each([
    ["SIGUSR2", "unhandled_rejection"],
    ["SIGHUP", "uncaught_exception"],
  ] as const)(
    "logs a redacted %s failure and drains with exit code 1",
    async (signal, kind) => {
      const started = await startEntryPoint();
      started.child.kill(signal);
      expect(await exitCodeWithin(started, 12_000)).toBe(1);
      const fatal = started
        .output()
        .split("\n")
        .find((line) => line.includes('"level":60'));
      expect(fatal).toBeDefined();
      expect(JSON.parse(fatal ?? "{}")).toMatchObject({
        kind,
        error: { type: "Error", message: "Unexpected application error." },
      });
      expect(started.output()).not.toContain("FATAL_MARKER");
      expect(started.output()).not.toContain("3001234567");
    },
    40_000,
  );
});
