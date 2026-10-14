import { describe, expect, it } from "vitest";
import {
  notAppliedReasonLabels,
  noticeText,
  noticeTypes,
  resolveCourierRecord,
  type CourierRecordKind,
  type ShipmentForRecord,
} from "./courier-records.ts";

const ana = "courier-ana";
const beto = "courier-beto";
const anaRoute = { id: "route-ana", status: "in_progress" as const, courierId: ana };
const betoRoute = { id: "route-beto", status: "in_progress" as const, courierId: beto };
const draftRoute = { id: "route-draft", status: "draft" as const, courierId: ana };

/** A task pending on a route, as the record rules see it. */
const task = (
  id: string,
  kind: "pickup" | "delivery" | "errand" | "return",
  route: { id: string; status: "draft" | "in_progress"; courierId: string },
) => ({ id, kind, routeId: route.id, routeStatus: route.status, routeCourierId: route.courierId });

/** A delivery dispatched on Ana's route, both tasks pending. */
function shipment(extra: Partial<ShipmentForRecord> = {}): ShipmentForRecord {
  return {
    kind: "delivery",
    status: "dispatched",
    custodyCourierId: null,
    heldAtOffice: false,
    returnDecided: false,
    route: anaRoute,
    pendingTasks: [task("pickup-1", "pickup", anaRoute), task("delivery-1", "delivery", anaRoute)],
    pendingHandover: null,
    appliedRecords: [],
    ...extra,
  };
}
const pickedUp = (extra: Partial<ShipmentForRecord> = {}) =>
  shipment({
    status: "picked_up",
    custodyCourierId: ana,
    pendingTasks: [task("delivery-1", "delivery", anaRoute)],
    ...extra,
  });
const record = (kind: CourierRecordKind, courierId = ana) => ({ kind, courierId });

/** data-model.md §What each record does, one case per row (FR-024–FR-026). */
describe("resolveCourierRecord", () => {
  describe("pickup", () => {
    it("picks up a shipment on the author's route: custody to the courier, task completed", () => {
      expect(resolveCourierRecord(shipment(), record("pickup"))).toEqual({
        outcome: "applied",
        effect: {
          status: "picked_up",
          custody: { courierId: ana, heldAtOffice: false },
          completeTaskId: "pickup-1",
          needsReview: false,
        },
      });
    });

    it("picks up at the office: custody leaves the office, the status follows (FR-041)", () => {
      const fromOffice = shipment({ heldAtOffice: true });
      expect(resolveCourierRecord(fromOffice, record("pickup"))).toMatchObject({
        outcome: "applied",
        effect: { status: "picked_up", custody: { courierId: ana, heldAtOffice: false } },
      });
      const toReturn = shipment({
        status: "exception",
        heldAtOffice: true,
        returnDecided: true,
        pendingTasks: [task("pickup-1", "pickup", anaRoute), task("return-1", "return", anaRoute)],
      });
      const result = resolveCourierRecord(toReturn, record("pickup"));
      expect(result).toEqual({
        outcome: "applied",
        effect: {
          custody: { courierId: ana, heldAtOffice: false },
          completeTaskId: "pickup-1",
          needsReview: false,
        },
      });
    });

    it("picks up a shipment the dispatcher moved to another courier's route: a handover to them (FR-025)", () => {
      const onBeto = shipment({
        route: betoRoute,
        pendingTasks: [
          task("pickup-2", "pickup", betoRoute),
          task("delivery-2", "delivery", betoRoute),
        ],
      });
      expect(resolveCourierRecord(onBeto, record("pickup"))).toEqual({
        outcome: "applied",
        effect: {
          status: "picked_up",
          custody: { courierId: ana, heldAtOffice: false },
          completeTaskId: "pickup-2",
          requestHandover: { toCourierId: beto, toRouteId: betoRoute.id },
          needsReview: true,
        },
      });
    });

    it("picks up a shipment moved to a route in preparation: it leaves that route (FR-025)", () => {
      const assigned = shipment({
        status: "assigned",
        route: draftRoute,
        pendingTasks: [
          task("pickup-3", "pickup", draftRoute),
          task("delivery-3", "delivery", draftRoute),
        ],
      });
      expect(resolveCourierRecord(assigned, record("pickup"))).toEqual({
        outcome: "applied",
        effect: {
          status: "picked_up",
          custody: { courierId: ana, heldAtOffice: false },
          removeTaskIds: ["pickup-3", "delivery-3"],
          leaveRoute: true,
          needsReview: true,
        },
      });
    });

    it("picks up a shipment the dispatcher removed from every route: it waits off route (FR-025)", () => {
      const registered = shipment({ status: "registered", route: null, pendingTasks: [] });
      expect(resolveCourierRecord(registered, record("pickup"))).toEqual({
        outcome: "applied",
        effect: {
          status: "picked_up",
          custody: { courierId: ana, heldAtOffice: false },
          needsReview: true,
        },
      });
    });

    it("ignores a pickup the courier already recorded, without a flag (FR-024, EC-08)", () => {
      const again = pickedUp({ appliedRecords: [record("pickup")] });
      expect(resolveCourierRecord(again, record("pickup"))).toEqual({ outcome: "duplicate" });
    });

    it("keeps but does not apply a pickup of a voided or delivered shipment, or one another courier has (FR-026)", () => {
      for (const [state, reason] of [
        [shipment({ status: "voided", route: null, pendingTasks: [] }), "voided"],
        [shipment({ status: "delivered", pendingTasks: [] }), "delivered"],
        [pickedUp({ custodyCourierId: beto }), "already_picked_up"],
      ] as const) {
        expect(resolveCourierRecord(state, record("pickup"))).toEqual({
          outcome: "not_applied",
          reason,
        });
      }
    });
  });

  describe("delivery", () => {
    it("delivers a shipment the courier holds: custody ends, task completed", () => {
      expect(resolveCourierRecord(pickedUp(), record("delivery"))).toEqual({
        outcome: "applied",
        effect: {
          status: "delivered",
          custody: { courierId: null, heldAtOffice: false },
          completeTaskId: "delivery-1",
          needsReview: false,
        },
      });
    });

    it("completes an errand straight from «En ruta», with no custody", () => {
      const errand = shipment({
        kind: "errand",
        pendingTasks: [task("errand-1", "errand", anaRoute)],
      });
      expect(resolveCourierRecord(errand, record("delivery"))).toEqual({
        outcome: "applied",
        effect: { status: "delivered", completeTaskId: "errand-1", needsReview: false },
      });
    });

    it("delivers a package reassigned meanwhile: the handover is cancelled and the other stop goes (US5 scenario 6)", () => {
      const reassigned = pickedUp({
        route: betoRoute,
        pendingTasks: [task("delivery-2", "delivery", betoRoute)],
        pendingHandover: { id: "handover-1", toCourierId: beto, toRouteId: betoRoute.id },
      });
      expect(resolveCourierRecord(reassigned, record("delivery"))).toEqual({
        outcome: "applied",
        effect: {
          status: "delivered",
          custody: { courierId: null, heldAtOffice: false },
          removeTaskIds: ["delivery-2"],
          cancelHandoverId: "handover-1",
          needsReview: true,
        },
      });
    });

    it("refuses a delivery before the pickup and one by a courier without the package (FR-007, FR-026)", () => {
      expect(resolveCourierRecord(shipment(), record("delivery"))).toEqual({
        outcome: "not_applied",
        reason: "not_picked_up",
      });
      expect(resolveCourierRecord(pickedUp(), record("delivery", beto))).toEqual({
        outcome: "not_applied",
        reason: "not_in_custody",
      });
    });

    it("ignores a delivery the courier already recorded", () => {
      const delivered = shipment({
        status: "delivered",
        pendingTasks: [],
        appliedRecords: [record("pickup"), record("delivery")],
      });
      expect(resolveCourierRecord(delivered, record("delivery"))).toEqual({ outcome: "duplicate" });
    });
  });

  describe("exception", () => {
    it("fails the delivery task and keeps the package with the courier (FR-013)", () => {
      expect(resolveCourierRecord(pickedUp(), record("exception"))).toEqual({
        outcome: "applied",
        effect: { status: "exception", failTaskId: "delivery-1", needsReview: false },
      });
    });

    it("is not applied without custody, and repeated is a duplicate", () => {
      expect(resolveCourierRecord(pickedUp(), record("exception", beto))).toEqual({
        outcome: "not_applied",
        reason: "not_in_custody",
      });
      const already = pickedUp({
        status: "exception",
        pendingTasks: [],
        appliedRecords: [record("exception")],
      });
      expect(resolveCourierRecord(already, record("exception"))).toEqual({ outcome: "duplicate" });
    });
  });

  describe("return", () => {
    const toReturn = (extra: Partial<ShipmentForRecord> = {}) =>
      pickedUp({
        status: "exception",
        returnDecided: true,
        pendingTasks: [task("return-1", "return", anaRoute)],
        ...extra,
      });

    it("returns the package to the merchant: custody ends, the return is no longer pending (FR-030)", () => {
      expect(resolveCourierRecord(toReturn(), record("return"))).toEqual({
        outcome: "applied",
        effect: {
          status: "returned",
          custody: { courierId: null, heldAtOffice: false },
          completeTaskId: "return-1",
          returnDecided: false,
          needsReview: false,
        },
      });
    });

    it("is not applied while no return was decided", () => {
      expect(resolveCourierRecord(toReturn({ returnDecided: false }), record("return"))).toEqual({
        outcome: "not_applied",
        reason: "no_task",
      });
    });
  });

  describe("problem", () => {
    it("notes a problem on a pending pickup, errand, or return of the author's route (FR-014)", () => {
      expect(resolveCourierRecord(shipment(), record("problem"))).toEqual({
        outcome: "applied",
        effect: { problemNoteTaskId: "pickup-1", needsReview: false },
      });
    });

    it("is not applied without such a task", () => {
      expect(resolveCourierRecord(pickedUp(), record("problem"))).toEqual({
        outcome: "not_applied",
        reason: "no_task",
      });
    });
  });

  describe("disbursement", () => {
    it("is stored for any shipment of the route, done or pending (FR-012)", () => {
      expect(resolveCourierRecord(pickedUp(), record("disbursement"))).toEqual({
        outcome: "applied",
        effect: { needsReview: false },
      });
    });

    it("is flagged for a shipment off the author's route, and not applied once voided (FR-025)", () => {
      expect(resolveCourierRecord(shipment({ route: betoRoute }), record("disbursement"))).toEqual({
        outcome: "applied",
        effect: { needsReview: true },
      });
      expect(
        resolveCourierRecord(shipment({ status: "voided", route: null }), record("disbursement")),
      ).toEqual({ outcome: "not_applied", reason: "voided" });
    });
  });

  describe("handover confirmation", () => {
    const pending = (toCourierId = beto) =>
      pickedUp({
        route: betoRoute,
        pendingTasks: [task("delivery-2", "delivery", betoRoute)],
        pendingHandover: { id: "handover-1", toCourierId, toRouteId: betoRoute.id },
      });

    it("confirms a pending handover to the courier: custody passes to them (FR-028)", () => {
      expect(resolveCourierRecord(pending(), record("handover_confirmation", beto))).toEqual({
        outcome: "applied",
        effect: {
          custody: { courierId: beto, heldAtOffice: false },
          confirmHandoverId: "handover-1",
          needsReview: false,
        },
      });
    });

    it("is a duplicate once custody already passed, and not applied otherwise", () => {
      const confirmed = pickedUp({ custodyCourierId: beto, route: betoRoute });
      expect(resolveCourierRecord(confirmed, record("handover_confirmation", beto))).toEqual({
        outcome: "duplicate",
      });
      expect(resolveCourierRecord(pending(), record("handover_confirmation", ana))).toEqual({
        outcome: "not_applied",
        reason: "no_handover",
      });
    });
  });

  it("explains every reason a record is not applied in Spanish", () => {
    for (const label of Object.values(notAppliedReasonLabels)) {
      expect(label).toMatch(/^[A-ZÁÉÍÓÚ¿].+\.$/);
    }
  });
});

/** What the courier reads for each change to their route (FR-027, FR-040). */
describe("noticeText", () => {
  it("names the change and the shipment or route it concerns", () => {
    expect(noticeText("shipment_added", { trackingNumber: "7SMQ5M5T" })).toBe(
      "Envío agregado a tu ruta: 7SMQ-5M5T.",
    );
    expect(noticeText("route_dispatched", { routeNumber: 3 })).toBe("Te despacharon la Ruta 3.");
    expect(noticeText("shipment_updated", { trackingNumber: "7SMQ5M5T" })).toBe(
      "Envío actualizado: 7SMQ-5M5T. Revisa la dirección y las indicaciones.",
    );
  });

  it("reads well without the shipment, as a phone notification carries no personal data", () => {
    for (const type of noticeTypes) {
      const text = noticeText(type, {});
      expect(text, type).toMatch(/^[A-ZÁÉÍÓÚ¿].+\.$/);
      expect(text, type).not.toMatch(/undefined|null|:\s*\./);
    }
  });
});
