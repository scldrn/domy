import type { AuditEvent } from "@domy/domain";
import { describe, expect, it } from "vitest";
import {
  actionLabels,
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
