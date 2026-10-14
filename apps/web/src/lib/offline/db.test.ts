import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { openCourierDb, type OutboxItem } from "./db";

const name = () => `domy-test-${crypto.randomUUID()}`;
const opened: string[] = [];
afterEach(() => {
  for (const each of opened.splice(0)) indexedDB.deleteDatabase(each);
});

const record = (n: number): OutboxItem => ({
  type: "record",
  record: {
    id: `0194d9f0-0000-7000-8000-${String(n).padStart(12, "0")}`,
    shipmentId: "0194d9f0-0000-7000-8000-000000000999",
    kind: "pickup",
    occurredAt: "2026-10-01T15:00:00.000Z",
  },
});

/** The phone's database (feature 003, data-model.md §Data on the phone, research R3). */
describe("openCourierDb", () => {
  it("has the snapshot, outbox, photos, and meta stores", async () => {
    const dbName = name();
    opened.push(dbName);
    const db = await openCourierDb(dbName);
    expect([...db.objectStoreNames].sort()).toEqual(["meta", "outbox", "photos", "snapshot"]);
    db.close();
  });

  it("keeps the outbox in the order items were saved, across reopening (FR-018)", async () => {
    const dbName = name();
    opened.push(dbName);
    const first = await openCourierDb(dbName);
    for (const n of [3, 1, 2]) await first.add("outbox", record(n));
    await first.add("outbox", {
      type: "acknowledgment",
      actionId: "0194d9f0-0000-7000-8000-000000000100",
      noticeIds: ["0194d9f0-0000-7000-8000-000000000101"],
      occurredAt: "2026-10-01T15:01:00.000Z",
    });
    first.close();

    const again = await openCourierDb(dbName);
    const items = await again.getAll("outbox");
    expect(
      items.map((item) => (item.type === "record" ? item.record.id.slice(-1) : "ack")),
    ).toEqual(["3", "1", "2", "ack"]);
    again.close();
  });

  it("finds a record's photos", async () => {
    const dbName = name();
    opened.push(dbName);
    const db = await openCourierDb(dbName);
    const recordId = "0194d9f0-0000-7000-8000-000000000001";
    await db.put("photos", { id: "p1", recordId, kind: "proof", image: new Blob(["a"]) });
    await db.put("photos", { id: "p2", recordId: "other", kind: "proof", image: new Blob(["b"]) });
    const photos = await db.getAllFromIndex("photos", "byRecord", recordId);
    expect(photos.map((photo) => photo.id)).toEqual(["p1"]);
    db.close();
  });

  it("keeps who uses the phone, the clock offset, and the last sync in meta", async () => {
    const dbName = name();
    opened.push(dbName);
    const db = await openCourierDb(dbName);
    await db.put("meta", { userId: "u1", clockOffsetMs: -1500, lastSyncedAt: null }, "current");
    expect(await db.get("meta", "current")).toEqual({
      userId: "u1",
      clockOffsetMs: -1500,
      lastSyncedAt: null,
    });
    db.close();
  });
});
