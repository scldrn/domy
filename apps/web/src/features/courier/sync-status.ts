import type { OutboxItem } from "@/lib/offline/db";

/** Session warnings use corrected server time; action age uses its device-time pair (US2). */
export function sessionWarning(
  expiresAt: string | null | undefined,
  time: Date,
): "soon" | "expired" | null {
  if (!expiresAt) return null;
  const left = Date.parse(expiresAt) - time.getTime();
  if (left <= 0) return "expired";
  return left <= 2 * 24 * 60 * 60 * 1000 ? "soon" : null;
}

export function hasOldPending(items: OutboxItem[], deviceTime: Date): boolean {
  return items.some(
    (item) =>
      deviceTime.getTime() -
        Date.parse(item.type === "record" ? item.record.occurredAt : item.occurredAt) >
      2 * 60 * 60 * 1000,
  );
}

export function pendingLabel(count: number): string {
  return `${String(count)} ${count === 1 ? "pendiente" : "pendientes"} por sincronizar`;
}

/**
 * The courier waiting page instead of the app (feature 006, US4, approved T055): the server
 * says the account is not linked, and the phone has never synchronized it nor holds work of
 * it. An account unlinked after working keeps the app and its pending work (FR-004).
 */
export function awaitingLink(state: {
  refusalCode: string | null;
  pending: readonly unknown[];
  pendingPhotos: number;
  lastSyncedAt: string | null | undefined;
}): boolean {
  return (
    state.refusalCode === "courier_not_linked" &&
    state.pending.length === 0 &&
    state.pendingPhotos === 0 &&
    !state.lastSyncedAt
  );
}
