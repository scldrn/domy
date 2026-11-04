import FilterAltOffIcon from "@material-symbols/svg-400/rounded/filter_alt_off.svg?react";
import Inventory2Icon from "@material-symbols/svg-400/rounded/inventory_2.svg?react";
import {
  flagLabel,
  formatTrackingNumber,
  shipmentFlag,
  shipmentKindLabels,
  type UnassignedShipment,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { OptionSelect } from "@/components/option-select";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

const all = "all";

function distinct(items: ({ id: string; name: string } | null)[]) {
  const byId = new Map(items.filter((item) => item !== null).map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** A checkbox at 48 × 48 px (Constitution VII), in slate when checked. */
function Check({
  label,
  checked,
  mixed = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  mixed?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex size-12 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-5 accent-primary"
        aria-label={label}
        checked={checked}
        ref={(input) => {
          if (input) input.indeterminate = mixed;
        }}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

/**
 * The shipments collected at one pickup place, with a checkbox for each and one for all
 * (approved «Rutas», feature 006): tracking number, recipient and place, window and its flag,
 * and the COD amount.
 */
function PickupGroup({
  group,
  date,
  now,
  selected,
  onToggle,
}: {
  group: [UnassignedShipment, ...UnassignedShipment[]];
  date: string;
  now: Date;
  selected: string[];
  onToggle: (ids: string[], checked: boolean) => void;
}) {
  const headingId = useId();
  const [first] = group;
  const place = first.pickupPoint?.label ?? first.pickupAddress;
  const ids = group.map((shipment) => shipment.id);
  const chosen = ids.filter((id) => selected.includes(id)).length;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col border-t border-outline-variant pt-2.5"
    >
      <div className="flex items-center gap-1">
        <Check
          label={`Elegir los envíos de ${place}`}
          checked={chosen === ids.length}
          mixed={chosen > 0 && chosen < ids.length}
          onChange={(checked) => {
            onToggle(ids, checked);
          }}
        />
        <h3 id={headingId} className="min-w-0 text-body-l text-on-surface">
          <span className="font-semibold">{first.pickupPoint?.label ?? "Otra dirección"}</span>
          <span className="text-body-m text-on-surface-variant">
            {" "}
            · {first.merchant.name} ·{" "}
            {group.length === 1 ? "1 envío" : `${String(group.length)} envíos`}
          </span>
          <span className="block text-body-s text-on-surface-variant">
            {first.pickupAddress}, {first.pickupNeighborhood.name}
          </span>
        </h3>
      </div>
      <ul aria-labelledby={headingId}>
        {group.map((shipment) => {
          const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
          const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
          const checked = selected.includes(shipment.id);
          return (
            <li
              key={shipment.id}
              data-state={checked ? "selected" : undefined}
              className="grid grid-cols-[3rem_7.5rem_minmax(0,1.3fr)_minmax(0,1fr)_7rem] items-center gap-x-3 border-t border-outline-variant py-1.5 text-body-m first:border-t-0 data-[state=selected]:rounded-md data-[state=selected]:border-transparent data-[state=selected]:bg-sheet-alt max-[820px]:grid-cols-[3rem_minmax(0,1fr)_auto] max-[820px]:items-start max-[820px]:gap-y-0.5 max-[820px]:py-2"
            >
              <span className="max-[820px]:row-span-3">
                <Check
                  label={`Elegir ${formatTrackingNumber(shipment.trackingNumber)}`}
                  checked={checked}
                  onChange={(next) => {
                    onToggle([shipment.id], next);
                  }}
                />
              </span>
              <span className="min-w-0">
                <Link
                  to="/envios/$trackingNumber"
                  params={{ trackingNumber: shipment.trackingNumber }}
                  className="guia rounded-xs text-title-m text-on-surface underline-offset-4 hover:underline"
                >
                  {formatTrackingNumber(shipment.trackingNumber)}
                </Link>
                {shipment.serviceDate < date && (
                  <span className="block text-body-s text-on-surface-variant">
                    Del {formatDate(shipment.serviceDate)}
                  </span>
                )}
                {shipment.heldBy && (
                  <span className="block text-body-s text-on-surface-variant">
                    {shipment.heldBy === "office"
                      ? "En oficina"
                      : `En custodia de ${shipment.heldBy.courier.name}`}
                  </span>
                )}
              </span>
              <span className="min-w-0 max-[820px]:col-start-2">
                <span className="block truncate font-semibold text-on-surface">
                  {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
                </span>
                <span className="block truncate text-body-s text-on-surface-variant">
                  {[shipment.recipientNeighborhood?.name, shipment.rateZone?.name]
                    .filter(Boolean)
                    .join(" · ") || "Sin barrio"}
                </span>
              </span>
              <span className="min-w-0 text-on-surface max-[820px]:col-start-2 max-[820px]:text-on-surface-variant">
                {formatWindow(shipment.windowStart, shipment.windowEnd) ?? (
                  <span className="text-on-surface-variant">Sin franja</span>
                )}
                {flag && (
                  <span
                    className={cn(
                      "block text-label-m",
                      flag.kind === "late" ? "text-error" : "text-warning",
                    )}
                  >
                    {flagLabel(flag)}
                  </span>
                )}
              </span>
              <span className="text-right font-semibold tabular-nums max-[820px]:col-start-3 max-[820px]:row-start-1">
                {shipment.codAmount > 0 ? (
                  formatCop(shipment.codAmount)
                ) : (
                  <span className="font-normal text-on-surface-variant">Sin recaudo</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Shipments on no route, grouped by pickup place and ordered by rate zone and neighborhood
 * (FR-001), to select the ones that form a route; with the empty states of FR-027.
 */
export function UnassignedList({
  shipments,
  date,
  now,
  selected,
  onToggle,
}: {
  shipments: UnassignedShipment[];
  date: string;
  now: Date;
  selected: string[];
  onToggle: (ids: string[], checked: boolean) => void;
}) {
  const [zone, setZone] = useState(all);
  const [merchant, setMerchant] = useState(all);
  const visible = shipments.filter(
    (shipment) =>
      (zone === all || shipment.rateZone?.id === zone) &&
      (merchant === all || shipment.merchant.id === merchant),
  );
  const groups = new Map<string, [UnassignedShipment, ...UnassignedShipment[]]>();
  for (const shipment of visible) {
    const key = `${shipment.merchant.id}|${shipment.pickupAddress}|${shipment.pickupNeighborhood.id}`;
    const group = groups.get(key);
    if (group) group.push(shipment);
    else groups.set(key, [shipment]);
  }

  if (shipments.length === 0) {
    return (
      <EmptyState
        icon={Inventory2Icon}
        title="No hay envíos sin asignar"
        description={`Todos los envíos registrados hasta el ${formatDate(date)} ya están en una ruta.`}
        action={
          <Link to="/envios/nuevo" className={buttonVariants({ variant: "outline" })}>
            Registrar un envío
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        <Field className="w-56 max-[820px]:w-auto max-[820px]:min-w-0 max-[820px]:flex-1">
          <OptionSelect
            label="Zona tarifaria"
            value={zone}
            onChange={setZone}
            options={[
              { value: all, label: "Todas las zonas" },
              ...distinct(shipments.map((shipment) => shipment.rateZone)).map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        </Field>
        <Field className="w-56 max-[820px]:w-auto max-[820px]:min-w-0 max-[820px]:flex-1">
          <OptionSelect
            label="Cliente"
            value={merchant}
            onChange={setMerchant}
            options={[
              { value: all, label: "Todos los clientes" },
              ...distinct(shipments.map((shipment) => shipment.merchant)).map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        </Field>
      </div>
      {groups.size === 0 ? (
        <EmptyState
          icon={FilterAltOffIcon}
          title="Ningún envío coincide con los filtros"
          description="Elige otra zona tarifaria u otro cliente."
        />
      ) : (
        [...groups.entries()].map(([key, group]) => (
          <PickupGroup
            key={key}
            group={group}
            date={date}
            now={now}
            selected={selected}
            onToggle={onToggle}
          />
        ))
      )}
    </div>
  );
}
