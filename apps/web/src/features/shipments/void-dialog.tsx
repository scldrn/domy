import { reason as reasonSchema, type Shipment } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { voidShipment } from "./api";

/**
 * Voiding with a reason (FR-014, FR-040). The action identifier lives as long as the dialog,
 * so retrying after a lost response never voids twice (FR-042).
 */
export function VoidDialog({ shipment }: { shipment: Shipment }) {
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Escribe el motivo.");
      return;
    }
    setSaving(true);
    try {
      await voidShipment(shipment.id, { actionId, version: shipment.version, reason });
      await queryClient.invalidateQueries({ queryKey: ["shipment", shipment.trackingNumber] });
      toast.success("Envío anulado");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos anular el envío.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => {
          setActionId(crypto.randomUUID());
          setReason("");
          setError(null);
          setOpen(true);
        }}
      >
        Anular envío
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular este envío?</AlertDialogTitle>
          <AlertDialogDescription>
            El envío queda como «Anulado» y se puede seguir consultando; no se borra.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor={reasonId}>Motivo de la anulación</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <Button variant="destructive" disabled={saving} onClick={() => void confirm()}>
            Confirmar anulación
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
