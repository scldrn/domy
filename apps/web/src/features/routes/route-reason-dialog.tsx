import { canUndoDispatch, type RouteDetail, type RouteReasonInput } from "@domy/domain";
import { useState, type ReactNode } from "react";
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
import { ApiError } from "@/lib/api-client";
import { cancelRoute, undoDispatch } from "./api";
import { ReasonField, reasonError } from "./reason-field";

type ReasonAction = (id: string, input: RouteReasonInput) => Promise<RouteDetail>;

/**
 * A route action that asks why (FR-016). The action identifier lives as long as the dialog is
 * open, so retrying after a lost response acts once (FR-020); a refusal shows the server's
 * reason and reloads the route (FR-021).
 */
function RouteReasonDialog({
  route,
  disabled,
  trigger,
  title,
  description,
  confirm,
  destructive = false,
  blocked,
  action,
  onDone,
  onRefused,
}: {
  route: RouteDetail;
  disabled: boolean;
  trigger: string;
  title: string;
  description: ReactNode;
  confirm: string;
  destructive?: boolean;
  /** Why the action is not possible now, shown instead of the form. */
  blocked?: string | undefined;
  action: ReasonAction;
  onDone: (updated: RouteDetail) => Promise<void>;
  onRefused: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = reasonError(reason);
    setError(invalid);
    setProblem(null);
    if (invalid) return;
    setBusy(true);
    try {
      const updated = await action(route.id, { actionId, version: route.version, reason });
      setOpen(false);
      await onDone(updated);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "No pudimos guardar el cambio.");
      await onRefused();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setActionId(crypto.randomUUID());
          setReason("");
          setError(undefined);
          setProblem(null);
          setOpen(true);
        }}
      >
        {trigger}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{blocked ?? description}</AlertDialogDescription>
        </AlertDialogHeader>
        {!blocked && <ReasonField value={reason} onChange={setReason} error={error} />}
        {problem && (
          <p
            role="alert"
            className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
          >
            {problem}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          {!blocked && (
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={() => void submit()}
            >
              {confirm}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type RouteActionProps = {
  route: RouteDetail;
  disabled: boolean;
  onDone: (updated: RouteDetail) => Promise<void>;
  onRefused: () => Promise<unknown>;
};

/**
 * A route in preparation built by mistake (FR-017): its shipments are "Registrado" again and
 * the route stays in history as "Cancelada".
 */
export function CancelRouteDialog(props: RouteActionProps) {
  return (
    <RouteReasonDialog
      {...props}
      trigger="Cancelar ruta"
      title={`¿Cancelar la Ruta ${String(props.route.number)}?`}
      description="Sus envíos vuelven a «Registrado» y quedan sin asignar. La ruta queda como «Cancelada» con su historial; no se borra."
      confirm="Cancelar ruta"
      destructive
      action={cancelRoute}
    />
  );
}

/**
 * A route dispatched by mistake (FR-026): back in preparation while nothing is done or picked
 * up, including a package received through a handover.
 */
export function UndoDispatchDialog(props: RouteActionProps) {
  const { route } = props;
  const anyPickedUp = route.stops.some((stop) =>
    stop.tasks.some((task) => task.shipment.status === "picked_up"),
  );
  return (
    <RouteReasonDialog
      {...props}
      trigger="Deshacer despacho"
      title={`¿Deshacer el despacho de la Ruta ${String(route.number)}?`}
      description={`La ruta vuelve a «En preparación» y sus envíos a «Asignado». ${route.courier?.name ?? "El mensajero"} deja de verla y queda libre para otra ruta.`}
      confirm="Deshacer despacho"
      blocked={
        canUndoDispatch(route.stops, anyPickedUp)
          ? undefined
          : "Ya hay paradas completadas o paquetes recogidos, así que el despacho no se puede deshacer. Quita o reasigna los envíos pendientes."
      }
      action={undoDispatch}
    />
  );
}
