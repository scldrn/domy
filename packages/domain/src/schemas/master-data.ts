import { z } from "zod";
import {
  neighborhoodKind,
  rateEntryKind,
  type NeighborhoodKind,
  type RateEntryKind,
} from "./enums.ts";
import { calendarDate, money, phone } from "./shipment.ts";

/**
 * Master data (FR-026–FR-029, FR-036, FR-042). Creations carry the new record's `id`; every
 * other change carries an `actionId`. Records are deactivated, never deleted.
 */

const actionId = z.uuid("Falta el identificador de la acción.");
const name = (message: string) =>
  z.string({ error: message }).trim().min(2, message).max(120, "Máximo 120 caracteres.");
const aliases = z
  .array(z.string().trim().min(2, "Cada alias tiene al menos 2 caracteres.").max(120))
  .max(20, "Máximo 20 alias.");
const optionalText = z.string().trim().max(500).nullable();

export const merchantCreateInput = z.object({
  id: z.uuid(),
  name: name("Escribe el nombre del cliente."),
  whatsappPhone: phone.nullable().optional(),
  aliases: aliases.default([]),
});
export type MerchantCreateInput = z.input<typeof merchantCreateInput>;

export const merchantUpdateInput = z.object({
  actionId,
  name: name("Escribe el nombre del cliente.").optional(),
  whatsappPhone: phone.nullable().optional(),
  aliases: aliases.optional(),
  isActive: z.boolean().optional(),
});
export type MerchantUpdateInput = z.input<typeof merchantUpdateInput>;

export const pickupPointCreateInput = z.object({
  id: z.uuid(),
  label: name("Escribe el nombre del punto, por ejemplo «Bodega Estadio»."),
  address: z.string().trim().min(3, "Escribe la dirección."),
  neighborhoodId: z.uuid("Elige el barrio."),
  instructions: optionalText.optional(),
  isDefault: z.boolean().optional(),
});
export type PickupPointCreateInput = z.input<typeof pickupPointCreateInput>;

export const pickupPointUpdateInput = z.object({
  actionId,
  label: name("Escribe el nombre del punto.").optional(),
  address: z.string().trim().min(3, "Escribe la dirección.").optional(),
  neighborhoodId: z.uuid("Elige el barrio.").optional(),
  instructions: optionalText.optional(),
  /** Only `true`: another point becomes the default by choosing it. */
  isDefault: z.literal(true).optional(),
  isActive: z.boolean().optional(),
});
export type PickupPointUpdateInput = z.input<typeof pickupPointUpdateInput>;

export const courierCreateInput = z.object({
  id: z.uuid(),
  name: name("Escribe el nombre del mensajero."),
  phone,
  aliases: aliases.default([]),
});
export type CourierCreateInput = z.input<typeof courierCreateInput>;

export const courierUpdateInput = z.object({
  actionId,
  name: name("Escribe el nombre del mensajero.").optional(),
  phone: phone.optional(),
  aliases: aliases.optional(),
  isActive: z.boolean().optional(),
});
export type CourierUpdateInput = z.input<typeof courierUpdateInput>;

export const carrierCreateInput = z.object({
  id: z.uuid(),
  name: name("Escribe el nombre de la transportadora."),
});
export type CarrierCreateInput = z.input<typeof carrierCreateInput>;

export const carrierUpdateInput = z.object({
  actionId,
  name: name("Escribe el nombre de la transportadora.").optional(),
  isActive: z.boolean().optional(),
});
export type CarrierUpdateInput = z.input<typeof carrierUpdateInput>;

/** `rateZoneId`, `needsReview`, and `isActive` are the owner's (FR-026, FR-036). */
export const neighborhoodUpdateInput = z.object({
  actionId,
  name: name("Escribe el nombre del barrio.").optional(),
  variants: z.array(z.string().trim().min(2).max(120)).max(50).optional(),
  kind: neighborhoodKind.optional(),
  rateZoneId: z.uuid().optional(),
  needsReview: z.literal(false).optional(),
  isActive: z.boolean().optional(),
});
export type NeighborhoodUpdateInput = z.input<typeof neighborhoodUpdateInput>;

export const rateZoneCreateInput = z.object({
  id: z.uuid(),
  name: name("Escribe el nombre de la zona."),
});
export type RateZoneCreateInput = z.input<typeof rateZoneCreateInput>;

export const rateZoneUpdateInput = z.object({
  actionId,
  name: name("Escribe el nombre de la zona.").optional(),
  isActive: z.boolean().optional(),
});
export type RateZoneUpdateInput = z.input<typeof rateZoneUpdateInput>;

/**
 * A new rate card entry (FR-028): effective from 00:00 in Bogotá of `effectiveFrom`.
 * Entries are never edited: a correction is a new entry.
 */
export const rateCardEntryInput = z
  .object({
    id: z.uuid(),
    kind: rateEntryKind,
    merchantId: z.uuid().nullable().default(null),
    rateZoneId: z.uuid().nullable().default(null),
    amount: money,
    effectiveFrom: calendarDate,
  })
  .superRefine((entry, context) => {
    if (entry.kind === "zone_rate" && !entry.rateZoneId) {
      context.addIssue({ code: "custom", path: ["rateZoneId"], message: "Elige la zona." });
    }
    if (entry.kind === "zone_rate" && entry.amount <= 0) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "La tarifa debe ser mayor que cero.",
      });
    }
    if (entry.kind === "express_surcharge" && entry.rateZoneId) {
      context.addIssue({
        code: "custom",
        path: ["rateZoneId"],
        message: "El recargo exprés no depende de la zona.",
      });
    }
  });
export type RateCardEntryInput = z.input<typeof rateCardEntryInput>;

type Named = { id: string; name: string };

export type Merchant = Named & {
  whatsappPhone: string | null;
  isActive: boolean;
  aliases: string[];
};
export type PickupPoint = {
  id: string;
  label: string;
  address: string;
  instructions: string | null;
  isDefault: boolean;
  isActive: boolean;
  neighborhood: Named;
};
export type MerchantDetail = Merchant & { pickupPoints: PickupPoint[]; openShipments: number };
export type Courier = Named & { phone: string; isActive: boolean; aliases: string[] };
export type Carrier = Named & { isActive: boolean };
export type RateZone = Named & { isActive: boolean };
export type NeighborhoodDetail = Named & {
  kind: NeighborhoodKind;
  needsReview: boolean;
  isActive: boolean;
  municipality: Named;
  rateZone: Named;
  variants: string[];
};

export type RateCardEntry = {
  id: string;
  kind: RateEntryKind;
  merchant: Named | null;
  rateZone: Named | null;
  amount: number;
  /** The effective calendar day in Bogotá. */
  effectiveFrom: string;
  createdAt: string;
  createdBy: Named;
};

/** The rate card in force at an instant, for all merchants or with one merchant's overrides. */
export type RateCard = {
  at: string;
  zones: { rateZone: Named; standard: RateCardEntry | null; merchant: RateCardEntry | null }[];
  expressSurcharge: { standard: RateCardEntry | null; merchant: RateCardEntry | null };
  /** Entries that take effect after `at`. */
  scheduled: RateCardEntry[];
};

export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "deactivated" | "reactivated";
  actor: Named;
  occurredAt: string;
  changes: Record<string, [unknown, unknown]> | null;
};
