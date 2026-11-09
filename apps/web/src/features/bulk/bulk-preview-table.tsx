import {
  bulkColumnOf,
  formatTrackingNumber,
  paymentModeLabels,
  shipmentKindLabels,
  type BulkConfirmation,
  type BulkPreviewRow,
} from "@domy/domain";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { searchNeighborhoods, type NeighborhoodOption } from "@/features/shipments/api";
import { cn } from "@/lib/cn";
import { formatCop, formatDate } from "@/lib/format";

/** A preview row's state once the dispatcher's confirmations are counted. */
export function rowState(row: BulkPreviewRow, accepted: ReadonlySet<BulkConfirmation>) {
  if (row.status === "invalid") return "invalid" as const;
  return row.confirmations.every((confirmation) => accepted.has(confirmation))
    ? ("ready" as const)
    : ("needs_confirmation" as const);
}
type RowState = ReturnType<typeof rowState>;

/** Each state's mark: color, shape, and label, so color is never the only signal (FR-006). */
const marks: Record<RowState, { label: string; plural: string; className: string }> = {
  ready: { label: "Lista", plural: "Listas", className: "text-success before:bg-success" },
  needs_confirmation: {
    label: "Por confirmar",
    plural: "Por confirmar",
    className:
      "text-warning before:bg-transparent before:ring-2 before:ring-warning before:ring-inset",
  },
  invalid: {
    label: "Con errores",
    plural: "Con errores",
    className: "text-error before:rounded-[3px] before:bg-error",
  },
};

/** "Laureles, Medellín"; a municipality is named once. */
function placeName(place: { name: string; municipality: string }): string {
  return place.name === place.municipality ? place.name : `${place.name}, ${place.municipality}`;
}

function windowText(window: BulkPreviewRow["input"]["window"]): string {
  if (!window) return "Sin franja";
  switch (window.preset) {
    case "morning":
      return "En la mañana";
    case "afternoon":
      return "En la tarde";
    case "before":
      return `Antes de las ${window.end}`;
    case "after":
      return `Después de las ${window.start}`;
    case "between":
      return `${window.start} – ${window.end}`;
  }
}

const columns = "grid-cols-[5.5rem_8.5rem_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_6rem]";

/**
 * The review of a pasted list (FR-020, approved "Registro masivo"): tabs by row state, then one
 * row per line with its number and reference, state, recipient and neighborhood, kind and
 * payment, window and date, and fee; under it, each problem named by its template column and
 * the confirmations it asks for, given here row by row.
 */
export function BulkPreviewTable({
  rows,
  accepted,
  onAccept,
  onChooseNeighborhood,
}: {
  rows: BulkPreviewRow[];
  accepted: ReadonlyMap<number, ReadonlySet<BulkConfirmation>>;
  onAccept: (row: number, confirmation: BulkConfirmation) => void;
  onChooseNeighborhood: (row: number, place: NeighborhoodOption) => void;
}) {
  const [shown, setShown] = useState<RowState | undefined>(undefined);
  const states = rows.map((row, index) => rowState(row, accepted.get(index) ?? new Set()));
  const tabs: { key: RowState | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Todas", count: rows.length },
    ...(Object.keys(marks) as RowState[]).map((key) => ({
      key,
      label: marks[key].plural,
      count: states.filter((state) => state === key).length,
    })),
  ];
  const visible = rows.flatMap((row, index) =>
    !shown || states[index] === shown ? [{ row, index }] : [],
  );
  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-label="Filas por estado"
        className="relative -mx-1.5 mb-1 flex overflow-x-auto border-b border-outline-variant [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key ?? "all"}
            type="button"
            aria-pressed={shown === tab.key}
            onClick={() => {
              setShown(tab.key);
            }}
            className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-label-l whitespace-nowrap text-on-surface-variant after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full hover:text-on-surface aria-pressed:font-bold aria-pressed:text-on-surface aria-pressed:after:bg-on-surface"
          >
            {tab.label} <span className="font-normal tabular-nums">{tab.count}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-title-s text-on-surface">
          Ninguna fila con ese estado.
        </p>
      ) : (
        <div role="table" aria-label="Filas revisadas">
          <div role="rowgroup" className="max-[820px]:hidden">
            <div
              role="row"
              className={cn("grid gap-x-3.5 py-2 text-label-m text-on-surface-variant", columns)}
            >
              <span role="columnheader">Fila</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Destinatario</span>
              <span role="columnheader">Tipo y pago</span>
              <span role="columnheader">Franja</span>
              <span role="columnheader" className="text-right">
                Tarifa
              </span>
              <span role="columnheader" className="sr-only">
                Revisión
              </span>
            </div>
          </div>
          <div role="rowgroup">
            {visible.map(({ row, index }) => {
              const done = accepted.get(index) ?? new Set<BulkConfirmation>();
              const pending = row.confirmations.filter((confirmation) => !done.has(confirmation));
              const { input, neighborhoodMatch: match } = row;
              const state = states[index] ?? "invalid";
              const recipient = (input as { recipientName?: string }).recipientName;
              const errand = (input as { errandDescription?: string }).errandDescription;
              const hasIssues =
                Object.keys(row.errors).length > 0 || row.warnings.length > 0 || pending.length > 0;
              return (
                <div
                  key={index}
                  role="row"
                  className={cn(
                    "grid items-start gap-x-3.5 gap-y-1 border-t border-outline-variant py-3 max-[820px]:grid-cols-[minmax(0,1fr)_auto]",
                    columns,
                  )}
                >
                  <div role="cell" className="max-[820px]:col-span-2">
                    <span className="block font-bold text-on-surface-variant tabular-nums">
                      Fila {index + 1}
                    </span>
                    {input.merchantReference && (
                      <span className="block truncate text-body-s text-on-surface-variant">
                        {input.merchantReference}
                      </span>
                    )}
                  </div>
                  <div role="cell" className="max-[820px]:-order-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 text-label-l whitespace-nowrap before:size-2.5 before:shrink-0 before:rounded-full before:content-['']",
                        marks[state].className,
                      )}
                    >
                      {marks[state].label}
                    </span>
                  </div>
                  <div role="cell" className="min-w-0">
                    <span className="block truncate font-semibold text-on-surface">
                      {recipient ?? errand ?? shipmentKindLabels[input.kind]}
                    </span>
                    <span className="block truncate text-body-s text-on-surface-variant">
                      {match ? placeName(match) : "Sin barrio"}
                    </span>
                  </div>
                  <div role="cell" className="min-w-0">
                    <span className="block">{shipmentKindLabels[input.kind]}</span>
                    <span className="block text-body-s text-on-surface-variant">
                      {paymentModeLabels[input.paymentMode]}
                      {input.paymentMode === "cash_on_delivery" &&
                        input.codAmount !== undefined && (
                          <span className="whitespace-nowrap"> · {formatCop(input.codAmount)}</span>
                        )}
                    </span>
                  </div>
                  <div role="cell" className="min-w-0">
                    <span className="block">{windowText(input.window)}</span>
                    <span className="block text-body-s text-on-surface-variant">
                      {input.serviceDate ? formatDate(input.serviceDate) : "Hoy"}
                    </span>
                  </div>
                  <div
                    role="cell"
                    className="text-right font-semibold tabular-nums max-[820px]:-order-1"
                  >
                    {input.fee > 0 ? formatCop(input.fee) : "—"}
                  </div>
                  <div role="cell" className="col-span-full">
                    {hasIssues && (
                      <ul className="mt-1.5 flex flex-col gap-2 pl-[6.375rem] text-body-m max-[820px]:pl-0">
                        {Object.entries(row.errors).map(([field, message]) => (
                          <li
                            key={field}
                            className="flex items-start gap-1.5 font-semibold text-error"
                          >
                            <Icon symbol={ErrorIcon} size={20} />
                            {bulkColumnOf[field] ?? "Fila"}: {message}
                          </li>
                        ))}
                        {row.warnings.map((warning) => (
                          <li key={warning} className="text-on-surface-variant">
                            {warning}
                          </li>
                        ))}
                        {pending.includes("neighborhood") && match && (
                          <Ask text={`No encontramos el barrio exacto; ¿es ${placeName(match)}?`}>
                            <Button
                              variant="outline"
                              className="h-10"
                              onClick={() => {
                                onAccept(index, "neighborhood");
                              }}
                            >
                              Confirmar {match.name}
                            </Button>
                            <div className="w-56 max-[820px]:w-full">
                              <SearchCombobox<NeighborhoodOption>
                                id={`bulk-place-${String(index)}`}
                                label={`Otro barrio para la fila ${String(index + 1)}`}
                                queryKey={["neighborhoods"]}
                                search={searchNeighborhoods}
                                value={null}
                                onChange={(place) => {
                                  if (place) onChooseNeighborhood(index, place);
                                }}
                                itemKey={(place) => place.id}
                                itemLabel={(place) => place.name}
                                placeholder="Otro barrio"
                              />
                            </div>
                          </Ask>
                        )}
                        {pending.includes("duplicate") && (
                          <Ask
                            text={`Posible duplicado de ${row.duplicateOf.map(formatTrackingNumber).join(", ")}.`}
                          >
                            <Button
                              variant="outline"
                              className="h-10"
                              onClick={() => {
                                onAccept(index, "duplicate");
                              }}
                            >
                              Crear de todos modos
                            </Button>
                          </Ask>
                        )}
                        {pending.includes("amount") && (
                          <Ask text="La tarifa supera $ 100.000 o el recaudo supera $ 2.000.000.">
                            <Button
                              variant="outline"
                              className="h-10"
                              onClick={() => {
                                onAccept(index, "amount");
                              }}
                            >
                              Confirmar valores
                            </Button>
                          </Ask>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** A question the row asks before it can be created, with its answers. */
function Ask({ text, children }: { text: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-warning-container px-3 py-2.5 text-on-warning-container">
      <span className="min-w-56 flex-1">{text}</span>
      {children}
    </li>
  );
}
