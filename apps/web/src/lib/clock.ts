/**
 * The browser's clock corrected to the server's: flags such as "En riesgo" and "Atrasado"
 * must not depend on a wrong device clock (research R9).
 */
let offsetMs = 0;

/** Records the server time carried by a response (`Date` header) or by a payload. */
export function syncClock(serverTime: string | null | undefined): void {
  if (!serverTime) return;
  const server = Date.parse(serverTime);
  if (!Number.isNaN(server)) {
    offsetMs = server - Date.now();
  }
}

export function now(): Date {
  return new Date(Date.now() + offsetMs);
}
