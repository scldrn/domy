import { courierRecordInput, formatTrackingNumber, type CourierTask } from "@domy/domain";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { currentLocation } from "@/lib/offline/location";
import { saveCourierRecord } from "./courier-store";
import { CourierSheet, SummaryLine } from "./courier-sheet";

/** US3 FR-014/FR-017–FR-018: a pickup or errand problem keeps its task pending. */
export function ProblemForm({
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
  const [note, setNote] = useState(task.problemNote ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = () => ({
    id: crypto.randomUUID(),
    shipmentId: task.shipmentId,
    kind: "problem" as const,
    occurredAt: new Date().toISOString(),
    location: currentLocation(),
    note: note.trim(),
  });
  const review = () => {
    const parsed = courierRecordInput.safeParse(record());
    setError(parsed.success ? null : (parsed.error.issues[0]?.message ?? "Revisa la nota."));
    if (parsed.success) setReviewing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveCourierRecord(userId, courierRecordInput.parse(record()));
      onSaved();
    } catch {
      setError("No se pudo guardar en el teléfono. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <CourierSheet
      open={open}
      onOpenChange={onOpenChange}
      title={reviewing ? "Revisa antes de guardar" : "Reportar problema"}
      description={`Guía ${formatTrackingNumber(task.trackingNumber)}`}
    >
      {reviewing ? (
        <>
          <dl>
            <SummaryLine label="Qué pasó">{note.trim()}</SummaryLine>
          </dl>
          <p className="text-body-l text-on-surface-variant">
            La parada sigue pendiente. Puedes completarla cuando se resuelva el problema.
          </p>
          {error && (
            <p role="alert" className="text-body-l text-error">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" disabled={saving} onClick={() => void save()}>
              Guardar problema
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setReviewing(false);
                setError(null);
              }}
            >
              Corregir
            </Button>
          </div>
        </>
      ) : (
        <>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={`${id}-note`} className="text-body-l">
              Qué pasó
            </FieldLabel>
            <Textarea
              id={`${id}-note`}
              value={note}
              maxLength={200}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button size="lg" onClick={review}>
            Revisar
          </Button>
        </>
      )}
    </CourierSheet>
  );
}
