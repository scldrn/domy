import { describe, expect, it } from "vitest";
import {
  canChangeStatus,
  exceptionDecisionState,
  isHeldForRouting,
  officeReceiptStatus,
  canTransition,
  canVoid,
  isEditable,
  isFinal,
  shipmentStatuses,
  shipmentStatusLabels,
  type ShipmentStatus,
} from "./shipment-lifecycle.ts";

const allowed: [ShipmentStatus, ShipmentStatus][] = [
  ["registered", "voided"],
  ["assigned", "voided"],
  ["dispatched", "voided"],
  ["registered", "assigned"],
  ["registered", "dispatched"],
  ["assigned", "registered"],
  ["assigned", "dispatched"],
  ["dispatched", "registered"],
  ["dispatched", "assigned"],
  ["dispatched", "picked_up"],
  ["registered", "picked_up"],
  ["assigned", "picked_up"],
  ["picked_up", "delivered"],
  ["dispatched", "delivered"],
  ["picked_up", "exception"],
  ["exception", "picked_up"],
  ["exception", "registered"],
  ["exception", "returned"],
  ["delivered", "picked_up"],
  ["returned", "exception"],
];

describe("exception decision state (T056, FR-029–FR-032)", () => {
  const state = {
    status: "exception" as const,
    heldAtOffice: false,
    returnDecided: false,
    serviceDate: "2026-09-30",
  };
  const input = {
    actionId: "00000000-0000-7000-8000-000000000001",
    decision: "new_attempt" as const,
    routeId: "route-one",
  };
  it("defaults a new attempt to today, keeping a selected route only when not rescheduled later", () => {
    expect(exceptionDecisionState(state, input, "2026-10-01")).toEqual({
      status: "picked_up",
      returnDecided: false,
      routeId: "route-one",
      serviceDate: "2026-10-01",
    });
    expect(
      exceptionDecisionState(state, { ...input, serviceDate: "2026-10-02" }, "2026-10-01")?.routeId,
    ).toBeNull();
    expect(
      exceptionDecisionState(
        state,
        { actionId: input.actionId, decision: "new_attempt" },
        "2026-10-01",
      )?.routeId,
    ).toBeNull();
  });
  it("registers an office-held new attempt instead of creating another merchant pickup", () => {
    expect(
      exceptionDecisionState({ ...state, heldAtOffice: true }, input, "2026-10-01")?.status,
    ).toBe("registered");
  });
  it("keeps a return in exception status with its service date, allowing only a later new attempt", () => {
    expect(exceptionDecisionState(state, { ...input, decision: "return" }, "2026-10-01")).toEqual({
      status: "exception",
      returnDecided: true,
      routeId: "route-one",
      serviceDate: state.serviceDate,
    });
    expect(
      exceptionDecisionState(
        { ...state, returnDecided: true },
        { ...input, decision: "return" },
        "2026-10-01",
      ),
    ).toBeNull();
    expect(
      exceptionDecisionState({ ...state, returnDecided: true }, input, "2026-10-01")?.status,
    ).toBe("picked_up");
  });
  it("rejects every non-exception and classifies only picked-up packages and decided returns as held", () => {
    for (const status of shipmentStatuses) {
      if (status !== "exception")
        expect(exceptionDecisionState({ ...state, status }, input, "2026-10-01")).toBeNull();
      expect(isHeldForRouting({ status, returnDecided: false })).toBe(status === "picked_up");
      expect(isHeldForRouting({ status, returnDecided: true })).toBe(
        status === "picked_up" || status === "exception",
      );
    }
  });
});

describe("shipment lifecycle", () => {
  /** T054, FR-041: contextual receipt never relaxes feature 002's route transitions. */
  it("registers only an off-route picked-up package when the office receives custody", () => {
    const held = { status: "picked_up" as const, routeId: null, custodyCourierId: "courier-one" };
    expect(officeReceiptStatus(held)).toBe("registered");
    expect(officeReceiptStatus({ ...held, routeId: "route-one" })).toBeNull();
    expect(officeReceiptStatus({ ...held, custodyCourierId: null })).toBeNull();
    expect(canTransition("picked_up", "registered")).toBe(false);
    expect(canChangeStatus({ kind: "delivery", status: "picked_up" }, "registered")).toBe(false);
  });

  it("receives an exception without deciding a new attempt and rejects other statuses", () => {
    expect(
      officeReceiptStatus({
        status: "exception",
        routeId: "route-one",
        custodyCourierId: "courier-one",
      }),
    ).toBe("exception");
    expect(
      officeReceiptStatus({ status: "exception", routeId: null, custodyCourierId: null }),
    ).toBeNull();
    for (const status of [
      "registered",
      "assigned",
      "dispatched",
      "delivered",
      "returned",
      "voided",
    ] as const) {
      expect(
        officeReceiptStatus({ status, routeId: null, custodyCourierId: "courier-one" }),
      ).toBeNull();
    }
  });

  it("allows every transition of the declared table", () => {
    for (const [from, to] of allowed) {
      expect(canTransition(from, to), `${from} → ${to}`).toBe(true);
    }
  });

  it("refuses every transition outside the table", () => {
    for (const from of shipmentStatuses) {
      for (const to of shipmentStatuses) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("lets routes move shipments only until they are picked up (feature 002)", () => {
    for (const to of ["registered", "assigned", "dispatched"] as const) {
      expect(canTransition("picked_up", to), `picked_up → ${to}`).toBe(false);
    }
    expect(canTransition("dispatched", "assigned"), "dispatch undone").toBe(true);
    expect(canTransition("dispatched", "registered"), "removed before pickup").toBe(true);
  });

  it("delivers straight from «En ruta» only an errand, which has no pickup (feature 003)", () => {
    expect(canChangeStatus({ kind: "errand", status: "dispatched" }, "delivered")).toBe(true);
    for (const kind of ["delivery", "reverse_pickup", "carrier_handoff"] as const) {
      expect(canChangeStatus({ kind, status: "dispatched" }, "delivered"), kind).toBe(false);
      expect(canChangeStatus({ kind, status: "picked_up" }, "delivered"), kind).toBe(true);
    }
    expect(canChangeStatus({ kind: "errand", status: "picked_up" }, "voided")).toBe(false);
  });

  it("treats registered, assigned, and dispatched as editable", () => {
    expect(shipmentStatuses.filter(isEditable)).toEqual(["registered", "assigned", "dispatched"]);
  });

  it("treats delivered, returned, and voided as final", () => {
    expect(shipmentStatuses.filter(isFinal)).toEqual(["delivered", "returned", "voided"]);
  });

  it("allows voiding only from editable statuses", () => {
    expect(shipmentStatuses.filter(canVoid)).toEqual(["registered", "assigned", "dispatched"]);
  });

  it("labels every status in Spanish with the glossary terms", () => {
    expect(shipmentStatusLabels).toEqual({
      registered: "Registrado",
      assigned: "Asignado",
      dispatched: "En ruta",
      picked_up: "Recogido",
      delivered: "Entregado",
      exception: "Novedad",
      returned: "Devuelto",
      voided: "Anulado",
    });
  });
});
