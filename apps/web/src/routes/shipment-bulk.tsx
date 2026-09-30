import {
  readBulkTable,
  type BulkConfirmation,
  type BulkPreviewRow,
  type ShipmentCreateInput,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { confirmBulk, previewBulk } from "@/features/bulk/api";
import { BulkInput, rowsToText, textToRows } from "@/features/bulk/bulk-input";
import { BulkPreviewTable, rowState } from "@/features/bulk/bulk-preview-table";
import { listPickupPoints, searchMerchants, type MerchantOption } from "@/features/shipments/api";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_panel/envios/masivo")({
  head: () => ({ meta: [{ title: "Registro masivo · Domy" }] }),
  component: ShipmentBulkPage,
});

type Preview = {
  cells: string[][];
  rows: BulkPreviewRow[];
  /** Neighborhoods chosen or accepted by the dispatcher, by row. */
  places: Map<number, string>;
  accepted: Map<number, Set<BulkConfirmation>>;
  /** Kept across retries of the same confirmation so it happens once (FR-042). */
  batch: { id: string; rowIds: string[] };
};

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/** Registration of up to 200 shipments of one merchant at once (User Story 4). */
function ShipmentBulkPage() {
  const queryClient = useQueryClient();
  const [merchant, setMerchant] = useState<MerchantOption | null>(null);
  const [pickupPointId, setPickupPointId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const points = useQuery({
    queryKey: ["pickup-points", merchant?.id],
    queryFn: () => listPickupPoints(merchant?.id ?? ""),
    enabled: Boolean(merchant),
  });

  async function review(cellsOrText: string[][] | string, places = new Map<number, string>()) {
    setError(null);
    if (!merchant) {
      setError("Elige el cliente de la lista.");
      return;
    }
    const table = readBulkTable(
      typeof cellsOrText === "string" ? textToRows(cellsOrText) : cellsOrText,
    );
    if ("error" in table) {
      setPreview(null);
      setError(table.error);
      return;
    }
    setBusy(true);
    try {
      const rows = await previewBulk({
        merchantId: merchant.id,
        ...(pickupPointId && { pickupPointId }),
        rows: table.rows.map((cells, index) => {
          const neighborhoodId = places.get(index);
          return neighborhoodId ? { cells, neighborhoodId } : { cells };
        }),
      });
      setPreview({
        cells: table.rows,
        rows,
        places,
        accepted: new Map(
          [...places.keys()].map((index) => [index, new Set<BulkConfirmation>(["neighborhood"])]),
        ),
        batch: { id: crypto.randomUUID(), rowIds: rows.map(() => crypto.randomUUID()) },
      });
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof ApiError ? caught.message : "No pudimos revisar la lista.");
    } finally {
      setBusy(false);
    }
  }

  function accept(row: number, confirmation: BulkConfirmation) {
    if (!preview) return;
    const accepted = new Map(preview.accepted);
    accepted.set(row, new Set([...(accepted.get(row) ?? []), confirmation]));
    const places = new Map(preview.places);
    const match = preview.rows[row]?.neighborhoodMatch;
    if (confirmation === "neighborhood" && match) places.set(row, match.id);
    setPreview({ ...preview, accepted, places });
  }

  const states = preview?.rows.map((row, index) =>
    rowState(row, preview.accepted.get(index) ?? new Set()),
  );
  const creatable = states?.flatMap((state, index) => (state === "ready" ? [index] : [])) ?? [];
  const count = (state: string) => states?.filter((value) => value === state).length ?? 0;

  async function create() {
    if (!preview || !merchant || creatable.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const rows = creatable.map((index): ShipmentCreateInput => {
        const row = preview.rows[index] as BulkPreviewRow;
        const neighborhoodId = preview.places.get(index);
        return {
          ...row.input,
          ...(neighborhoodId && { recipientNeighborhoodId: neighborhoodId }),
          id: preview.batch.rowIds[index] ?? crypto.randomUUID(),
          confirmed: true,
        } as ShipmentCreateInput;
      });
      const result = await confirmBulk({
        batchId: preview.batch.id,
        merchantId: merchant.id,
        rows,
      });
      toast.success(plural(result.created.length, "envío creado", "envíos creados"));
      await queryClient.invalidateQueries({ queryKey: ["board"] });
      const created = new Set(creatable);
      const remaining = preview.cells.filter((_, index) => !created.has(index));
      setText(rowsToText(remaining));
      if (remaining.length > 0) await review(remaining);
      else setPreview(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos crear los envíos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-s text-on-surface">Registro masivo</h1>
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="bulk-merchant">Cliente</FieldLabel>
          <SearchCombobox<MerchantOption>
            id="bulk-merchant"
            label="Cliente"
            queryKey={["merchants"]}
            search={searchMerchants}
            value={merchant}
            onChange={(next) => {
              setMerchant(next);
              setPickupPointId(null);
              setPreview(null);
            }}
            itemKey={(option) => option.id}
            itemLabel={(option) => option.name}
            placeholder="Nombre o alias del cliente"
            emptyText="No hay clientes con ese nombre"
            autoFocus
          />
        </Field>
        <Field>
          <OptionSelect
            label="Punto de recogida"
            value={pickupPointId ?? points.data?.find((point) => point.isDefault)?.id ?? null}
            onChange={(value) => {
              setPickupPointId(value);
              setPreview(null);
            }}
            options={(points.data ?? []).map((point) => ({
              value: point.id,
              label: `${point.label} · ${point.address}`,
            }))}
            placeholder="Primero elige el cliente"
            disabled={!merchant}
          />
        </Field>
      </div>

      <div className="max-w-5xl">
        <BulkInput
          text={text}
          onTextChange={(next) => {
            setText(next);
            setPreview(null);
          }}
          onFileRead={(rows) => {
            setText(rowsToText(rows));
            void review(rows);
          }}
          onFileError={setError}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" disabled={busy} onClick={() => void review(text)}>
          Revisar lista
        </Button>
        {preview && (
          <>
            <p className="text-body-l text-on-surface" role="status">
              {plural(count("ready"), "lista", "listas")} · {count("needs_confirmation")} por
              confirmar · {count("invalid")} con errores
            </p>
            <Button disabled={busy || creatable.length === 0} onClick={() => void create()}>
              Crear {plural(creatable.length, "envío", "envíos")}
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-5xl text-body-l text-error">
          {error}
        </p>
      )}

      {preview && (
        <BulkPreviewTable
          rows={preview.rows}
          accepted={preview.accepted}
          onAccept={accept}
          onChooseNeighborhood={(row, place) => {
            const places = new Map(preview.places);
            places.set(row, place.id);
            void review(preview.cells, places);
          }}
        />
      )}
    </div>
  );
}
