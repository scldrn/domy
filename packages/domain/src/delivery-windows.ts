import { bogotaLocalTimeToInstant, bogotaToday } from "./bogota-time.ts";

/** Delivery window presets (FR-010, data-model.md §Delivery window presets). */
export type WindowPreset =
  | { preset: "before"; end: string }
  | { preset: "after"; start: string }
  | { preset: "between"; start: string; end: string }
  | { preset: "morning" }
  | { preset: "afternoon" };

export type DeliveryWindow = { windowStart: Date | null; windowEnd: Date | null };

const opening = "08:00";
const closing = "20:00";

function withinOperatingHours(time: string): boolean {
  return time >= opening && time <= closing;
}

/** Turns a preset into instants on the service date, in America/Bogota. */
export function windowFromPreset(serviceDate: string, window: WindowPreset): DeliveryWindow {
  const range: [string | null, string | null] =
    window.preset === "morning"
      ? ["08:00", "12:00"]
      : window.preset === "afternoon"
        ? ["12:00", "20:00"]
        : window.preset === "before"
          ? [null, window.end]
          : window.preset === "after"
            ? [window.start, null]
            : [window.start, window.end];
  const [start, end] = range;
  if ((start && !withinOperatingHours(start)) || (end && !withinOperatingHours(end))) {
    throw new RangeError("Las franjas van de 8:00 a. m. a 8:00 p. m.");
  }
  if (start && end && start >= end) {
    throw new RangeError("La hora inicial debe ser anterior a la final.");
  }
  return {
    windowStart: start ? bogotaLocalTimeToInstant(serviceDate, start) : null,
    windowEnd: end ? bogotaLocalTimeToInstant(serviceDate, end) : null,
  };
}

/** Warnings that do not block saving (FR-010): Sunday service date, window already past. */
export function windowWarnings(
  serviceDate: string,
  window: DeliveryWindow | null,
  now: Date,
): { sunday: boolean; past: boolean } {
  const sunday = new Date(`${serviceDate}T12:00:00Z`).getUTCDay() === 0;
  const latest = window?.windowEnd ?? window?.windowStart ?? null;
  const past = latest !== null ? latest.getTime() <= now.getTime() : serviceDate < bogotaToday(now);
  return { sunday, past };
}
