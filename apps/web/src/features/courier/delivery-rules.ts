import { codConfirmationThreshold, type CourierTask } from "@domy/domain";

/**
 * Who received a delivery, proposed and editable (feature 003, FR-008): the recipient; the
 * carrier at a carrier handoff; the merchant at the end of a reverse pickup. An errand has no
 * received-by name.
 */
export function proposedReceivedBy(task: CourierTask): string {
  switch (task.shipmentKind) {
    case "carrier_handoff":
      return task.carrier?.name ?? "";
    case "reverse_pickup":
      return task.merchant.name;
    case "errand":
      return "";
    case "delivery":
      return task.recipientName ?? "";
  }
}

/** A collected total or a disbursement above COP 2.000.000 asks for confirmation (FR-011). */
export function needsAmountConfirmation(amount: number): boolean {
  return amount > codConfirmationThreshold;
}
