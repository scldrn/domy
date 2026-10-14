import { describe, expect, it } from "vitest";
import type { OutboxItem } from "@/lib/offline/db";
import { hasOldPending, pendingLabel, sessionWarning } from "./sync-status";

const expiry = "2026-10-31T15:00:00Z";
describe("courier synchronization status (US2 T046, FR-003, FR-020)", () => {
  it("warns from exactly two days before expiry and changes to expired at the boundary", () => {
    expect(sessionWarning(expiry, new Date("2026-10-29T14:59:59Z"))).toBeNull();
    expect(sessionWarning(expiry, new Date("2026-10-29T15:00:00Z"))).toBe("soon");
    expect(sessionWarning(expiry, new Date(expiry))).toBe("expired");
    expect(sessionWarning(null, new Date(expiry))).toBeNull();
  });
  it("warns only after pending actions have waited more than two hours", () => {
    const pending: OutboxItem[] = [
      {
        type: "acknowledgment",
        actionId: "0194d9f0-0000-7000-8000-000000000001",
        noticeIds: ["0194d9f0-0000-7000-8000-000000000002"],
        occurredAt: "2026-10-01T13:00:00Z",
      },
    ];
    expect(hasOldPending(pending, new Date("2026-10-01T15:00:00Z"))).toBe(false);
    expect(hasOldPending(pending, new Date("2026-10-01T15:00:01Z"))).toBe(true);
    expect(hasOldPending([], new Date("2026-10-01T15:00:01Z"))).toBe(false);
  });
  it("uses clear singular and plural pending counts", () => {
    expect(pendingLabel(1)).toBe("1 pendiente por sincronizar");
    expect(pendingLabel(2)).toBe("2 pendientes por sincronizar");
  });
});
