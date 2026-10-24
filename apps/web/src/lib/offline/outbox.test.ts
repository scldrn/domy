import "fake-indexeddb/auto";
import type { CourierRecordInput, CourierSnapshot, CourierTask } from "@domy/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openCourierDb, type StoredPhoto } from "./db";
import { pendingRecords, replayRecords, saveRecord, saveAcknowledgment } from "./outbox";

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
  it("rolls every acknowledgment chunk back when the second storage write fails (T119)", async () => {
    const { db } = await freshDb();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- saved native method is explicitly invoked with .call(this) below.
    const originalAdd = IDBObjectStore.prototype.add;
    let writes = 0;
    const spy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "outbox" && ++writes === 2)
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return originalAdd.call(this, value, key);
    });
    try {
      await expect(
        saveAcknowledgment(
          db,
          {
            actionId: id(5000),
            noticeIds: Array.from({ length: 201 }, (_, index) => id(1000 + index)),
            occurredAt: snapshot.serverTime,
          },
          id(9000),
        ),
      ).rejects.toThrow("Quota exceeded");
      expect(await db.getAll("outbox")).toEqual([]);
    } finally {
      spy.mockRestore();
      db.close();
    }
  });
  it("persists acknowledgment of 401 shown notices in legal, uniquely keyed chunks (T119)", async () => {
    const { name, db } = await freshDb();
    await saveAcknowledgment(
      db,
      {
        actionId: id(5000),
        noticeIds: Array.from({ length: 401 }, (_, index) => id(1000 + index)),
        occurredAt: snapshot.serverTime,
      },
      id(9000),
    );
    const items = await db.getAll("outbox");
    expect(items).toHaveLength(3);
    expect(
      items.flatMap((item) => (item.type === "acknowledgment" ? [item.noticeIds.length] : [])),
    ).toEqual([200, 200, 1]);
    expect(
      new Set(items.flatMap((item) => (item.type === "acknowledgment" ? [item.actionId] : [])))
        .size,
    ).toBe(3);
    db.close();
    const reopened = await openCourierDb(name);
    expect(await reopened.getAll("outbox")).toEqual(items);
    reopened.close();
  });
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

function officeReturnSnapshot() {
  const office = structuredClone(snapshot);
  if (!office.route) throw new Error("The fixture route is missing");
  office.route.stops[0] = {
    ...office.route.stops[0],
    id: id(30),
    position: 0,
    kind: "pickup",
    address: "Carrera 90 # 65C-10",
    neighborhood: null,
    contactPhone: null,
    tasks: [task({ id: id(100), shipmentStatus: "exception", kind: "pickup" })],
  };
  office.route.stops[1] = {
    ...office.route.stops[1],
    id: id(31),
    position: 1,
    kind: "return",
    address: "Cra 70 # 45-10",
    neighborhood: null,
    contactPhone: null,
    tasks: [task({ id: id(101), shipmentStatus: "exception", kind: "return" })],
  };
  return office;
}

describe("replayRecords", () => {
  it("adds only applied pending collections to saved totals and counts projected stops (US7)", () => {
    const saved = structuredClone(snapshot);
    saved.summary = {
      ...saved.summary,
      deliveries: 2,
      cash: 100_000,
      companyTransfer: 50_000,
      cashToHandOver: 100_000,
    };
    const payment: CourierRecordInput = {
      ...pickup,
      id: id(207),
      kind: "disbursement",
      amount: 12_000,
      payee: "Transportadora",
      photos: [],
    };
    const after = replayRecords(saved, [
      { ...delivery, id: id(209) },
      pickup,
      delivery,
      { ...delivery, id: id(206) },
      payment,
    ]);
    expect(after.summary).toEqual({
      ...saved.summary,
      deliveries: 3,
      cash: 150_000,
      disbursements: 12_000,
      cashToHandOver: 138_000,
      pendingStops: 0,
    });
    expect(saved.summary).toMatchObject({ deliveries: 2, cash: 100_000, pendingStops: 2 });
  });

  it("summarizes pending records identically after reopening IndexedDB (US7 AC2)", async () => {
    const { name, db } = await freshDb();
    await db.put("snapshot", snapshot, "current");
    await saveRecord(db, pickup);
    await saveRecord(db, delivery);
    db.close();
    const reopened = await openCourierDb(name);
    try {
      const saved = await reopened.get("snapshot", "current");
      if (!saved) throw new Error("Missing saved snapshot");
      expect(replayRecords(saved, await pendingRecords(reopened)).summary).toMatchObject({
        deliveries: 1,
        cash: 50_000,
        pendingStops: 0,
      });
    } finally {
      reopened.close();
    }
  });

  it("counts a held off-route disbursement without a current route (FR-037)", () => {
    const saved = structuredClone(snapshot);
    saved.route = null;
    saved.summary.pendingStops = 0;
    saved.heldOffRoute = [
      {
        shipmentId: id(1),
        trackingNumber: "AB12CD34",
        status: "picked_up",
        serviceDate: "2026-10-01",
        merchant: { id: id(50), name: "Bullish Hype" },
        recipientName: "Laura Gómez",
        returnDecided: false,
      },
    ];
    const payment: CourierRecordInput = {
      ...pickup,
      kind: "disbursement",
      amount: 12_000,
      payee: "Transportadora",
      photos: [],
    };
    expect(replayRecords(saved, [payment]).summary).toMatchObject({
      disbursements: 12_000,
      cashToHandOver: -12_000,
    });
  });

  it("uses corrected pending timestamps and discards a previous-day baseline (FR-019/FR-037)", () => {
    const devicePickup = { ...pickup, occurredAt: "2026-10-02T05:01:00Z" };
    const deviceDelivery = { ...delivery, occurredAt: "2026-10-02T05:02:00Z" };
    // Phone is five minutes fast: both actions happened before Bogotá midnight.
    expect(
      replayRecords(snapshot, [devicePickup, deviceDelivery], [], {
        date: "2026-10-01",
        clockOffsetMs: -300_000,
      }).summary.cash,
    ).toBe(50_000);
    const saved = structuredClone(snapshot);
    saved.summary.cash = 100_000;
    saved.summary.cashToHandOver = 100_000;
    saved.summary.deliveries = 1;
    expect(
      replayRecords(saved, [pickup, delivery], [], { date: "2026-10-02", clockOffsetMs: 0 })
        .summary,
    ).toMatchObject({ date: "2026-10-02", deliveries: 0, cash: 0, pendingStops: 0 });
  });
  it("hides only acknowledged notices even without a route, preserving the saved snapshot (FR-027)", () => {
    const saved = structuredClone(snapshot);
    saved.route = null;
    saved.notices = [id(300), id(301)].map((noticeId) => ({
      id: noticeId,
      type: "route_dispatched",
      routeNumber: 3,
      trackingNumber: null,
      createdAt: snapshot.serverTime,
    }));
    expect(replayRecords(saved, [], [id(300)]).notices.map((notice) => notice.id)).toEqual([
      id(301),
    ]);
    expect(saved.notices).toHaveLength(2);
  });

  it("refuses a return while the office pickup is still pending (T055, FR-041)", () => {
    const office = officeReturnSnapshot();
    const returned: CourierRecordInput = {
      ...pickup,
      kind: "return",
      receivedByName: "Persona del comercio",
      photos: [],
    };
    expect(replayRecords(office, [returned])).toEqual(office);
  });
  /** T055, FR-018/FR-030/FR-041: office custody lasts until the actual pickup. */
  it("replays an office pickup before a return and preserves both after reopening", async () => {
    const office = officeReturnSnapshot();
    const returned: CourierRecordInput = {
      id: id(204),
      shipmentId: id(1),
      kind: "return",
      occurredAt: "2026-10-01T15:20:00.000Z",
      receivedByName: "Persona del comercio",
      photos: [],
    };
    const pickedUp = replayRecords(office, [pickup]);
    expect(tasksOf(pickedUp).map((each) => [each.kind, each.status, each.shipmentStatus])).toEqual([
      ["pickup", "completed", "exception"],
      ["return", "pending", "exception"],
    ]);
    const { name, db } = await freshDb();
    await saveRecord(db, pickup);
    await saveRecord(db, returned);
    db.close();
    const again = await openCourierDb(name);
    try {
      const records = await pendingRecords(again);
      expect(records.map((record) => record.id)).toEqual([pickup.id, returned.id]);
      const completed = replayRecords(office, records);
      expect(tasksOf(completed).map((each) => [each.status, each.shipmentStatus])).toEqual([
        ["completed", "returned"],
        ["completed", "returned"],
      ]);
      expect(tasksOf(office)[0]?.status).toBe("pending");
    } finally {
      again.close();
    }
  });

  it("keeps a return pending after a problem and completes it without collection fields", () => {
    const held = structuredClone(snapshot);
    if (!held.route) throw new Error("The fixture route is missing");
    held.route.stops = [
      {
        id: id(31),
        position: 0,
        kind: "return",
        address: "Cra 70 # 45-10",
        neighborhood: null,
        contactPhone: null,
        tasks: [task({ kind: "return", shipmentStatus: "exception" })],
      },
    ];
    const problem: CourierRecordInput = {
      ...pickup,
      kind: "problem",
      note: "El comercio está cerrado",
    };
    const noted = replayRecords(held, [problem]);
    expect(tasksOf(noted)).toMatchObject([
      { status: "pending", shipmentStatus: "exception", problemNote: problem.note },
    ]);
    const returned: CourierRecordInput = {
      ...pickup,
      id: id(205),
      kind: "return",
      receivedByName: "Persona del comercio",
      photos: [],
    };
    expect(tasksOf(replayRecords(held, [problem, returned]))).toMatchObject([
      { status: "completed", shipmentStatus: "returned", problemNote: null },
    ]);
  });

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

  it("leaves a package delivery without who received it without effect, as the server keeps it (ROB-3)", () => {
    const nameless: CourierRecordInput = {
      id: id(204),
      shipmentId: id(1),
      kind: "delivery",
      occurredAt: "2026-10-01T15:20:00.000Z",
      cashAmount: 50_000,
      companyTransferAmount: 0,
      merchantTransferAmount: 0,
      photos: [],
    };
    const state = replayRecords(snapshot, [pickup, nameless]);
    expect(tasksOf(state).map((each) => [each.status, each.shipmentStatus])).toEqual([
      ["completed", "picked_up"],
      ["pending", "picked_up"],
    ]);
    expect(state.summary.cash).toBe(0);
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
