import FilterOffIcon from "@material-symbols/svg-400/rounded/filter_alt_off.svg?react";
import {
  shipmentFlagLabels,
  type BoardFlag,
  type BoardQuery,
  type ShipmentStatus,
} from "@domy/domain";
import { Icon } from "@/components/icon";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { StatusTabs } from "./status-tabs";

const all = "all";
const flagLabels: Record<BoardFlag, string> = {
  ...shipmentFlagLabels,
  fee_review: "Tarifa por revisar",
};
const flags = Object.keys(flagLabels) as BoardFlag[];

/**
 * Status tabs, then the alert chips beside the merchant and rate zone pickers (FR-023). The
 * date lives in the page heading, where it names the day.
 */
export function BoardFilters({
  filters,
  merchants,
  rateZones,
  counts,
  onChange,
}: {
  filters: BoardQuery;
  merchants: { id: string; name: string }[];
  rateZones: { id: string; name: string }[];
  /** Shipments per status; the tabs appear once the board has loaded. */
  counts: Record<ShipmentStatus, number> | null;
  onChange: (next: Partial<BoardQuery>) => void;
}) {
  const filtered = Boolean(
    filters.merchantId ?? filters.rateZoneId ?? filters.flag ?? filters.status,
  );
  return (
    <div className="flex flex-col gap-3">
      {counts && (
        <StatusTabs
          counts={counts}
          selected={filters.status}
          onSelect={(status) => {
            onChange({ status });
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Alertas">
          {flags.map((flag) => (
            <Toggle
              key={flag}
              pressed={filters.flag === flag}
              onPressedChange={(pressed) => {
                onChange({ flag: pressed ? flag : undefined });
              }}
            >
              {flagLabels[flag]}
            </Toggle>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Field className="w-full sm:w-56">
            <OptionSelect
              label="Cliente"
              hideLabel
              value={filters.merchantId ?? all}
              onChange={(value) => {
                onChange({ merchantId: value === all ? undefined : value });
              }}
              options={[
                { value: all, label: "Todos los clientes" },
                ...merchants.map((merchant) => ({ value: merchant.id, label: merchant.name })),
              ]}
            />
          </Field>
          <Field className="w-full sm:w-56">
            <OptionSelect
              label="Zona tarifaria"
              hideLabel
              value={filters.rateZoneId ?? all}
              onChange={(value) => {
                onChange({ rateZoneId: value === all ? undefined : value });
              }}
              options={[
                { value: all, label: "Todas las zonas" },
                ...rateZones.map((zone) => ({ value: zone.id, label: zone.name })),
              ]}
            />
          </Field>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                onChange({
                  merchantId: undefined,
                  rateZoneId: undefined,
                  flag: undefined,
                  status: undefined,
                });
              }}
            >
              <Icon symbol={FilterOffIcon} size={20} />
              Quitar filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
