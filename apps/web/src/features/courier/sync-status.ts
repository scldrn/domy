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
