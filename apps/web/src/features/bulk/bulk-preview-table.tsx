import {
  bulkColumnOf,
  formatTrackingNumber,
  paymentModeLabels,
  shipmentKindLabels,
  type BulkConfirmation,
  type BulkPreviewRow,
} from "@domy/domain";
import { SearchCombobox } from "@/components/search-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { searchNeighborhoods, type NeighborhoodOption } from "@/features/shipments/api";
import { formatCop, formatDate } from "@/lib/format";

/** A preview row's state once the dispatcher's confirmations are counted. */
export function rowState(row: BulkPreviewRow, accepted: ReadonlySet<BulkConfirmation>) {
  if (row.status === "invalid") return "invalid" as const;
  return row.confirmations.every((confirmation) => accepted.has(confirmation))
    ? ("ready" as const)
    : ("needs_confirmation" as const);
}

const stateBadges = {
  ready: <Badge variant="success">Lista</Badge>,
  needs_confirmation: <Badge variant="warning">Por confirmar</Badge>,
  invalid: <Badge variant="destructive">Con errores</Badge>,
};

/** "Laureles, Medellín"; a municipality is named once. */
function placeName(place: { name: string; municipality: string }): string {
  return place.name === place.municipality ? place.name : `${place.name}, ${place.municipality}`;
}

function windowText(window: BulkPreviewRow["input"]["window"]): string {
  if (!window) return "";
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

/**
 * The row-by-row preview (FR-020): parsed values, fee, the neighborhood found, and each
 * problem named by its template column; confirmations are given here, row by row.
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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fila</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Destinatario</TableHead>
          <TableHead>Barrio</TableHead>
          <TableHead>Modalidad</TableHead>
          <TableHead>Franja</TableHead>
          <TableHead className="text-right">Tarifa</TableHead>
          <TableHead>Revisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const done = accepted.get(index) ?? new Set<BulkConfirmation>();
          const pending = row.confirmations.filter((confirmation) => !done.has(confirmation));
          const { input, neighborhoodMatch: match } = row;
          return (
            <TableRow key={index} className="align-top">
              <TableCell className="tabular-nums">{index + 1}</TableCell>
              <TableCell>{stateBadges[rowState(row, done)]}</TableCell>
              <TableCell>{input.merchantReference}</TableCell>
              <TableCell>{input.serviceDate ? formatDate(input.serviceDate) : "Hoy"}</TableCell>
              <TableCell>{shipmentKindLabels[input.kind]}</TableCell>
              <TableCell>{(input as { recipientName?: string }).recipientName}</TableCell>
              <TableCell>{match && placeName(match)}</TableCell>
              <TableCell>
                {paymentModeLabels[input.paymentMode]}
                {input.paymentMode === "cash_on_delivery" && input.codAmount !== undefined && (
                  <span className="block tabular-nums">{formatCop(input.codAmount)}</span>
                )}
              </TableCell>
              <TableCell>{windowText(input.window)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {input.fee > 0 ? formatCop(input.fee) : "—"}
              </TableCell>
              <TableCell className="whitespace-normal">
                <ul className="flex min-w-72 flex-col gap-2 text-body-m">
                  {Object.entries(row.errors).map(([field, message]) => (
                    <li key={field} className="text-error">
                      {bulkColumnOf[field] ?? "Fila"}: {message}
                    </li>
                  ))}
                  {pending.includes("neighborhood") && match && (
                    <li className="flex flex-col gap-2">
                      <span>No encontramos el barrio exacto; ¿es {placeName(match)}?</span>
                      <Button
                        variant="secondary"
                        className="self-start"
                        onClick={() => {
                          onAccept(index, "neighborhood");
                        }}
                      >
                        Confirmar {match.name}
                      </Button>
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
                    </li>
                  )}
                  {pending.includes("duplicate") && (
                    <li className="flex flex-col gap-2">
                      <span>
                        Posible duplicado de {row.duplicateOf.map(formatTrackingNumber).join(", ")}.
                      </span>
                      <Button
                        variant="secondary"
                        className="self-start"
                        onClick={() => {
                          onAccept(index, "duplicate");
                        }}
                      >
                        Crear de todos modos
                      </Button>
                    </li>
                  )}
                  {pending.includes("amount") && (
                    <li className="flex flex-col gap-2">
                      <span>La tarifa supera $ 100.000 o el recaudo supera $ 2.000.000.</span>
                      <Button
                        variant="secondary"
                        className="self-start"
                        onClick={() => {
                          onAccept(index, "amount");
                        }}
                      >
                        Confirmar valores
                      </Button>
                    </li>
                  )}
                </ul>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
