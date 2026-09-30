import type {
  PackageSize,
  PaymentMode,
  ServiceLevel,
  ShipmentCreateInput,
  ShipmentKind,
  WindowPreset,
} from "@domy/domain";
import type { NeighborhoodOption, NamedOption } from "./api";

/** What the registration form holds; turned into `ShipmentCreateInput` on save. */
export type ShipmentFormValues = {
  kind: ShipmentKind;
  merchant: NamedOption | null;
  pickupPointId: string | null;
  pickupAddress: string;
  pickupNeighborhood: NeighborhoodOption | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientNeighborhood: NeighborhoodOption | null;
  handoffPlace: NeighborhoodOption | null;
  carrierId: string;
  destinationTown: string;
  errandDescription: string;
  paymentMode: PaymentMode;
  codAmount: number | null;
  serviceLevel: ServiceLevel;
  fee: number | null;
  feeOverridden: boolean;
  feeOverrideReason: string;
  serviceDate: string;
  window: { preset: "none" | WindowPreset["preset"]; start: string; end: string };
  packageSize: PackageSize | "";
  packageCount: string;
  merchantReference: string;
  instructions: string;
};

/** A one-off pickup address instead of one of the merchant's pickup points. */
export const otherPickupAddress = "other";

export function emptyShipmentForm(serviceDate: string): ShipmentFormValues {
  return {
    kind: "delivery",
    merchant: null,
    pickupPointId: null,
    pickupAddress: "",
    pickupNeighborhood: null,
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    recipientNeighborhood: null,
    handoffPlace: null,
    carrierId: "",
    destinationTown: "",
    errandDescription: "",
    paymentMode: "cash_on_delivery",
    codAmount: null,
    serviceLevel: "standard",
    fee: null,
    feeOverridden: false,
    feeOverrideReason: "",
    serviceDate,
    window: { preset: "none", start: "", end: "" },
    packageSize: "",
    packageCount: "",
    merchantReference: "",
    instructions: "",
  };
}

export function windowPresetOf(values: ShipmentFormValues): WindowPreset | null {
  const { preset, start, end } = values.window;
  switch (preset) {
    case "none":
      return null;
    case "morning":
    case "afternoon":
      return { preset };
    case "before":
      return { preset, end };
    case "after":
      return { preset, start };
    case "between":
      return { preset, start, end };
  }
}

/** The neighborhood that prices the shipment (FR-006). */
export function pricingNeighborhood(values: ShipmentFormValues): NeighborhoodOption | null {
  if (values.kind === "errand") return null;
  return values.kind === "carrier_handoff" ? values.handoffPlace : values.recipientNeighborhood;
}

const text = (value: string) => value.trim() || undefined;

export function toCreateInput(
  values: ShipmentFormValues,
  id: string,
  confirmed: boolean,
): ShipmentCreateInput {
  const oneOff = values.pickupPointId === otherPickupAddress || !values.pickupPointId;
  const common = {
    id,
    merchantId: values.merchant?.id ?? "",
    serviceDate: values.serviceDate,
    pickupPointId: oneOff ? null : values.pickupPointId,
    ...(oneOff && {
      pickupAddress: text(values.pickupAddress),
      pickupNeighborhoodId: values.pickupNeighborhood?.id,
    }),
    serviceLevel: values.serviceLevel,
    fee: values.fee ?? 0,
    feeOverrideReason: text(values.feeOverrideReason),
    paymentMode: values.paymentMode,
    codAmount: values.codAmount ?? undefined,
    window: windowPresetOf(values),
    packageSize: values.packageSize || undefined,
    packageCount: values.packageCount ? Number(values.packageCount) : undefined,
    merchantReference: text(values.merchantReference),
    instructions: text(values.instructions),
    confirmed,
  };
  switch (values.kind) {
    case "delivery":
    case "reverse_pickup":
      return {
        ...common,
        kind: values.kind,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone.replace(/\D/g, ""),
        recipientAddress: values.recipientAddress,
        recipientNeighborhoodId: values.recipientNeighborhood?.id ?? "",
      };
    case "carrier_handoff":
      return {
        ...common,
        kind: values.kind,
        recipientNeighborhoodId: values.handoffPlace?.id ?? "",
        carrierId: values.carrierId,
        destinationTown: values.destinationTown,
        recipientName: text(values.recipientName),
        recipientPhone: text(values.recipientPhone.replace(/\D/g, "")),
      };
    case "errand":
      return { ...common, kind: values.kind, errandDescription: values.errandDescription };
  }
}

/** Where an API or schema field error is shown in the form. */
export function formFieldOf(kind: ShipmentKind, path: string): keyof ShipmentFormValues | "root" {
  const map: Record<string, keyof ShipmentFormValues> = {
    merchantId: "merchant",
    pickupPointId: "pickupPointId",
    pickupAddress: "pickupAddress",
    pickupNeighborhoodId: "pickupNeighborhood",
    recipientNeighborhoodId: kind === "carrier_handoff" ? "handoffPlace" : "recipientNeighborhood",
    recipientName: "recipientName",
    recipientPhone: "recipientPhone",
    recipientAddress: "recipientAddress",
    carrierId: "carrierId",
    destinationTown: "destinationTown",
    errandDescription: "errandDescription",
    codAmount: "codAmount",
    fee: "fee",
    feeOverrideReason: "feeOverrideReason",
    window: "window",
    "window.start": "window",
    "window.end": "window",
    packageCount: "packageCount",
    serviceDate: "serviceDate",
  };
  return map[path] ?? "root";
}
