import FilterIcon from "@material-symbols/svg-400/rounded/filter_list.svg?react";
import { shipmentStatuses, shipmentStatusLabels } from "@domy/domain";
import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import { OptionSelect } from "@/components/option-select";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import { searchNeighborhoods, type NeighborhoodOption } from "@/features/shipments/api";
import type { HistoryFilters } from "./api";

const anyStatus = "all";

/** Every filter off, the text search included. */
export const noFilters: Required<{ [Key in keyof HistoryFilters]: undefined }> = {
  q: undefined,
  from: undefined,
  to: undefined,
  status: undefined,
  merchantId: undefined,
  neighborhoodId: undefined,
  feeReview: undefined,
};

/** Whether the search narrows the history in any way. */
export function isFiltered(filters: HistoryFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/**
 * History filters (FR-024; approved «Historial»): one sheet with the text search, which applies
 * on Enter or with «Buscar»; dates, state, and neighborhood below it, folded behind «Filtros»
 * under 820 px; then the fee-review chip and «Limpiar filtros».
 */
export function SearchFilters({
  filters,
  onChange,
}: {
  filters: HistoryFilters;
  onChange: (next: Partial<HistoryFilters>) => void;
}) {
  const [text, setText] = useState(filters.q ?? "");
  const [place, setPlace] = useState<NeighborhoodOption | null>(null);
  const [open, setOpen] = useState(false);
  const moreId = useId();
  const more = [filters.from, filters.to, filters.status, filters.neighborhoodId].filter(
    Boolean,
  ).length;

  return (
    <section
      aria-label="Buscar y filtrar envíos"
      className="flex flex-col gap-3.5 rounded-lg border border-outline-variant bg-sheet px-4.5 py-4 max-[820px]:px-3.5"
    >
      <form
        className="flex flex-wrap items-end gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ q: text.trim() || undefined });
        }}
      >
        <Field className="min-w-0 flex-[1_1_22.5rem] max-[820px]:basis-full">
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
        <Button type="submit" className="h-14">
          Buscar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 min-[821px]:hidden"
          aria-expanded={open}
          aria-controls={moreId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Icon symbol={FilterIcon} size={20} />
          {more > 0 ? `Filtros · ${String(more)}` : "Filtros"}
        </Button>
      </form>
      <div
        id={moreId}
        className={cn(
          "grid grid-cols-4 items-end gap-3 max-[820px]:grid-cols-2",
          !open && "max-[820px]:hidden",
        )}
      >
        <Field>
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
        <Field>
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
        <Field className="min-w-0">
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
        <Field className="min-w-0">
          <FieldLabel htmlFor="history-place">Barrio</FieldLabel>
          {filters.neighborhoodId && !place ? (
            <Button
              variant="outline"
              className="h-14"
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          pressed={filters.feeReview === "true"}
          onPressedChange={(pressed) => {
            onChange({ feeReview: pressed ? "true" : undefined });
          }}
        >
          Tarifa por revisar
        </Toggle>
        {isFiltered(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setPlace(null);
              onChange(noFilters);
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </section>
  );
}
