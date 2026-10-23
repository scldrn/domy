import { describe, expect, it } from "vitest";
import {
  actionLabels,
  entityLabels,
  fieldLabels,
  formatAuditField,
  formatAuditValue,
} from "./audit-formatting";

describe("audit-formatting (Finding IV-25, 001/T140)", () => {
  it("translates every known master data entity type to Spanish", () => {
    expect(entityLabels["company_settings"]).toBe("Configuración");
    expect(entityLabels["user"]).toBe("Usuario");
    expect(entityLabels["merchant"]).toBe("Cliente");
    expect(entityLabels["pickup_point"]).toBe("Punto de recogida");
    expect(entityLabels["courier"]).toBe("Mensajero");
    expect(entityLabels["carrier"]).toBe("Transportadora");
    expect(entityLabels["neighborhood"]).toBe("Barrio");
    expect(entityLabels["rate_zone"]).toBe("Zona tarifaria");
    expect(entityLabels["rate_card_entry"]).toBe("Tarifa");
  });

  it("translates all audit action types to Spanish", () => {
    expect(actionLabels["created"]).toBe("Creado");
    expect(actionLabels["updated"]).toBe("Editado");
    expect(actionLabels["deactivated"]).toBe("Desactivado");
    expect(actionLabels["reactivated"]).toBe("Reactivado");
    expect(actionLabels["link_replaced"]).toBe("Enlace reemplazado");
  });

  it("translates all reachable audit field names to Spanish without raw English or camelCase", () => {
    const fields = [
      ["name", "Nombre"],
      ["phone", "Teléfono"],
      ["whatsappPhone", "WhatsApp"],
      ["email", "Correo electrónico"],
      ["role", "Rol"],
      ["isActive", "Estado"],
      ["address", "Dirección"],
      ["officeAddress", "Dirección de la oficina"],
      ["officeNeighborhoodId", "Barrio de la oficina"],
      ["neighborhoodId", "Barrio"],
      ["rateZoneId", "Zona tarifaria"],
      ["municipalityId", "Municipio"],
      ["instructions", "Indicaciones"],
      ["label", "Nombre del punto"],
      ["isDefault", "Predeterminado"],
      ["variants", "Variantes"],
      ["kind", "Tipo"],
      ["needsReview", "Requiere revisión"],
      ["amount", "Tarifa"],
      ["effectiveFrom", "Vigencia"],
      ["merchantId", "Cliente"],
      ["userId", "Usuario"],
      ["standardFee", "Tarifa estándar"],
      ["expressSurcharge", "Recargo exprés"],
      ["notes", "Notas"],
      ["plate", "Placa"],
      ["vehicleType", "Tipo de vehículo"],
      ["nationalId", "Cédula"],
    ] as const;

    for (const [key, expected] of fields) {
      expect(formatAuditField(key)).toBe(expected);
      expect(fieldLabels[key]).toBe(expected);
    }
  });

  it("formats audit values with domain awareness in Spanish", () => {
    // Empty / null
    expect(formatAuditValue("name", null)).toBe("—");
    expect(formatAuditValue("name", undefined)).toBe("—");
    expect(formatAuditValue("name", "")).toBe("—");

    // isActive field
    expect(formatAuditValue("isActive", true)).toBe("Activo");
    expect(formatAuditValue("isActive", false)).toBe("Inactivo");

    // General booleans
    expect(formatAuditValue("isDefault", true)).toBe("Sí");
    expect(formatAuditValue("isDefault", false)).toBe("No");
    expect(formatAuditValue("needsReview", true)).toBe("Sí");

    // User roles
    expect(formatAuditValue("role", "owner")).toBe("Propietario");
    expect(formatAuditValue("role", "dispatcher")).toBe("Coordinador de despacho");
    expect(formatAuditValue("role", "courier")).toBe("Mensajero");

    // Rate entry kinds and neighborhood kinds
    expect(formatAuditValue("kind", "zone_rate")).toBe("Tarifa de zona");
    expect(formatAuditValue("kind", "express_surcharge")).toBe("Recargo exprés");
    expect(formatAuditValue("kind", "neighborhood")).toBe("Barrio");
    expect(formatAuditValue("kind", "municipality")).toBe("Municipio");
    expect(formatAuditValue("kind", "terminal")).toBe("Terminal");

    // Monetary amounts
    expect(formatAuditValue("amount", 12500)).toBe("$ 12.500");
    expect(formatAuditValue("standardFee", 9700)).toBe("$ 9.700");
    expect(formatAuditValue("expressSurcharge", 3000)).toBe("$ 3.000");

    // Dates (effectiveFrom)
    expect(formatAuditValue("effectiveFrom", "2026-10-01")).toMatch(/1 oct 2026/);

    // Arrays (e.g. variants)
    expect(formatAuditValue("variants", ["laureles", "estadio"])).toBe("laureles, estadio");
    expect(formatAuditValue("variants", [])).toBe("—");
  });
});
