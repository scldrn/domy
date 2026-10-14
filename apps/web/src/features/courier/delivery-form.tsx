import {
  collectedTotal,
  collectionProblem,
  courierRecordInput,
  formatCop,
  formatTrackingNumber,
  paymentMethodLabels,
  receivedByNameProblem,
  type CourierTask,
} from "@domy/domain";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { currentLocation } from "@/lib/offline/location";
import { CollectionFields, proposedCollection, type Collection } from "./collection-fields";
import { saveCourierRecord } from "./courier-store";
import { CourierSheet, SummaryLine } from "./courier-sheet";
import { needsAmountConfirmation, proposedReceivedBy } from "./delivery-rules";
import { PhotoInput, type TakenPhoto } from "./photo-input";

type Errors = Partial<Record<"receivedByName" | "note" | "save", string>>;

/**
 * Recording a delivery, or completing an errand (feature 003, US1 scenarios 3–6, FR-008–FR-011,
 * FR-017): who received it, photos, the collection by payment method with the receipt of any
 * transfer, and the summary to confirm before saving.
 */
export function DeliveryForm({
  task,
  userId,
  open,
  onOpenChange,
  onSaved,
}: {
  task: CourierTask;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const id = useId();
  const errand = task.shipmentKind === "errand";
  const [receivedByName, setReceivedByName] = useState(() => proposedReceivedBy(task));
  const [photos, setPhotos] = useState<TakenPhoto[]>([]);
  const [collection, setCollection] = useState<Collection>(() =>
    proposedCollection(task.codAmount),
  );
  const [receipts, setReceipts] = useState<TakenPhoto[]>([]);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const collects = task.codAmount > 0;
  const total = collectedTotal(collection);
  const transferred = collection.companyTransferAmount + collection.merchantTransferAmount > 0;
  const differs = collects && total !== task.codAmount;

  const record = () => ({
    id: crypto.randomUUID(),
    shipmentId: task.shipmentId,
    kind: "delivery" as const,
    occurredAt: new Date().toISOString(),
    location: currentLocation(),
    ...(errand ? {} : { receivedByName: receivedByName.trim() }),
    ...(collects ? collection : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
    photos: [
      ...photos.map((photo) => ({ id: photo.id, kind: "proof" as const })),
      ...(transferred ? receipts : []).map((photo) => ({
        id: photo.id,
        kind: "transfer_receipt" as const,
      })),
    ],
  });

  const review = () => {
    const found: Errors = {};
    const nameProblem = receivedByNameProblem(task.shipmentKind, receivedByName);
    if (nameProblem) found.receivedByName = nameProblem;
    const noteProblem = collects
      ? collectionProblem(task.codAmount, { ...collection, note: note.trim() || undefined })
      : null;
    if (noteProblem) found.note = noteProblem;
    const parsed = courierRecordInput.safeParse(record());
    if (!parsed.success && !found.receivedByName && !found.note) {
      found.note = parsed.error.issues[0]?.message ?? "Revisa los datos.";
    }
    setErrors(found);
    if (Object.keys(found).length === 0) setReviewing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input = courierRecordInput.parse(record());
      const taken = [
        ...photos.map((photo) => ({ ...photo, kind: "proof" as const })),
        ...(transferred ? receipts : []).map((photo) => ({
          ...photo,
          kind: "transfer_receipt" as const,
        })),
      ];
      await saveCourierRecord(
        userId,
        input,
        taken.map((photo) => ({
          id: photo.id,
          recordId: input.id,
          kind: photo.kind,
          image: photo.image,
        })),
      );
      onSaved();
    } catch {
      setErrors({ save: "No se pudo guardar en el teléfono. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const title = errand ? "Completar diligencia" : "Registrar entrega";
  return (
    <CourierSheet
      open={open}
      onOpenChange={onOpenChange}
      title={reviewing ? "Revisa antes de guardar" : title}
      description={`Guía ${formatTrackingNumber(task.trackingNumber)}`}
    >
      {reviewing ? (
        <>
          <dl className="divide-y divide-outline-variant">
            <SummaryLine label="Resultado">
              {errand ? "Diligencia completada" : "Entregado"}
            </SummaryLine>
            {!errand && <SummaryLine label="Recibió">{receivedByName.trim()}</SummaryLine>}
            {collects && (
              <>
                {collection.cashAmount > 0 && (
                  <SummaryLine label={paymentMethodLabels.cash}>
                    {formatCop(collection.cashAmount)}
                  </SummaryLine>
                )}
                {collection.companyTransferAmount > 0 && (
                  <SummaryLine label={paymentMethodLabels.companyTransfer}>
                    {formatCop(collection.companyTransferAmount)}
                  </SummaryLine>
                )}
                {collection.merchantTransferAmount > 0 && (
                  <SummaryLine label={paymentMethodLabels.merchantTransfer}>
                    {formatCop(collection.merchantTransferAmount)}
                  </SummaryLine>
                )}
                <SummaryLine label="Total cobrado">{formatCop(total)}</SummaryLine>
              </>
            )}
            {note.trim() && <SummaryLine label="Nota">{note.trim()}</SummaryLine>}
            <SummaryLine label="Fotos">
              {photos.length + (transferred ? receipts.length : 0) || "Sin foto"}
            </SummaryLine>
          </dl>
          {needsAmountConfirmation(total) && (
            <p
              role="alert"
              className="rounded-sm bg-warning-container p-3 text-body-l text-on-warning-container"
            >
              Cobraste más de $ 2.000.000. Confirma que el valor es correcto.
            </p>
          )}
          {errors.save && (
            <p role="alert" className="text-body-l text-error">
              {errors.save}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={saving} onClick={() => void save()}>
              {errand ? "Guardar diligencia" : "Guardar entrega"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReviewing(false);
              }}
            >
              Corregir
            </Button>
          </div>
        </>
      ) : (
        <>
          {!errand && (
            <Field data-invalid={Boolean(errors.receivedByName)}>
              <FieldLabel htmlFor={`${id}-name`}>Quién recibe</FieldLabel>
              <Input
                id={`${id}-name`}
                value={receivedByName}
                autoComplete="off"
                aria-invalid={Boolean(errors.receivedByName)}
                onChange={(event) => {
                  setReceivedByName(event.target.value);
                }}
              />
              <FieldError>{errors.receivedByName}</FieldError>
            </Field>
          )}
          <PhotoInput
            label={errand ? "Foto de la diligencia (opcional)" : "Foto de la entrega"}
            photos={photos}
            onChange={setPhotos}
          />
          {collects && (
            <CollectionFields
              codAmount={task.codAmount}
              value={collection}
              onChange={setCollection}
            />
          )}
          {transferred && (
            <PhotoInput
              label="Comprobante de la transferencia"
              photos={receipts}
              onChange={setReceipts}
            />
          )}
          <Field data-invalid={Boolean(errors.note)}>
            <FieldLabel htmlFor={`${id}-note`}>
              {differs ? "Nota sobre el recaudo" : "Nota (opcional)"}
            </FieldLabel>
            <Textarea
              id={`${id}-note`}
              value={note}
              aria-invalid={Boolean(errors.note)}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
            <FieldError>{errors.note}</FieldError>
          </Field>
          <Button size="lg" onClick={review}>
            Revisar
          </Button>
        </>
      )}
    </CourierSheet>
  );
}
