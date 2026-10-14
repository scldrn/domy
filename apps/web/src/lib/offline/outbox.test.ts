import "fake-indexeddb/auto";
import type { CourierRecordInput, CourierSnapshot, CourierTask } from "@domy/domain";
import { afterEach, describe, expect, it } from "vitest";
import { openCourierDb, type StoredPhoto } from "./db";
import { pendingRecords, replayRecords, saveRecord } from "./outbox";

const id = (n: number) => `0194d9f0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const opened: string[] = [];
async function freshDb() {
  const name = `domy-test-${crypto.randomUUID()}`;
  opened.push(name);
  return { name, db: await openCourierDb(name) };
}
afterEach(() => {
  for (const each of opened.splice(0)) indexedDB.deleteDatabase(each);
});

const task = (extra: Partial<CourierTask>): CourierTask => ({
  id: id(100),
  shipmentId: id(1),
  kind: "pickup",
  status: "pending",
  trackingNumber: "AB12CD34",
  shipmentKind: "delivery",
  shipmentStatus: "dispatched",
  merchant: { id: id(50), name: "Bullish Hype" },
  recipientName: "Laura Gómez",
  recipientPhone: "3001234567",
  carrier: null,
  destinationTown: null,
  errandDescription: null,
  instructions: null,
  packageCount: null,
  packageSize: null,
  windowStart: null,
  windowEnd: null,
  codAmount: 50_000,
  blockedByHandover: null,
  problemNote: null,
  ...extra,
});

/** A route with one pickup and one delivery of the same shipment. */
const snapshot: CourierSnapshot = {
  serverTime: "2026-10-01T15:00:00.000Z",
  sessionExpiresAt: "2026-10-30T15:00:00.000Z",
  route: {
    id: id(20),
    number: 3,
    serviceDate: "2026-10-01",
    status: "in_progress",
    stops: [
      {
        id: id(30),
        position: 0,
        kind: "pickup",
        address: "Cra 70 # 45-10",
        neighborhood: null,
        contactPhone: null,
        tasks: [task({ id: id(100), kind: "pickup" })],
      },
      {
        id: id(31),
        position: 1,
        kind: "delivery",
        address: "Calle 10 # 43-12",
        neighborhood: null,
        contactPhone: "3001234567",
        tasks: [task({ id: id(101), kind: "delivery" })],
      },
    ],
  },
  handoversToGive: [],
  heldOffRoute: [],
  notices: [],
  summary: {
    date: "2026-10-01",
    deliveries: 0,
    exceptions: 0,
    returns: 0,
    pendingStops: 2,
    cash: 0,
    companyTransfer: 0,
    merchantTransfer: 0,
    disbursements: 0,
    cashToHandOver: 0,
  },
};

const pickup: CourierRecordInput = {
  id: id(200),
  shipmentId: id(1),
  kind: "pickup",
  occurredAt: "2026-10-01T15:05:00.000Z",
};
const delivery: CourierRecordInput = {
  id: id(201),
  shipmentId: id(1),
  kind: "delivery",
  occurredAt: "2026-10-01T15:20:00.000Z",
  receivedByName: "Laura Gómez",
  cashAmount: 50_000,
  companyTransferAmount: 0,
  merchantTransferAmount: 0,
  photos: [{ id: id(300), kind: "proof" }],
};

const tasksOf = (state: CourierSnapshot) => state.route?.stops.flatMap((stop) => stop.tasks) ?? [];

/** The phone's outbox (feature 003, research R3, R5, FR-018). */
describe("saveRecord", () => {
  it("binds the account in the same save and rejects a different account without adding data", async () => {
    const { db } = await freshDb();
    await saveRecord(db, pickup, [], { userId: id(700), trackingNumber: "AB12CD34" });
    expect(await db.get("meta", "current")).toMatchObject({ userId: id(700) });
    await expect(saveRecord(db, delivery, [], { userId: id(701) })).rejects.toThrow("otra cuenta");
    expect((await pendingRecords(db)).map((record) => record.id)).toEqual([pickup.id]);
    expect(await db.get("meta", "current")).toMatchObject({ userId: id(700) });
    db.close();
  });
  it("keeps a saved record and its photos across reopening the database", async () => {
    const { name, db } = await freshDb();
    const photo: StoredPhoto = {
      id: id(300),
      recordId: delivery.id,
      kind: "proof",
      image: new Blob(["jpeg"]),
    };
    await saveRecord(db, pickup);
    await saveRecord(db, delivery, [photo]);
    db.close();

    const again = await openCourierDb(name);
    expect((await pendingRecords(again)).map((record) => record.id)).toEqual([
      pickup.id,
      delivery.id,
    ]);
    expect((await again.getAll("photos")).map((each) => each.id)).toEqual([photo.id]);
    again.close();
  });

  it("rejects and keeps nothing when the record cannot be saved", async () => {
    const { db } = await freshDb();
    const broken = { recordId: delivery.id, kind: "proof", image: new Blob([]) } as StoredPhoto;
    await expect(saveRecord(db, delivery, [broken])).rejects.toThrow();
    expect(await pendingRecords(db)).toEqual([]);
    db.close();
  });
});

describe("replayRecords", () => {
  it("shows a pickup and then a delivery as the server will apply them", () => {
    const afterPickup = replayRecords(snapshot, [pickup]);
    expect(
      tasksOf(afterPickup).map((each) => [each.kind, each.status, each.shipmentStatus]),
    ).toEqual([
      ["pickup", "completed", "picked_up"],
      ["delivery", "pending", "picked_up"],
    ]);
    const afterDelivery = replayRecords(snapshot, [pickup, delivery]);
    expect(tasksOf(afterDelivery).map((each) => [each.status, each.shipmentStatus])).toEqual([
      ["completed", "delivered"],
      ["completed", "delivered"],
    ]);
  });

  it("leaves a record the server will not apply without effect (FR-007)", () => {
    // A delivery before its pickup.
    expect(replayRecords(snapshot, [delivery])).toEqual(snapshot);
  });

  it("marks a pickup problem and an exception's failed delivery", () => {
    const problem = replayRecords(snapshot, [
      { ...pickup, id: id(202), kind: "problem", note: "No estaba listo" },
    ]);
    expect(tasksOf(problem)[0]?.problemNote).toBe("No estaba listo");
    const exception = replayRecords(snapshot, [
      pickup,
      { ...pickup, id: id(203), kind: "exception", reason: "recipient_absent", photos: [] },
    ]);
    expect(tasksOf(exception)[1]).toMatchObject({ status: "failed", shipmentStatus: "exception" });
  });

  it("never changes the snapshot it is given", () => {
    const copy = structuredClone(snapshot);
    replayRecords(snapshot, [pickup, delivery]);
    expect(snapshot).toEqual(copy);
  });
});
