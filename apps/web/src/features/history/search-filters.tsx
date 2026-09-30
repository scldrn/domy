import { shipmentStatuses, shipmentStatusLabels } from "@domy/domain";
import { useState } from "react";
import { OptionSelect } from "@/components/option-select";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { searchNeighborhoods, type NeighborhoodOption } from "@/features/shipments/api";
import type { HistoryFilters } from "./api";

const anyStatus = "all";

/** History filters (FR-024); the text search applies on Enter or with the button. */
export function SearchFilters({
  filters,
  onChange,
}: {
  filters: HistoryFilters;
  onChange: (next: Partial<HistoryFilters>) => void;
}) {
  const [text, setText] = useState(filters.q ?? "");
  const [place, setPlace] = useState<NeighborhoodOption | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex max-w-3xl items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ q: text.trim() || undefined });
        }}
      >
        <Field className="flex-1">
          <FieldLabel htmlFor="history-q">Buscar</FieldLabel>
          <Input
            id="history-q"
            type="search"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            placeholder="Guía, referencia, cliente, destinatario o teléfono"
          />
        </Field>
        <Button type="submit">Buscar</Button>
      </form>
      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-44">
          <FieldLabel htmlFor="history-from">Desde</FieldLabel>
          <Input
            id="history-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => {
              onChange({ from: event.target.value || undefined });
            }}
          />
        </Field>
        <Field className="w-44">
          <FieldLabel htmlFor="history-to">Hasta</FieldLabel>
          <Input
            id="history-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => {
              onChange({ to: event.target.value || undefined });
            }}
          />
        </Field>
        <Field className="w-48">
          <OptionSelect
            label="Estado"
            value={filters.status ?? anyStatus}
            onChange={(value) => {
              onChange({ status: value === anyStatus ? undefined : value });
            }}
            options={[
              { value: anyStatus, label: "Todos los estados" },
              ...shipmentStatuses.map((status) => ({
                value: status,
                label: shipmentStatusLabels[status],
              })),
            ]}
          />
        </Field>
        <Field className="w-64">
          <FieldLabel htmlFor="history-place">Barrio</FieldLabel>
          {filters.neighborhoodId && !place ? (
            <Button
              variant="outline"
              onClick={() => {
                onChange({ neighborhoodId: undefined });
              }}
            >
              Quitar el filtro de barrio
            </Button>
          ) : (
            <SearchCombobox<NeighborhoodOption>
              id="history-place"
              label="Barrio"
              queryKey={["neighborhoods"]}
              search={searchNeighborhoods}
              value={place}
              onChange={(next) => {
                setPlace(next);
                onChange({ neighborhoodId: next?.id });
              }}
              itemKey={(option) => option.id}
              itemLabel={(option) => option.name}
              placeholder="Cualquier barrio"
            />
          )}
        </Field>
        <Toggle
          pressed={filters.feeReview === "true"}
          onPressedChange={(pressed) => {
            onChange({ feeReview: pressed ? "true" : undefined });
          }}
        >
          Tarifa por revisar
        </Toggle>
      </div>
    </div>
  );
}
