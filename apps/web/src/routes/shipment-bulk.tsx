import {
  bulkConfirmInput,
  formatCop,
  resolveCodAmount,
  readBulkTable,
  shipmentCreateInput,
  type BulkConfirmation,
  type BulkPreviewRow,
  type ShipmentCreateInput,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { FormSection, SectionNumber } from "@/components/form-section";
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
/** One state's count in the lot, with the same mark as its rows. */
function LotCount({
  state,
  label,
  count,
}: {
  state: "ready" | "needs_confirmation" | "invalid";
  label: string;
  count: number;
}) {
  const mark = {
    ready: "text-success before:bg-success",
    needs_confirmation:
      "text-warning before:bg-transparent before:ring-2 before:ring-warning before:ring-inset",
    invalid: "text-error before:rounded-[3px] before:bg-error",
  }[state];
  return (
    <li className="flex items-center justify-between gap-3">
      <span
        className={`inline-flex items-center gap-2 text-label-l before:size-2.5 before:shrink-0 before:rounded-full before:content-[''] ${mark}`}
      >
        {label}
      </span>
      <strong className="tabular-nums">{count}</strong>
    </li>
  );
}

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
  const [reviewing, setReviewing] = useState(false);
  // FR-020: the preview describes the list in the box. Each review takes the next run, and a
  // change to the list, client, or pickup point takes one too, so an older answer is dropped.
  const reviewRun = useRef(0);
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

  function discardPreview() {
    reviewRun.current += 1;
    setReviewing(false);
    setPreview(null);
  }

  async function review(
    cellsOrText: string[][] | string,
    places = new Map<number, string>(),
    afterAcknowledgedBatch = false,
  ) {
    const run = (reviewRun.current += 1);
    setReviewing(false);
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
    setReviewing(true);
    try {
      const rows = await previewBulk({
        merchantId: merchant.id,
        ...(pickupPointId && { pickupPointId }),
        rows: table.rows.map((cells, index) => {
          const neighborhoodId = places.get(index);
          return neighborhoodId ? { cells, neighborhoodId } : { cells };
        }),
      });
      if (run !== reviewRun.current) return;
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
      if (run !== reviewRun.current) return;
      setPreview(null);
      setError(caught instanceof ApiError ? caught.message : "No pudimos revisar la lista.");
    } finally {
      if (run === reviewRun.current) setReviewing(false);
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

  const pickupPointShown = pickupPointId ?? points.data?.find((point) => point.isDefault)?.id;
  const pickupName = points.data?.find((point) => point.id === pickupPointShown)?.label;
  // What the ready rows add up to (approved "Registro masivo"): fees, and what couriers collect.
  const lot = creatable.reduce(
    (sum, index) => {
      const input = preview?.rows[index]?.input;
      if (!input) return sum;
      return {
        fees: sum.fees + input.fee,
        collected:
          sum.collected + resolveCodAmount(input.paymentMode, input.fee, input.codAmount ?? 0),
      };
    },
    { fees: 0, collected: 0 },
  );
  const invalidCount = count("invalid");
  const actionHint = !preview
    ? "Revisar no crea nada: muestra cada fila con su tarifa y lo que falta."
    : invalidCount > 0
      ? `${invalidCount === 1 ? "La fila" : `Las ${String(invalidCount)} filas`} con errores se ${invalidCount === 1 ? "queda" : "quedan"} en el cuadro para corregirlas.`
      : "El lote se guarda en este equipo mientras trabajas.";
  const action = (className: string) =>
    preview ? (
      <Button
        variant="accent"
        size="lg"
        className={className}
        disabled={busy || reviewing || creatable.length === 0 || draft.writeFailed}
        onClick={() => void create()}
      >
        {creatable.length === 0
          ? "Ninguna fila lista"
          : `Crear ${plural(creatable.length, "envío", "envíos")}`}
      </Button>
    ) : (
      <Button
        variant="accent"
        size="lg"
        className={className}
        disabled={busy || reviewing}
        onClick={() => void review(text)}
      >
        Revisar lista
      </Button>
    );

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
        // Not awaited: the creation is done, and editing the rows left over drops this review.
        void review(remainingText, new Map(), true);
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Registro masivo"
        sentence={
          <p className="max-w-[72ch] text-pretty">
            Pega las filas de la hoja de cálculo o sube el archivo de la plantilla. Revisas la
            lista, confirmas lo dudoso y creas{" "}
            <strong className="font-semibold text-on-surface">las filas listas</strong>; las que
            tienen errores se quedan en el cuadro para corregirlas.
          </p>
        }
      />
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
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_35rem] flex-col gap-4">
            <FormSection number={1} title="Cliente y recogida">
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
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
                      discardPreview();
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
                    value={
                      pickupPointId ?? points.data?.find((point) => point.isDefault)?.id ?? null
                    }
                    onChange={(value) => {
                      setPickupPointId(value);
                      discardPreview();
                    }}
                    options={(points.data ?? []).map((point) => ({
                      value: point.id,
                      label: `${point.label} · ${point.address}`,
                    }))}
                    placeholder="Primero elige el cliente"
                    disabled={!merchant}
                  />
                  <p className="text-body-s text-on-surface-variant">
                    Todas las filas salen de este punto.
                  </p>
                </Field>
              </div>
            </FormSection>

            <FormSection number={2} title="Lista">
              <BulkInput
                text={text}
                onTextChange={(next) => {
                  setText(next);
                  discardPreview();
                }}
                onFileRead={(rows) => {
                  setText(rowsToText(rows));
                  void review(rows);
                }}
                onFileError={setError}
              />
              {preview && (
                <div className="mt-3.5 flex justify-end">
                  <Button
                    variant="outline"
                    disabled={busy || reviewing}
                    onClick={() => void review(text)}
                  >
                    Revisar de nuevo
                  </Button>
                </div>
              )}
            </FormSection>

            {preview && (
              <section
                aria-labelledby="revision"
                className="rounded-lg border border-outline-variant bg-sheet px-5 pt-4 pb-1 max-[820px]:px-4"
              >
                <h2 id="revision" className="text-title-l text-on-surface">
                  <SectionNumber number={3} />
                  Revisión
                </h2>
                <p className="mt-0.5 mb-2 text-body-m text-on-surface-variant" role="status">
                  {plural(count("ready"), "lista", "listas")} · {count("needs_confirmation")} por
                  confirmar · {count("invalid")} con errores
                </p>
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
              </section>
            )}
          </div>

          <aside
            aria-label="Lote"
            className="sticky top-4 flex max-w-95 min-w-0 flex-[1_1_20rem] flex-col gap-3 max-[820px]:static max-[820px]:max-w-none max-[820px]:basis-full"
          >
            <section
              aria-labelledby="lote"
              className="rounded-lg border border-outline-variant bg-sheet px-5 py-4"
            >
              <h2 id="lote" className="text-title-l text-on-surface">
                Lote
              </h2>
              <dl className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-body-m">
                <dt className="text-on-surface-variant">Cliente</dt>
                <dd className="font-medium break-words">{merchant?.name ?? "Sin elegir"}</dd>
                <dt className="text-on-surface-variant">Recoge en</dt>
                <dd className="font-medium break-words">{pickupName ?? "Sin elegir"}</dd>
                <dt className="text-on-surface-variant">Filas</dt>
                <dd className="font-medium">
                  {preview ? plural(preview.rows.length, "fila", "filas") : "Sin revisar todavía"}
                </dd>
              </dl>
              {preview && (
                <>
                  <ul className="mt-3 flex flex-col gap-1.5 text-body-m">
                    <LotCount state="ready" label="Listas" count={count("ready")} />
                    <LotCount
                      state="needs_confirmation"
                      label="Por confirmar"
                      count={count("needs_confirmation")}
                    />
                    <LotCount state="invalid" label="Con errores" count={count("invalid")} />
                  </ul>
                  <dl className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t border-outline-variant pt-3.5 text-body-m">
                    <dt className="text-on-surface-variant">Tarifas de las listas</dt>
                    <dd className="text-right font-semibold tabular-nums">{formatCop(lot.fees)}</dd>
                    <dt className="text-body-l font-bold">A recaudar</dt>
                    <dd className="text-right text-body-l font-bold tabular-nums">
                      {formatCop(lot.collected)}
                    </dd>
                  </dl>
                </>
              )}
            </section>
            <div className="flex flex-col gap-2 max-[820px]:hidden">
              {action("w-full")}
              <p className="text-center text-body-s text-on-surface-variant">{actionHint}</p>
            </div>
          </aside>

          <div className="sticky bottom-0 z-10 -mx-4 hidden w-[calc(100%+2rem)] items-center gap-3 border-t border-outline-variant bg-sheet px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-[820px]:flex">
            <span className="min-w-0">
              <span className="block text-body-s text-on-surface-variant">
                {preview ? "Listas para crear" : "Sin revisar"}
              </span>
              <strong className="block font-bold tabular-nums">
                {preview ? plural(count("ready"), "fila", "filas") : "Revisa la lista"}
              </strong>
            </span>
            {action("flex-1")}
          </div>
        </div>
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
