import { describe, expect, it } from "vitest";
import type { OutboxItem } from "@/lib/offline/db";
import { awaitingLink, hasOldPending, pendingLabel, sessionWarning } from "./sync-status";

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
  it("checks a saved record's occurrence time at the same two-hour boundary", () => {
    const pending: OutboxItem[] = [
      {
        type: "record",
        record: {
          id: "00000000-0000-4000-8000-000000000001",
          shipmentId: "00000000-0000-4000-8000-000000000002",
          kind: "pickup",
          occurredAt: "2026-10-01T13:00:00Z",
        },
      },
    ];

    expect(hasOldPending(pending, new Date("2026-10-01T15:00:00Z"))).toBe(false);
    expect(hasOldPending(pending, new Date("2026-10-01T15:00:01Z"))).toBe(true);
  });
  it("uses clear zero, singular and plural pending counts", () => {
    expect(pendingLabel(0)).toBe("0 pendientes por sincronizar");
    expect(pendingLabel(1)).toBe("1 pendiente por sincronizar");
    expect(pendingLabel(2)).toBe("2 pendientes por sincronizar");
  });
});

describe("awaitingLink (feature 006, US4)", () => {
  const fresh = {
    refusalCode: "courier_not_linked",
    pending: [],
    pendingPhotos: 0,
    lastSyncedAt: null,
  };

  it("waits for a never-linked account with nothing on the phone", () => {
    expect(awaitingLink(fresh)).toBe(true);
  });

  it("keeps the app for any other refusal", () => {
    expect(awaitingLink({ ...fresh, refusalCode: "forbidden" })).toBe(false);
    expect(awaitingLink({ ...fresh, refusalCode: null })).toBe(false);
  });

  it("keeps the app, and its pending work, for an account unlinked after working", () => {
    expect(awaitingLink({ ...fresh, lastSyncedAt: "2026-10-01T15:00:00Z" })).toBe(false);
    expect(awaitingLink({ ...fresh, pending: [{}] })).toBe(false);
    expect(awaitingLink({ ...fresh, pendingPhotos: 1 })).toBe(false);
  });
});
