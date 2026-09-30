export type Clock = () => Date;

/**
 * The server's clock. In development and tests, DOMY_FAKE_NOW moves "now" to a chosen instant
 * and time keeps running from there, so time-based rules can be validated (FR-022).
 */
export function createClock(options: { nodeEnv?: string; fakeNow?: string }): Clock {
  const { nodeEnv, fakeNow } = options;
  if (!fakeNow || (nodeEnv !== "development" && nodeEnv !== "test")) {
    return () => new Date();
  }
  const fakeStart = Date.parse(fakeNow);
  if (Number.isNaN(fakeStart)) {
    throw new RangeError(`DOMY_FAKE_NOW is not a valid instant: ${fakeNow}`);
  }
  const offset = fakeStart - Date.now();
  return () => new Date(Date.now() + offset);
}
