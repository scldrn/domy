/**
 * Preloaded into the real src/index.ts by process-failures.test.ts: SIGUSR2 leaves a promise
 * rejection unhandled and SIGHUP throws outside any request, so the test triggers each failure
 * only once the server is listening. The marker must never reach the logs (Constitution IX).
 */
const marker = "FATAL_MARKER recipient 3001234567";

process.on("SIGUSR2", () => {
  void Promise.reject(new Error(marker));
});
process.on("SIGHUP", () => {
  setImmediate(() => {
    throw new Error(marker);
  });
});
