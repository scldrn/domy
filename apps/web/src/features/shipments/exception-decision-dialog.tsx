import {
  bogotaToday,
  exceptionDecisionInput,
  officeReceiptStatus,
  type ShipmentDetail,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getRoutesBoard } from "@/features/routes/api";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/format";
import { decideException, receiveAtOffice } from "./api";

/** US4 T058, FR-029/FR-041: panel actions use the same declared eligibility as the API. */
export function ExceptionActions({ shipment }: { shipment: ShipmentDetail }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"decision" | "receipt" | null>(null);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["shipment", shipment.trackingNumber] }),
      queryClient.invalidateQueries({ queryKey: ["routes-board"] }),
      queryClient.invalidateQueries({ queryKey: ["route"] }),
      queryClient.invalidateQueries({ queryKey: ["board"] }),
      queryClient.invalidateQueries({ queryKey: ["unassigned"] }),
    ]);
    setAction(null);
  };
  const receivable = officeReceiptStatus({
    status: shipment.status,
    routeId: shipment.route?.id ?? null,
    custodyCourierId: shipment.custodyCourier?.id ?? null,
  });
  return (
    <>
      {shipment.status === "exception" && (
        <Button
          variant="outline"
          onClick={() => {
            setAction("decision");
          }}
        >
          {shipment.returnDecided ? "Cambiar a nuevo intento" : "Decidir novedad"}
        </Button>
      )}
      {receivable && (
        <Button
          variant="outline"
          onClick={() => {
            setAction("receipt");
          }}
        >
          Recibido en oficina
        </Button>
      )}
      {action === "decision" && (
        <DecisionDialog
          shipment={shipment}
          onClose={() => {
            setAction(null);
          }}
          onSaved={refresh}
        />
      )}
      {action === "receipt" && (
        <ReceiptDialog
          shipment={shipment}
          onClose={() => {
            setAction(null);
          }}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function DecisionDialog({
  shipment,
  onClose,
  onSaved,
}: {
  shipment: ShipmentDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const today = bogotaToday(now());
  const board = useQuery({
    queryKey: ["routes-board", today],
    queryFn: () => getRoutesBoard(today),
  });
  const targets = [
    ...(board.data?.routes ?? []),
    ...(board.data?.routesFromPreviousDays ?? []),
  ].filter((route) => route.status === "in_progress");
  const [actionId] = useState(() => crypto.randomUUID());
  const [decision, setDecision] = useState<"new_attempt" | "return">("new_attempt");
  const [date, setDate] = useState(today);
  const [routeId, setRouteId] = useState<string | null>(
    shipment.route?.status === "in_progress" ? shipment.route.id : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const later = decision === "new_attempt" && date > today;
  async function save() {
    const parsed = exceptionDecisionInput.safeParse({
      actionId,
      decision,
      ...(decision === "new_attempt" && { serviceDate: date }),
      ...(!later && routeId && { routeId }),
    });
    if (!parsed.success) {
      setError("Revisa la fecha y la ruta antes de guardar la decisión.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await decideException(shipment.id, parsed.data);
      await onSaved();
      toast.success("Decisión guardada");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar la decisión. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Decidir novedad</DialogTitle>
          <DialogDescription>
            El paquete conserva su custodia hasta que se entregue, se devuelva o lo reciba la
            oficina.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-body-l text-on-surface">Qué hacer con el envío</legend>
          {(
            [
              ["new_attempt", "Nuevo intento"],
              ["return", "Devolver al remitente"],
            ] as const
          )
            .filter(([value]) => !shipment.returnDecided || value === "new_attempt")
            .map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-outline-variant px-3 py-2 text-body-l"
              >
                <input
                  type="radio"
                  name={`${id}-decision`}
                  checked={decision === value}
                  onChange={() => {
                    setDecision(value);
                  }}
                  className="size-5 accent-primary"
                />
                {label}
              </label>
            ))}
        </fieldset>
        {decision === "new_attempt" && (
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>Fecha del nuevo intento</FieldLabel>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              disabled={busy}
              onChange={(event) => {
                setDate(event.target.value);
              }}
            />
          </Field>
        )}
        <Field className="min-w-0">
          <OptionSelect
            label="Ruta"
            value={later ? "none" : (routeId ?? "none")}
            disabled={busy || later || board.isPending || board.isError}
            onChange={(value) => {
              setRouteId(value === "none" ? null : value);
            }}
            options={[
              { value: "none", label: "Sin ruta" },
              ...targets.map((route) => ({
                value: route.id,
                label: `Ruta ${String(route.number)} · ${route.courier?.name ?? "Sin mensajero"} · ${formatDate(route.serviceDate)}`,
              })),
            ]}
          />
        </Field>
        {board.isError && (
          <p role="alert" className="text-body-m text-error">
            No pudimos cargar las rutas.{" "}
            <Button variant="ghost" onClick={() => void board.refetch()}>
              Reintentar
            </Button>
          </p>
        )}
        <p className="text-body-m text-on-surface-variant">
          {later || !routeId
            ? "Queda en «Sin asignar», con quien tiene el paquete, hasta que se agregue a una ruta."
            : "Si otro mensajero tiene el paquete, la parada espera el traspaso."}
        </p>
        {error && (
          <p role="alert" className="text-body-m text-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>Cancelar</DialogClose>
          <Button disabled={busy || board.isPending || board.isError} onClick={() => void save()}>
            Guardar decisión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  shipment,
  onClose,
  onSaved,
}: {
  shipment: ShipmentDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [actionId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await receiveAtOffice(shipment.id, { actionId });
      await onSaved();
      toast.success("Recibido en oficina");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos registrar la recepción. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Recibir el paquete en oficina?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirma solo cuando {shipment.custodyCourier?.name} entregue el paquete. Desde ese
            momento queda a cargo de la oficina.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-body-m text-error">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
          <Button disabled={busy} onClick={() => void save()}>
            Confirmar recepción
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
