import {
  courierRecordInput,
  exceptionReasonLabels,
  exceptionReasons,
  formatTrackingNumber,
  type CourierTask,
  type ExceptionReason,
} from "@domy/domain";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { currentLocation } from "@/lib/offline/location";
import { saveCourierRecord } from "./courier-store";
import { CourierSheet, SummaryLine } from "./courier-sheet";
import { PhotoInput, type TakenPhoto } from "./photo-input";

/** US3 FR-013/FR-017–FR-018: reviewed exception, persisted with optional photos first. */
export function ExceptionForm({
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
  const [reason, setReason] = useState<ExceptionReason | "">("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<TakenPhoto[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"reason" | "note" | "save", string>>>({});
  const record = () => ({
    id: crypto.randomUUID(),
    shipmentId: task.shipmentId,
    kind: "exception" as const,
    occurredAt: new Date().toISOString(),
    location: currentLocation(),
    reason,
    ...(note.trim() ? { note: note.trim() } : {}),
    photos: photos.map((photo) => ({ id: photo.id, kind: "exception" as const })),
  });
  const review = () => {
    const parsed = courierRecordInput.safeParse(record());
    const found: typeof errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "reason" ? "reason" : "note";
        found[field] ??= issue.message;
      }
    }
    setErrors(found);
    if (parsed.success) setReviewing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const input = courierRecordInput.parse(record());
      await saveCourierRecord(
        userId,
        input,
        photos.map((photo) => ({
          id: photo.id,
          recordId: input.id,
          kind: "exception",
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
  return (
    <CourierSheet
      open={open}
      onOpenChange={onOpenChange}
      title={reviewing ? "Revisa antes de guardar" : "Reportar novedad"}
      description={`Guía ${formatTrackingNumber(task.trackingNumber)}`}
    >
      {reviewing ? (
        <>
          <dl className="divide-y divide-outline-variant">
            <SummaryLine label="Resultado">Novedad</SummaryLine>
            <SummaryLine label="Motivo">{reason && exceptionReasonLabels[reason]}</SummaryLine>
            {note.trim() && <SummaryLine label="Nota">{note.trim()}</SummaryLine>}
            <SummaryLine label="Fotos">{photos.length || "Sin foto"}</SummaryLine>
          </dl>
          <p className="text-body-l text-on-surface-variant">
            El paquete sigue a tu cargo. El coordinador decidirá qué hacer.
          </p>
          {errors.save && (
            <p role="alert" className="text-body-l text-error">
              {errors.save}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={saving} onClick={() => void save()}>
              Guardar novedad
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
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
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={errors.reason ? `${id}-reason-error` : undefined}
          >
            <legend className="mb-2 text-body-l font-medium text-on-surface">
              Motivo de la novedad
            </legend>
            {exceptionReasons.map((value) => (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-outline-variant bg-sheet px-3 py-2 text-body-l text-on-surface"
              >
                <input
                  type="radio"
                  name={`${id}-reason`}
                  value={value}
                  checked={reason === value}
                  aria-invalid={Boolean(errors.reason)}
                  className="size-5 accent-primary"
                  onChange={() => {
                    setReason(value);
                  }}
                />
                {exceptionReasonLabels[value]}
              </label>
            ))}
            {errors.reason && (
              <p id={`${id}-reason-error`} role="alert" className="text-body-l text-error">
                {errors.reason}
              </p>
            )}
          </fieldset>
          <Field data-invalid={Boolean(errors.note)}>
            <FieldLabel htmlFor={`${id}-note`} className="text-body-l">
              Nota (opcional)
            </FieldLabel>
            <Textarea
              id={`${id}-note`}
              value={note}
              maxLength={200}
              aria-invalid={Boolean(errors.note)}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
            <FieldError>{errors.note}</FieldError>
          </Field>
          <PhotoInput label="Foto de la novedad (opcional)" photos={photos} onChange={setPhotos} />
          <Button size="lg" onClick={review}>
            Revisar
          </Button>
        </>
      )}
    </CourierSheet>
  );
}
