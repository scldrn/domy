import { clearReviewInput, type ShipmentDetail } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { api, unwrap, ApiError } from "@/lib/api-client";

/** FR-026: resolves the review with a reason; it never edits the courier's fact. */
export function ClearReviewDialog({ shipment }: { shipment: ShipmentDetail }) {
  const queryClient = useQueryClient();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const parsed = clearReviewInput.safeParse({ actionId, note });
    if (!parsed.success) {
      setError("Escribe una nota de entre 5 y 200 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await unwrap(
        api.api.shipments[":id"]["clear-review"].$post({
          param: { id: shipment.id },
          json: parsed.data,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["shipment", shipment.trackingNumber] });
      await queryClient.invalidateQueries({ queryKey: ["board"] });
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar la revisión. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (!shipment.needsReview) return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setActionId(crypto.randomUUID());
          setNote("");
          setError(null);
          setOpen(true);
        }}
      >
        Marcar revisado
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver revisión</DialogTitle>
            <DialogDescription>
              Deja constancia de lo que verificaste. El registro y la custodia del paquete no
              cambian.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={noteId}>Nota</FieldLabel>
            <Textarea
              id={noteId}
              value={note}
              maxLength={200}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              aria-invalid={Boolean(error)}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setOpen(false);
              }}
            >
              Volver
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              Guardar revisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
