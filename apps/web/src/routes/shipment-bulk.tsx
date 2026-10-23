import {
  bulkConfirmInput,
  readBulkTable,
  shipmentCreateInput,
  type BulkConfirmation,
  type BulkPreviewRow,
  type ShipmentCreateInput,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { OptionSelect } from "@/components/option-select";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  FormDraftRecovery,
  IntentReviewAcknowledgement,
} from "@/features/shipments/form-draft-recovery";
import {
  bulkDraftSchema,
  emptyBulkDraft,
  type BulkDraft,
  type BulkForm,
  type BulkPending,
} from "@/features/shipments/bulk-form-draft";
import { listPickupPoints, searchMerchants, type MerchantOption } from "@/features/shipments/api";
import { useFormDraft, type ReadyFormDraft } from "@/features/shipments/use-form-draft";
import { confirmBulk, previewBulk } from "@/features/bulk/api";
import { BulkInput, rowsToText, textToRows } from "@/features/bulk/bulk-input";
import { BulkPreviewTable, rowState } from "@/features/bulk/bulk-preview-table";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";

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

const confirmationResultSchema = z.strictObject({
  batchId: z.uuid(),
  created: z.array(
    z.strictObject({
      row: z.number().int().nonnegative(),
      id: z.uuid(),
      trackingNumber: z.string().min(1),
    }),
  ),
});

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/** Registration of up to 200 shipments of one merchant at once (User Story 4). */
function ShipmentBulkPage() {
  const draft = useFormDraft<BulkDraft>("bulk", emptyBulkDraft, bulkDraftSchema);
  if (draft.status !== "ready") return <FormDraftRecovery draft={draft} />;
  if (draft.initialValues.needsIntentAcknowledgement) {
    return (
      <IntentReviewAcknowledgement
        raw={draft.sourceRaw}
        title="Este lote viene de una versión anterior"
        description="Conservamos los datos del lote, pero esta versión no guardó la solicitud exacta ni los identificadores de sus filas. El servidor pudo haberlo confirmado antes de cerrar o recargar la página. Descarga una copia y revisa el historial antes de preparar otro intento."
        downloadName="domy-lote-anterior.txt"
        onAcknowledge={() =>
          draft.startNew({
            ...draft.initialValues,
            needsIntentAcknowledgement: false,
            pending: null,
          })
        }
      />
    );
  }
  return <ShipmentBulkBody draft={draft} />;
}

function ShipmentBulkBody({ draft }: { draft: ReadyFormDraft<BulkDraft> }) {
  const queryClient = useQueryClient();
  const [merchant, setMerchant] = useState<MerchantOption | null>(
    draft.initialValues.form.merchant,
  );
  const [pickupPointId, setPickupPointId] = useState<string | null>(
    draft.initialValues.form.pickupPointId,
  );
  const [text, setText] = useState(draft.initialValues.form.text);
  const [pending, setPending] = useState<BulkPending | null>(draft.initialValues.pending ?? null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingSnapshotRaw, setPendingSnapshotRaw] = useState<string | null>(draft.sourceRaw);
  const [pendingRequiresReview, setPendingRequiresReview] = useState(false);
  const [reviewedPendingRelease, setReviewedPendingRelease] = useState(false);

  const formValues: BulkForm = { merchant, pickupPointId, text };
  const { save: saveDraft } = draft;
  useEffect(() => {
    saveDraft({
      form: { merchant, pickupPointId, text },
      pending,
      needsIntentAcknowledgement: false,
    });
  }, [saveDraft, merchant, pending, pickupPointId, text]);

  const points = useQuery({
    queryKey: ["pickup-points", merchant?.id],
    queryFn: () => listPickupPoints(merchant?.id ?? ""),
    enabled: Boolean(merchant) && pending === null,
  });

  async function review(
    cellsOrText: string[][] | string,
    places = new Map<number, string>(),
    afterAcknowledgedBatch = false,
  ) {
    setError(null);
    if (pending && !afterAcknowledgedBatch) {
      setError("Resuelve primero la creación pendiente antes de revisar otro lote.");
      return;
    }
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
    if (!preview || pending) return;
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

  async function confirmPending(payload: BulkPending) {
    const snapshot = {
      form: formValues,
      pending: payload,
      needsIntentAcknowledgement: false,
    };
    const parsedSnapshot = bulkDraftSchema.safeParse(snapshot);
    if (!parsedSnapshot.success || !draft.save(parsedSnapshot.data)) {
      setError(
        "El lote pendiente sigue en memoria, pero no pudimos guardarlo. Reintenta el guardado antes de enviar.",
      );
      return;
    }
    const raw = JSON.stringify({ id: draft.id, values: parsedSnapshot.data });
    setPendingSnapshotRaw(raw);
    setPendingRequiresReview(false);
    setReviewedPendingRelease(false);
    setError(null);
    setBusy(true);
    try {
      const response: unknown = await confirmBulk(payload.input);
      const parsed = confirmationResultSchema.safeParse(response);
      const matchesPending =
        parsed.success &&
        parsed.data.batchId === payload.input.batchId &&
        parsed.data.created.length === payload.input.rows.length &&
        parsed.data.created.every(
          (item, index) => item.row === index && item.id === payload.input.rows[index]?.id,
        );
      if (!parsed.success || !matchesPending) {
        setError(
          "Recibimos una respuesta que no coincide con el lote pendiente. Conservamos sus datos para reintentar la misma creación.",
        );
        return;
      }

      toast.success(plural(parsed.data.created.length, "envío creado", "envíos creados"));
      await queryClient.invalidateQueries({ queryKey: ["board"] });
      const remainingText = payload.remainingText;
      const next = {
        form: { merchant, pickupPointId, text: remainingText },
        pending: null,
        needsIntentAcknowledgement: false,
      };
      const rotated = draft.startNew(next);
      setText(remainingText);
      setPending(null);
      setPreview(null);
      if (!rotated.stored) {
        setError(
          "La creación quedó confirmada, pero no pudimos guardar un identificador nuevo. Reintenta el guardado antes de enviar otro lote.",
        );
      } else if (remainingText !== "") {
        await review(remainingText, new Map(), true);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "invalid_request") {
        setPendingSnapshotRaw(raw);
        setPendingRequiresReview(true);
        setError(caught.message);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "No pudimos crear los envíos.");
    } finally {
      setBusy(false);
    }
  }

  function releaseRejectedPending() {
    if (!pending || !pendingRequiresReview) return;
    const values: BulkDraft = {
      form: formValues,
      pending: null,
      needsIntentAcknowledgement: false,
    };
    if (reviewedPendingRelease) {
      if (!draft.save(values)) {
        setError(
          "La nueva intención todavía no quedó guardada. Reintenta el guardado antes de editar o enviar.",
        );
        return;
      }
    } else {
      const next = draft.startNew(values);
      setReviewedPendingRelease(true);
      if (!next.stored) {
        setError(
          "No pudimos guardar la nueva intención. Reintenta el guardado antes de editar o enviar.",
        );
        return;
      }
    }
    setText(formValues.text);
    setPending(null);
    setPreview(null);
    setPendingSnapshotRaw(null);
    setPendingRequiresReview(false);
    setReviewedPendingRelease(false);
    setError(null);
  }

  async function create() {
    if (!preview || !merchant || creatable.length === 0 || pending) return;
    setError(null);
    const rows: ShipmentCreateInput[] = [];
    for (const index of creatable) {
      const row = preview.rows[index];
      const rowId = preview.batch.rowIds[index];
      if (!row || !rowId) {
        setError("No pudimos validar las identidades de las filas. Revisa la lista otra vez.");
        return;
      }
      const neighborhoodId = preview.places.get(index);
      const parsedRow = shipmentCreateInput.safeParse({
        ...row.input,
        ...(neighborhoodId && { recipientNeighborhoodId: neighborhoodId }),
        id: rowId,
        confirmed: true,
      });
      if (!parsedRow.success) {
        setError("No pudimos validar las filas que vas a crear. Revisa la lista otra vez.");
        return;
      }
      rows.push(parsedRow.data);
    }
    const parsed = bulkConfirmInput.safeParse({
      batchId: preview.batch.id,
      merchantId: merchant.id,
      rows,
    });
    if (!parsed.success) {
      setError("No pudimos validar las filas que vas a crear. Revisa la lista otra vez.");
      return;
    }
    const remaining = preview.cells.filter((_, index) => !creatable.includes(index));
    const pendingSnapshot: BulkPending = {
      input: parsed.data,
      remainingText: rowsToText(remaining),
    };
    const snapshot: BulkDraft = {
      form: formValues,
      pending: pendingSnapshot,
      needsIntentAcknowledgement: false,
    };
    if (!draft.save(snapshot)) {
      setError(
        "Tus datos siguen en pantalla, pero no pudimos guardar el lote y sus identificadores. Reintenta el guardado antes de enviar.",
      );
      return;
    }
    setPending(pendingSnapshot);
    await confirmPending(pendingSnapshot);
  }

  function retryDraftSave() {
    if (reviewedPendingRelease && pendingRequiresReview) {
      releaseRejectedPending();
      return;
    }
    if (draft.save({ form: formValues, pending, needsIntentAcknowledgement: false })) {
      setError(null);
      if (pending) void confirmPending(pending);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Registro masivo" />
      {pending && pendingRequiresReview ? (
        reviewedPendingRelease ? (
          <section
            role="alert"
            className="max-w-5xl space-y-3 rounded-md border border-warning bg-warning-container p-4"
          >
            <p className="text-body-l text-on-warning-container">
              Ya revisaste el historial. Conservamos las filas, pero la nueva intención todavía no
              quedó guardada en este navegador.
            </p>
            <Button variant="outline" onClick={releaseRejectedPending}>
              Reintentar guardado
            </Button>
          </section>
        ) : (
          <IntentReviewAcknowledgement
            raw={pendingSnapshotRaw}
            description="El servidor rechazó los datos enviados, pero un intento anterior pudo haber registrado los envíos. Conservamos tu información. Descarga la copia local y revisa el historial de envíos. Si ya aparecen allí, no prepares otro intento."
            downloadName="domy-lote-pendiente.txt"
            downloadLabel="Descargar lote pendiente"
            onAcknowledge={releaseRejectedPending}
          />
        )
      ) : pending ? (
        <section className="max-w-5xl space-y-3 rounded-md border border-warning bg-warning-container p-4">
          <p role="status" className="text-body-l text-on-warning-container">
            Hay una creación pendiente de {plural(pending.input.rows.length, "envío", "envíos")}{" "}
            para {merchant?.name ?? "este cliente"}. Reintentar usará el mismo lote y las mismas
            filas.
          </p>
          <Button disabled={busy || draft.writeFailed} onClick={() => void confirmPending(pending)}>
            {busy ? "Reintentando…" : "Reintentar creación pendiente"}
          </Button>
        </section>
      ) : (
        <>
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
                <Button
                  disabled={busy || creatable.length === 0 || draft.writeFailed}
                  onClick={() => void create()}
                >
                  Crear {plural(creatable.length, "envío", "envíos")}
                </Button>
              </>
            )}
          </div>
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
        </>
      )}
      {draft.writeFailed && !(pendingRequiresReview && reviewedPendingRelease) && (
        <div role="alert" className="max-w-5xl space-y-2 text-body-m text-error">
          <p>
            Tus datos siguen en pantalla, pero no pudimos guardarlos en este navegador. Reintenta el
            guardado antes de enviar; no usaremos un identificador nuevo sin persistirlo.
          </p>
          <Button type="button" variant="outline" onClick={retryDraftSave}>
            Reintentar guardado
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="max-w-5xl text-body-l text-error">
          {error}
        </p>
      )}
    </div>
  );
}
