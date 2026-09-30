/**
 * Calendar days and local times in America/Bogota. Colombia has used UTC−05:00 without
 * daylight saving time since 1993, so a fixed offset is exact.
 */
const offset = "-05:00";
const offsetMs = 5 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

/** The Colombian calendar day (YYYY-MM-DD) of an instant. */
export function bogotaToday(now: Date): string {
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** First instant of a Colombian day and first instant of the next one. */
export function bogotaDayRange(date: string): { start: Date; end: Date } {
  const start = bogotaLocalTimeToInstant(date, "00:00");
  return { start, end: new Date(start.getTime() + dayMs) };
}

/** The instant of a local time (HH:MM) on a Colombian day. */
export function bogotaLocalTimeToInstant(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new RangeError(`Invalid Bogotá date or time: ${date} ${time}`);
  }
  const instant = new Date(`${date}T${time}:00${offset}`);
  if (Number.isNaN(instant.getTime()) || bogotaToday(instant) !== date) {
    throw new RangeError(`Invalid Bogotá date: ${date}`);
  }
  return instant;
}

/** The local time (HH:MM) of an instant in Bogotá. */
export function bogotaLocalTime(instant: Date): string {
  return new Date(instant.getTime() - offsetMs).toISOString().slice(11, 16);
}
