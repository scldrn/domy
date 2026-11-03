import { shipmentKindLabels, shipmentKinds, type ShipmentKind } from "@domy/domain";
import DeliveryIcon from "@material-symbols/svg-400/rounded/package_2.svg?react";
import ReverseIcon from "@material-symbols/svg-400/rounded/assignment_return.svg?react";
import CarrierIcon from "@material-symbols/svg-400/rounded/local_shipping.svg?react";
import ErrandIcon from "@material-symbols/svg-400/rounded/directions_run.svg?react";
import { useId } from "react";
import { Icon, type Symbol } from "@/components/icon";

const kinds: Record<ShipmentKind, { icon: Symbol; hint: string }> = {
  delivery: { icon: DeliveryIcon, hint: "Del cliente al destinatario" },
  reverse_pickup: { icon: ReverseIcon, hint: "Del destinatario al cliente" },
  carrier_handoff: { icon: CarrierIcon, hint: "A una oficina para otra ciudad" },
  errand: { icon: ErrandIcon, hint: "Una vuelta con tarifa a mano" },
};

/**
 * The shipment's kind as four cards (feature 006, approved "Nuevo envío" proposal): its icon,
 * its name, and one line of what it is. Each card is a toggle button named by the kind alone,
 * so the line only describes it.
 */
export function KindPicker({
  value,
  onChange,
}: {
  value: ShipmentKind;
  onChange: (kind: ShipmentKind) => void;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-label="Tipo de envío"
      className="grid grid-cols-4 gap-2 max-[1100px]:grid-cols-2"
    >
      {shipmentKinds.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={value === kind}
          aria-describedby={`${id}-${kind}`}
          onClick={() => {
            onChange(kind);
          }}
          className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-outline-variant bg-sheet px-3.5 py-2.5 text-left text-on-surface transition-colors hover:border-outline hover:bg-sheet-alt aria-pressed:border-on-surface aria-pressed:bg-on-surface aria-pressed:text-surface"
        >
          <Icon symbol={kinds[kind].icon} size={20} />
          <span className="min-w-0">
            <span className="block text-label-l font-bold">{shipmentKindLabels[kind]}</span>
            <span id={`${id}-${kind}`} className="block text-body-s opacity-80">
              {kinds[kind].hint}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
