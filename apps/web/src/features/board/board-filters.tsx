import { shipmentFlagLabels, type BoardFlag, type BoardQuery } from "@domy/domain";
import { OptionSelect } from "@/components/option-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";

const all = "all";
const flagLabels: Record<BoardFlag, string> = {
  ...shipmentFlagLabels,
  fee_review: "Tarifa por revisar",
};
const flags = Object.keys(flagLabels) as BoardFlag[];

/** Date, merchant, rate zone, and flag filters of the board (FR-023). */
export function BoardFilters({
  date,
  filters,
  merchants,
  rateZones,
  onChange,
}: {
  date: string;
  filters: BoardQuery;
  merchants: { id: string; name: string }[];
  rateZones: { id: string; name: string }[];
  onChange: (next: Partial<BoardQuery>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field className="w-44">
        <FieldLabel htmlFor="board-date">Fecha</FieldLabel>
        <Input
          id="board-date"
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) onChange({ date: event.target.value });
          }}
        />
      </Field>
      <Field className="w-56">
        <OptionSelect
          label="Cliente"
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
      <Field className="w-56">
        <OptionSelect
          label="Zona tarifaria"
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
    </div>
  );
}
