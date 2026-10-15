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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

const all = "all";

function distinct(items: ({ id: string; name: string } | null)[]) {
  const byId = new Map(items.filter((item) => item !== null).map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** The shipments collected at one pickup place, with a checkbox for each and one for all. */
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
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-title-m text-on-surface">
        {first.pickupPoint?.label ?? "Otra dirección"} · {first.merchant.name}
        <span className="block text-body-m text-on-surface-variant">
          {first.pickupAddress}, {first.pickupNeighborhood.name}
        </span>
      </h3>
      <Table className="min-w-[44rem] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 py-0">
              <label className="flex size-12 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  aria-label={`Elegir los envíos de ${place}`}
                  checked={chosen === ids.length}
                  ref={(input) => {
                    if (input) input.indeterminate = chosen > 0 && chosen < ids.length;
                  }}
                  onChange={(event) => {
                    onToggle(ids, event.target.checked);
                  }}
                />
              </label>
            </TableHead>
            <TableHead className="w-40">Guía</TableHead>
            <TableHead>Destinatario</TableHead>
            <TableHead className="w-56">Franja</TableHead>
            <TableHead className="w-32 text-right">Recaudo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.map((shipment) => {
            const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
            const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
            const checked = selected.includes(shipment.id);
            return (
              <TableRow key={shipment.id} data-state={checked ? "selected" : undefined}>
                <TableCell className="py-0">
                  <label className="flex size-12 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      aria-label={`Elegir ${formatTrackingNumber(shipment.trackingNumber)}`}
                      checked={checked}
                      onChange={(event) => {
                        onToggle([shipment.id], event.target.checked);
                      }}
                    />
                  </label>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="truncate">
                  {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
                  <span className="block truncate text-body-s text-on-surface-variant">
                    {[shipment.recipientNeighborhood?.name, shipment.rateZone?.name]
                      .filter(Boolean)
                      .join(" · ") || "Sin barrio"}
                  </span>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {shipment.codAmount > 0 ? (
                    formatCop(shipment.codAmount)
                  ) : (
                    <span className="text-on-surface-variant">Sin recaudo</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
    <div className="flex flex-col gap-6">
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
