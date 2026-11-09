import type { AuditEvent } from "@domy/domain";
import { describe, expect, it } from "vitest";
import {
  actionLabels,
  describeAuditEvent,
  entityLabels,
  formatAuditField,
  formatAuditValue,
} from "@/features/master-data/audit-formatting";

describe("audit-log page Spanish formatting (Finding IV-25, 001/T140)", () => {
  it("renders a full audit row with zero English raw field names or implementation identifiers", () => {
    const mockEvent: AuditEvent = {
      id: "evt-1",
      entityType: "merchant",
      entityId: "m-1",
      action: "updated",
      actor: { id: "u-1", name: "Santiago Marín" },
      occurredAt: "2026-10-01T15:00:00-05:00",
      changes: {
        name: ["Antiguo Cliente", "Nuevo Cliente"],
        whatsappPhone: ["3001112233", "3004445566"],
        isActive: [true, false],
        standardFee: [9500, 11000],
        expressSurcharge: [3000, 4000],
      },
      entityLabel: "Nuevo Cliente",
      changeLabels: {},
    };

    expect(entityLabels[mockEvent.entityType]).toBe("Cliente");
    expect(actionLabels[mockEvent.action]).toBe("Editado");

    const formattedChanges = Object.entries(mockEvent.changes ?? {}).map(
      ([field, [before, after]]) => ({
        label: formatAuditField(field),
        text: `${formatAuditValue(field, before)} → ${formatAuditValue(field, after)}`,
      }),
    );

    expect(formattedChanges).toEqual([
      { label: "Nombre", text: "Antiguo Cliente → Nuevo Cliente" },
      { label: "WhatsApp", text: "3001112233 → 3004445566" },
      { label: "Estado", text: "Activo → Inactivo" },
      { label: "Tarifa estándar", text: "$ 9.500 → $ 11.000" },
      { label: "Recargo exprés", text: "$ 3.000 → $ 4.000" },
    ]);
  });
});

// T059 (feature 006, US5): the log reads names the server resolved, never an identifier.
describe("audit-log sentences (006/T059)", () => {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const base: AuditEvent = {
    id: "0194d9f0-0000-7000-8000-000000000001",
    entityType: "neighborhood",
    entityId: "0194d9f0-0000-7000-8000-000000000002",
    action: "updated",
    actor: { id: "0194d9f0-0000-7000-8000-000000000003", name: "Santiago Marín" },
    occurredAt: "2026-11-09T14:42:00Z",
    changes: {
      rateZoneId: ["0194d9f0-0000-7000-8000-00000000000a", "0194d9f0-0000-7000-8000-00000000000b"],
    },
    entityLabel: "Laureles",
    changeLabels: { rateZoneId: ["Zona Medellín 1", "Zona Medellín 2"] },
  };

  it("names the author, the action, the record, and each referenced record", () => {
    const line = describeAuditEvent(base);
    expect(line).toEqual({
      who: "Santiago Marín",
      verb: "cambió",
      what: "el barrio Laureles",
      changes: ["Zona tarifaria: Zona Medellín 1 → Zona Medellín 2"],
    });
    expect(JSON.stringify(line)).not.toMatch(uuid);
  });

  it("never shows an identifier the server could not name", () => {
    const line = describeAuditEvent({
      ...base,
      action: "created",
      entityType: "pickup_point",
      entityLabel: "Bodega Laureles",
      changes: { merchantId: [null, "0194d9f0-0000-7000-8000-00000000000c"] },
      changeLabels: {},
    });
    expect(line.what).toBe("el punto de recogida Bodega Laureles");
    expect(line.changes).toEqual(["Cliente: Registro eliminado"]);
    expect(JSON.stringify(line)).not.toMatch(uuid);
  });

  it("reads the settings without a label after them", () => {
    expect(
      describeAuditEvent({
        ...base,
        entityType: "company_settings",
        entityLabel: "Cohex",
        changes: { companyName: ["Cohex", "Cohex SAS"] },
        changeLabels: {},
      }).what,
    ).toBe("la configuración");
  });
});
