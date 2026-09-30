import { z } from "zod";
import { shipmentStatuses, shipmentStatusLabels } from "../shipment-lifecycle.ts";

/** Enumerations shared by server and web, with their Spanish labels (docs/glossary.md). */

export const userRoles = ["owner", "dispatcher", "courier"] as const;
export const userRole = z.enum(userRoles);
export type UserRole = z.infer<typeof userRole>;
export const userRoleLabels: Record<UserRole, string> = {
  owner: "Propietario",
  dispatcher: "Coordinador de despacho",
  courier: "Mensajero",
};

export const shipmentKinds = ["delivery", "reverse_pickup", "carrier_handoff", "errand"] as const;
export const shipmentKind = z.enum(shipmentKinds);
export type ShipmentKind = z.infer<typeof shipmentKind>;
export const shipmentKindLabels: Record<ShipmentKind, string> = {
  delivery: "Entrega",
  reverse_pickup: "Recogida inversa",
  carrier_handoff: "Entrega a transportadora",
  errand: "Diligencia",
};

export const shipmentStatus = z.enum(shipmentStatuses);
export { shipmentStatusLabels };

export const paymentModes = ["cash_on_delivery", "recipient_pays_fee", "merchant_account"] as const;
export const paymentMode = z.enum(paymentModes);
export type PaymentMode = z.infer<typeof paymentMode>;
export const paymentModeLabels: Record<PaymentMode, string> = {
  cash_on_delivery: "Contraentrega",
  recipient_pays_fee: "Flete al destinatario",
  merchant_account: "Crédito del cliente",
};

export const serviceLevels = ["standard", "express"] as const;
export const serviceLevel = z.enum(serviceLevels);
export type ServiceLevel = z.infer<typeof serviceLevel>;
export const serviceLevelLabels: Record<ServiceLevel, string> = {
  standard: "Estándar",
  express: "Exprés",
};

export const packageSizes = ["small", "medium", "large", "extra_large"] as const;
export const packageSize = z.enum(packageSizes);
export type PackageSize = z.infer<typeof packageSize>;
export const packageSizeLabels: Record<PackageSize, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
  extra_large: "Extragrande",
};

export const neighborhoodKinds = [
  "neighborhood",
  "municipality",
  "terminal",
  "airport",
  "carrier_office",
] as const;
export const neighborhoodKind = z.enum(neighborhoodKinds);
export type NeighborhoodKind = z.infer<typeof neighborhoodKind>;
export const neighborhoodKindLabels: Record<NeighborhoodKind, string> = {
  neighborhood: "Barrio",
  municipality: "Municipio",
  terminal: "Terminal",
  airport: "Aeropuerto",
  carrier_office: "Oficina de transportadora",
};

export const rateEntryKinds = ["zone_rate", "express_surcharge"] as const;
export const rateEntryKind = z.enum(rateEntryKinds);
export type RateEntryKind = z.infer<typeof rateEntryKind>;
export const rateEntryKindLabels: Record<RateEntryKind, string> = {
  zone_rate: "Tarifa de zona",
  express_surcharge: "Recargo exprés",
};
