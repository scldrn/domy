import { describe, expect, it } from "vitest";
import {
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

describe("shipment lifecycle", () => {
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
