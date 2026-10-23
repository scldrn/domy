import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

type ChildExit = { code: number | null; signal: NodeJS.Signals | null };
type ObservedChild = {
  listening: Promise<number>;
  holdStarted: Promise<void>;
  lingeringStarted: Promise<void>;
  draining: Promise<void>;
  exited: Promise<ChildExit>;
  getErrorOutput: () => string;
};

let database: TestDatabase;
const childFile = fileURLToPath(new URL("./fixtures/runtime-lifecycle/child.ts", import.meta.url));
const defaultChildFile = fileURLToPath(
  new URL("./fixtures/runtime-lifecycle/default-child.ts", import.meta.url),
);

function waitBounded<Result>(promise: Promise<Result>, timeoutMs: number, label: string) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(label));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function observeChild(child: ChildProcess): ObservedChild {
  let output = "";
  let errorOutput = "";
  let resolveListening: ((port: number) => void) | undefined;
  let rejectListening: ((error: Error) => void) | undefined;
  let resolveHoldStarted: (() => void) | undefined;
  let resolveLingeringStarted: (() => void) | undefined;
  let resolveDraining: (() => void) | undefined;

  const listening = new Promise<number>((resolve, reject) => {
    resolveListening = resolve;
    rejectListening = reject;
  });
  const holdStarted = new Promise<void>((resolve) => {
    resolveHoldStarted = resolve;
  });
  const lingeringStarted = new Promise<void>((resolve) => {
    resolveLingeringStarted = resolve;
  });
  const draining = new Promise<void>((resolve) => {
    resolveDraining = resolve;
  });
  const exited = new Promise<ChildExit>((resolve) => {
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });

  if (!child.stdout || !child.stderr) throw new Error("Child output pipes are required");
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
    for (const line of output.split(/\r?\n/u)) {
      if (line === "HOLD_STARTED") resolveHoldStarted?.();
      if (line === "LINGERING_STARTED") resolveLingeringStarted?.();
      if (line === "DRAINING") resolveDraining?.();
      const port = /^LISTENING:(\d+)$/u.exec(line)?.[1];
      if (port) resolveListening?.(Number(port));
    }
  });
  child.stderr.on("data", (chunk: string) => {
    errorOutput += chunk;
  });
  child.once("error", (error) => rejectListening?.(error));
  child.once("exit", (code, signal) => {
    if (code !== 0 || signal !== null) {
      rejectListening?.(new Error(`Lifecycle child exited (${String(code)}, ${String(signal)})`));
    }
  });

  return {
    listening,
    holdStarted,
    lingeringStarted,
    draining,
    exited,
    getErrorOutput: () => errorOutput,
  };
}

async function stopChild(child: ChildProcess, exited: Promise<ChildExit>): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await waitBounded(exited, 1_500, "Child process did not exit during bounded cleanup");
}

async function expectNewConnectionRefused(port: number): Promise<void> {
  const outcome = new Promise<"refused" | "accepted">((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve("accepted");
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve("refused");
      else reject(error);
    });
  });
  expect(await waitBounded(outcome, 1_500, "New TCP connection did not settle")).toBe("refused");
}

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database.stop();
});

describe("native SIGTERM lifecycle", () => {
  it("shows that Node's default SIGTERM interrupts an active request without a handler", async () => {
    const child = spawn(process.execPath, [defaultChildFile], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const observed = observeChild(child);

    try {
      const port = await waitBounded(observed.listening, 5_000, "Default child did not listen");
      const responseOutcome = fetch(`http://127.0.0.1:${String(port)}/hold`, {
        signal: AbortSignal.timeout(5_000),
      }).then(
        () => "completed" as const,
        () => "interrupted" as const,
      );
      await waitBounded(observed.holdStarted, 2_000, "Default child did not start the request");
      child.kill("SIGTERM");

      expect(await waitBounded(responseOutcome, 2_000, "Default request did not settle")).toBe(
        "interrupted",
      );
      expect(await waitBounded(observed.exited, 1_500, "Default child did not exit")).toEqual({
        code: null,
        signal: "SIGTERM",
      });
    } finally {
      await stopChild(child, observed.exited);
    }
  }, 10_000);

  it("drains an active request, tolerates repeated SIGTERM, and closes PostgreSQL", async () => {
    const child = spawn(process.execPath, [childFile], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: database.url },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const observed = observeChild(child);

    try {
      const port = await waitBounded(observed.listening, 5_000, "Lifecycle child did not listen");
      const responsePromise = fetch(`http://127.0.0.1:${String(port)}/hold`, {
        signal: AbortSignal.timeout(5_000),
      });
      await waitBounded(observed.holdStarted, 2_000, "Lifecycle child did not start the request");
      const shutdownStarted = performance.now();
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGTERM"), 25);

      const response = await waitBounded(responsePromise, 3_000, "Active request did not drain");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("finished");
      expect(await waitBounded(observed.exited, 9_000, "Lifecycle child did not exit")).toEqual({
        code: 0,
        signal: null,
      });
      expect(performance.now() - shutdownStarted).toBeLessThan(9_500);
      expect(observed.getErrorOutput()).not.toMatch(/password|postgres:\/\/|DATABASE_URL/iu);
    } finally {
      await stopChild(child, observed.exited);
    }
  }, 15_000);

  it("refuses new connections and force-closes a request that exceeds the drain deadline", async () => {
    const child = spawn(process.execPath, [childFile], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: database.url },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const observed = observeChild(child);

    try {
      const port = await waitBounded(observed.listening, 5_000, "Lifecycle child did not listen");
      const responseOutcome = fetch(`http://127.0.0.1:${String(port)}/linger`, {
        signal: AbortSignal.timeout(9_500),
      }).then(
        () => "completed" as const,
        () => "interrupted" as const,
      );
      await waitBounded(observed.lingeringStarted, 2_000, "Lingering route did not start");
      const shutdownStarted = performance.now();
      child.kill("SIGTERM");
      await waitBounded(observed.draining, 1_500, "Child did not announce drain");
      await expectNewConnectionRefused(port);

      expect(
        await waitBounded(responseOutcome, 8_500, "Lingering request was not force-closed"),
      ).toBe("interrupted");
      expect(await waitBounded(observed.exited, 1_500, "Forced-close child did not exit")).toEqual({
        code: 0,
        signal: null,
      });
      expect(performance.now() - shutdownStarted).toBeGreaterThanOrEqual(6_500);
      expect(performance.now() - shutdownStarted).toBeLessThan(9_500);
      expect(observed.getErrorOutput()).not.toMatch(/password|postgres:\/\/|DATABASE_URL/iu);
    } finally {
      await stopChild(child, observed.exited);
    }
  }, 16_000);
});
