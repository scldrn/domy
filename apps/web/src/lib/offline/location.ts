/**
 * The phone's last known position (feature 003, research R7, FR-015): kept while a stop is
 * open, attached to a record when at most 2 minutes old, and never awaited.
 */

const maxAgeMs = 2 * 60 * 1000;

export type KnownPosition = { latitude: number; longitude: number; accuracyM: number; at: number };
export type RecordLocation = { latitude: number; longitude: number; accuracyM: number };

let last: KnownPosition | null = null;

export function freshLocation(
  position: KnownPosition | null,
  now: number,
): RecordLocation | undefined {
  if (!position || now - position.at > maxAgeMs) return undefined;
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyM: Math.round(position.accuracyM),
  };
}

/** Starts following the position; returns how to stop. Without permission, nothing happens. */
export function watchLocation(): () => void {
  if (!("geolocation" in navigator)) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    (position) => {
      last = {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
        accuracyM: position.coords.accuracy,
        at: position.timestamp,
      };
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 30_000 },
  );
  return () => {
    navigator.geolocation.clearWatch(id);
  };
}

/** The position to attach to a record being saved now, if any. */
export function currentLocation(): RecordLocation | undefined {
  return freshLocation(last, Date.now());
}
