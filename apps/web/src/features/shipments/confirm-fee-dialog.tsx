import type { Shipment } from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { ApiError } from "@/lib/api-client";
import { confirmFee } from "./api";

/** The owner confirms or corrects a fee marked "Tarifa por revisar" (FR-035). */
export function ConfirmFeeDialog({ shipment }: { shipment: Shipment }) {
  const queryClient = useQueryClient();
  const feeId = useId();
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [fee, setFee] = useState<number | null>(shipment.fee);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (fee === null || fee <= 0) {
      setError("La tarifa debe ser mayor que cero.");
      return;
    }
    setSaving(true);
    try {
      await confirmFee(shipment.id, { actionId, version: shipment.version, fee });
      await queryClient.invalidateQueries({ queryKey: ["shipment", shipment.trackingNumber] });
      toast.success("Tarifa confirmada");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos guardar la tarifa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        onClick={() => {
          setActionId(crypto.randomUUID());
          setFee(shipment.fee);
          setError(null);
          setOpen(true);
        }}
      >
        Confirmar tarifa
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar tarifa</DialogTitle>
          <DialogDescription>
            {shipment.rateZone?.name ?? "Este destino"} no tiene tarifa en el tarifario. Confirma la
            tarifa cobrada o corrígela.
          </DialogDescription>
        </DialogHeader>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor={feeId}>Tarifa</FieldLabel>
          <MoneyInput id={feeId} value={fee} onChange={setFee} aria-invalid={Boolean(error)} />
          <FieldError>{error}</FieldError>
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Volver</DialogClose>
          <Button disabled={saving} onClick={() => void save()}>
            Guardar tarifa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
