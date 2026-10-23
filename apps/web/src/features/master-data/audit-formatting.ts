import {
  neighborhoodKindLabels,
  rateEntryKindLabels,
  userRoleLabels,
  type AuditEvent,
  type NeighborhoodKind,
  type RateEntryKind,
  type UserRole,
} from "@domy/domain";
import { formatCop, formatDate } from "@/lib/format";

export const entityLabels: Record<string, string> = {
  company_settings: "Configuración",
  user: "Usuario",
  merchant: "Cliente",
  pickup_point: "Punto de recogida",
  courier: "Mensajero",
  carrier: "Transportadora",
  neighborhood: "Barrio",
  rate_zone: "Zona tarifaria",
  rate_card_entry: "Tarifa",
};

export const actionLabels: Record<AuditEvent["action"], string> = {
  created: "Creado",
  updated: "Editado",
  deactivated: "Desactivado",
  reactivated: "Reactivado",
  link_replaced: "Enlace reemplazado",
};

export const fieldLabels: Record<string, string> = {
  name: "Nombre",
  phone: "Teléfono",
  whatsappPhone: "WhatsApp",
  email: "Correo electrónico",
  role: "Rol",
  isActive: "Estado",
  address: "Dirección",
  officeAddress: "Dirección de la oficina",
  officeNeighborhoodId: "Barrio de la oficina",
  supportPhone: "Teléfono de soporte",
  companyName: "Nombre de la empresa",
  neighborhoodId: "Barrio",
  rateZoneId: "Zona tarifaria",
  municipalityId: "Municipio",
  instructions: "Indicaciones",
  label: "Nombre del punto",
  isDefault: "Predeterminado",
  variants: "Variantes",
  kind: "Tipo",
  needsReview: "Requiere revisión",
  amount: "Tarifa",
  effectiveFrom: "Vigencia",
  merchantId: "Cliente",
  userId: "Usuario",
  standardFee: "Tarifa estándar",
  expressSurcharge: "Recargo exprés",
  notes: "Notas",
  plate: "Placa",
  vehicleType: "Tipo de vehículo",
  nationalId: "Cédula",
  defaultPaymentMethod: "Medio de pago predeterminado",
  commissionPercentage: "Porcentaje de comisión",
  fixedSalaryCop: "Sueldo fijo",
  invoiceName: "Razón social",
  invoiceTaxId: "NIT / Documento",
  invoiceEmail: "Correo de facturación",
};

export function formatAuditField(field: string): string {
  const label = fieldLabels[field];
  if (label) {
    return label;
  }
  // Fallback humanization from camelCase / snake_case without raw code leaks
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
}

export function formatAuditValue(field: string, item: unknown): string {
  if (item === null || item === undefined || item === "") return "—";
  if (Array.isArray(item)) {
    return item.map((val) => formatAuditValue(field, val)).join(", ") || "—";
  }

  if (field === "isActive") {
    return item === true ? "Activo" : "Inactivo";
  }

  if (field === "isDefault" || field === "needsReview") {
    return item === true ? "Sí" : "No";
  }

  if (typeof item === "boolean") {
    return item ? "Sí" : "No";
  }

  if (field === "role" && typeof item === "string" && item in userRoleLabels) {
    return userRoleLabels[item as UserRole];
  }

  if (field === "kind" && typeof item === "string") {
    if (item in rateEntryKindLabels) return rateEntryKindLabels[item as RateEntryKind];
    if (item in neighborhoodKindLabels) return neighborhoodKindLabels[item as NeighborhoodKind];
    return item;
  }

  if (
    (field === "amount" ||
      field === "standardFee" ||
      field === "expressSurcharge" ||
      field === "fixedSalaryCop") &&
    typeof item === "number"
  ) {
    return formatCop(item);
  }

  if (field === "effectiveFrom" || (typeof item === "string" && /^\d{4}-\d{2}-\d{2}/.test(item))) {
    const raw = typeof item === "string" ? item : item instanceof Date ? item.toISOString() : null;
    if (raw) {
      try {
        return formatDate(raw);
      } catch {
        return raw;
      }
    }
  }

  if (typeof item === "string") {
    return item;
  }

  if (typeof item === "number") {
    return String(item);
  }

  return JSON.stringify(item);
}
