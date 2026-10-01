import {
  flagLabel,
  formatTrackingNumber,
  shipmentFlag,
  type UnassignedShipment,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { OptionSelect } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

const all = "all";

function distinct(items: ({ id: string; name: string } | null)[]) {
  const byId = new Map(items.filter((item) => item !== null).map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Shipments on no route, grouped by pickup place and ordered by rate zone and neighborhood
 * (FR-001), to select the ones that form a route.
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
  const groups = new Map<string, UnassignedShipment[]>();
  for (const shipment of visible) {
    const key = `${shipment.pickupAddress}|${shipment.pickupNeighborhood.id}`;
    groups.set(key, [...(groups.get(key) ?? []), shipment]);
  }

  if (shipments.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container-low p-6 text-body-l text-on-surface-variant">
        No hay envíos sin asignar hasta el {formatDate(date)}.{" "}
        <Link to="/envios/nuevo" className="text-primary underline">
          Registrar un envío
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <Field className="w-56">
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
        <Field className="w-56">
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
      {[...groups.values()].map((group) => {
        const [first] = group;
        if (!first) return null;
        const ids = group.map((shipment) => shipment.id);
        const allChecked = ids.every((id) => selected.includes(id));
        return (
          <section
            key={`${first.pickupAddress}|${first.pickupNeighborhood.id}`}
            className="rounded-lg bg-surface-container-low p-3"
            aria-label={`Recogida en ${first.pickupPoint?.label ?? first.pickupAddress}`}
          >
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-1">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={allChecked}
                onChange={(event) => {
                  onToggle(ids, event.target.checked);
                }}
              />
              <span className="text-title-s text-on-surface">
                {first.pickupPoint?.label ?? "Otra dirección"} · {first.merchant.name}
                <span className="block text-body-m text-on-surface-variant">
                  {first.pickupAddress}, {first.pickupNeighborhood.name}
                </span>
              </span>
            </label>
            <ul className="mt-1 flex flex-col">
              {group.map((shipment) => {
                const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
                const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
                return (
                  <li key={shipment.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm px-1 hover:bg-surface-container">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={selected.includes(shipment.id)}
                        onChange={(event) => {
                          onToggle([shipment.id], event.target.checked);
                        }}
                      />
                      <span className="grid flex-1 grid-cols-[6rem_1fr_auto] items-center gap-x-3 text-body-m">
                        <span className="tabular-nums">
                          {formatTrackingNumber(shipment.trackingNumber)}
                        </span>
                        <span>
                          {shipment.recipientName ?? shipment.merchant.name}
                          <span className="block text-on-surface-variant">
                            {[shipment.recipientNeighborhood?.name, shipment.rateZone?.name]
                              .filter(Boolean)
                              .join(" · ")}
                            {shipment.serviceDate < date &&
                              ` · ${formatDate(shipment.serviceDate)}`}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          {formatWindow(shipment.windowStart, shipment.windowEnd)}
                          {shipment.codAmount > 0 && (
                            <span className="tabular-nums">{formatCop(shipment.codAmount)}</span>
                          )}
                          {flag && (
                            <Badge variant={flag.kind === "late" ? "destructive" : "warning"}>
                              {flagLabel(flag)}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
