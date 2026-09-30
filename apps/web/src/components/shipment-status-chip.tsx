import AssignedIcon from "@material-symbols/svg-400/rounded/assignment_ind.svg?react";
import VoidedIcon from "@material-symbols/svg-400/rounded/block.svg?react";
import DeliveredIcon from "@material-symbols/svg-400/rounded/check_circle.svg?react";
import RegisteredIcon from "@material-symbols/svg-400/rounded/inventory_2.svg?react";
import DispatchedIcon from "@material-symbols/svg-400/rounded/local_shipping.svg?react";
import PickedUpIcon from "@material-symbols/svg-400/rounded/package_2.svg?react";
import ExceptionIcon from "@material-symbols/svg-400/rounded/report.svg?react";
import ReturnedIcon from "@material-symbols/svg-400/rounded/undo.svg?react";
import { shipmentStatusLabels, type ShipmentStatus } from "@domy/domain";
import { cn } from "cn";
import { Icon, type Symbol } from "./icon";

/** Shipment state chip: label + icon + color role, identical on every surface (§8). */
const appearance: Record<ShipmentStatus, { icon: Symbol; className: string }> = {
  registered: {
    icon: RegisteredIcon,
    className: "bg-surface-container-high text-on-surface-variant",
  },
  assigned: { icon: AssignedIcon, className: "bg-secondary-container text-on-secondary-container" },
  dispatched: { icon: DispatchedIcon, className: "bg-info-container text-on-info-container" },
  picked_up: { icon: PickedUpIcon, className: "bg-info-container text-on-info-container" },
  delivered: { icon: DeliveredIcon, className: "bg-success-container text-on-success-container" },
  exception: { icon: ExceptionIcon, className: "bg-error-container text-on-error-container" },
  returned: { icon: ReturnedIcon, className: "bg-warning-container text-on-warning-container" },
  voided: { icon: VoidedIcon, className: "border border-outline-variant text-on-surface-variant" },
};

export function ShipmentStatusChip({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  const { icon, className: colors } = appearance[status];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-sm px-3 text-label-l whitespace-nowrap",
        colors,
        className,
      )}
    >
      <Icon symbol={icon} size={20} />
      {shipmentStatusLabels[status]}
    </span>
  );
}
