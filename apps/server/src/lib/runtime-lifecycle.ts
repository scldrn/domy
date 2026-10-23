import type { Server } from "node:http";
import type { Logger } from "pino";
import type { Db } from "../db/client.ts";
import { errorForLog } from "./errors.ts";

const HTTP_DRAIN_TIMEOUT_MS = 7_000;

export type RuntimeState = {
  draining: boolean;
  readinessProbe: Promise<void> | undefined;
};

function recordShutdownFailure(logger: Logger, stage: string, error: unknown): void {
  process.exitCode = 1;
  logger.error(
    {
      stage,
      outcome: "failed",
      error:
        error instanceof Error
          ? errorForLog(error)
          : { type: "Error", message: "Unexpected application error." },
    },
    "graceful shutdown stage failed",
  );
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function registerGracefulShutdown(options: {
  server: Server;
  db: Db;
  runtime: RuntimeState;
  logger: Logger;
}): void {
  const { server, db, runtime, logger } = options;
  let shutdownPromise: Promise<void> | undefined;

  const shutdownOnce = (): void => {
    runtime.draining = true;
    if (shutdownPromise) return;

    shutdownPromise = (async () => {
      let closePromise: Promise<void> | undefined;
      try {
        closePromise = closeHttpServer(server);
        let drainTimer: NodeJS.Timeout | undefined;
        const drainDeadline = new Promise<"deadline">((resolve) => {
          drainTimer = setTimeout(() => {
            resolve("deadline");
          }, HTTP_DRAIN_TIMEOUT_MS);
        });
        const closeOutcome = closePromise.then(
          () => "closed" as const,
          (error: unknown) => {
            recordShutdownFailure(logger, "http_drain", error);
            return "failed" as const;
          },
        );
        const outcome = await Promise.race([closeOutcome, drainDeadline]);
        if (drainTimer) clearTimeout(drainTimer);

        if (outcome !== "closed") {
          if (outcome === "deadline") {
            logger.warn(
              { stage: "http_drain", outcome: "deadline" },
              "graceful shutdown is closing lingering requests",
            );
          }
          server.closeAllConnections();
          await closePromise.catch(() => undefined);
        }
      } catch (error) {
        recordShutdownFailure(logger, "http_drain", error);
        server.closeAllConnections();
        await closePromise?.catch(() => undefined);
      }

      try {
        await db.$client.end({ timeout: 2 });
      } catch (error) {
        recordShutdownFailure(logger, "database_close", error);
      }
    })();
  };

  process.on("SIGTERM", shutdownOnce);
}
