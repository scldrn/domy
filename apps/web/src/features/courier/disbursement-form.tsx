import {
  courierRecordInput,
  formatCop,
  formatTrackingNumber,
  type CourierTask,
} from "@domy/domain";
import { useId, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { currentLocation } from "@/lib/offline/location";
import { saveCourierRecord } from "./courier-store";
import { CourierSheet } from "./courier-sheet";
import { needsAmountConfirmation } from "./delivery-rules";
import { PhotoInput, type TakenPhoto } from "./photo-input";

type Errors = Partial<Record<"amount" | "payee" | "note" | "save", string>>;

/**
 * A payment made on the client's behalf, such as the freight of a carrier handoff (feature
 * 003, US1 scenario 9, FR-012): amount, payee, optional note, and the receipt's photo.
 */
export function DisbursementForm({
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
  const [amount, setAmount] = useState<number | null>(null);
  const [payee, setPayee] = useState(task.carrier?.name ?? "");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<TakenPhoto[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const save = async (confirmed: boolean) => {
    const parsed = courierRecordInput.safeParse({
      id: crypto.randomUUID(),
      shipmentId: task.shipmentId,
      kind: "disbursement",
      occurredAt: new Date().toISOString(),
      location: currentLocation(),
      amount: amount ?? 0,
      payee: payee.trim(),
      ...(note.trim() ? { note: note.trim() } : {}),
      photos: photos.map((photo) => ({ id: photo.id, kind: "disbursement_receipt" })),
    });
    if (!parsed.success) {
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const field =
          issue.path[0] === "amount" || issue.path[0] === "payee" ? issue.path[0] : "note";
        found[field] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    if (!confirmed && needsAmountConfirmation(amount ?? 0)) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      await saveCourierRecord(
        userId,
        parsed.data,
        photos.map((photo) => ({
          id: photo.id,
          recordId: parsed.data.id,
          kind: "disbursement_receipt",
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
      title="Pago por cuenta del cliente"
      description={`Guía ${formatTrackingNumber(task.trackingNumber)}`}
    >
      <Field data-invalid={Boolean(errors.amount)}>
        <FieldLabel htmlFor={`${id}-amount`}>Valor pagado</FieldLabel>
        <MoneyInput
          id={`${id}-amount`}
          value={amount}
          aria-invalid={Boolean(errors.amount)}
          onChange={(value) => {
            setAmount(value);
            setConfirming(false);
          }}
        />
        <FieldError>{errors.amount}</FieldError>
      </Field>
      <Field data-invalid={Boolean(errors.payee)}>
        <FieldLabel htmlFor={`${id}-payee`}>A quién se pagó</FieldLabel>
        <Input
          id={`${id}-payee`}
          value={payee}
          autoComplete="off"
          aria-invalid={Boolean(errors.payee)}
          onChange={(event) => {
            setPayee(event.target.value);
          }}
        />
        <FieldError>{errors.payee}</FieldError>
      </Field>
      <PhotoInput label="Foto del comprobante" photos={photos} onChange={setPhotos} />
      <Field data-invalid={Boolean(errors.note)}>
        <FieldLabel htmlFor={`${id}-note`}>Nota (opcional)</FieldLabel>
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
      {confirming && (
        <p
          role="alert"
          className="rounded-sm bg-warning-container p-3 text-body-l text-on-warning-container"
        >
          El pago es de {formatCop(amount ?? 0)}, más de $ 2.000.000. Confirma que el valor es
          correcto.
        </p>
      )}
      {errors.save && (
        <p role="alert" className="text-body-l text-error">
          {errors.save}
        </p>
      )}
      <Button size="lg" disabled={saving} onClick={() => void save(confirming)}>
        {confirming ? "Sí, guardar el pago" : "Guardar pago"}
      </Button>
    </CourierSheet>
  );
}
