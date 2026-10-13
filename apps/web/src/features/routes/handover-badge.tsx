import { formatTrackingNumber, type Handover } from "@domy/domain";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { cancelHandover, confirmHandover } from "./api";

/**
 * "Traspaso pendiente": the package stays with the courier who has it until the receiving
 * courier confirms it. Dispatch confirms it on their behalf or cancels it (FR-025); a
 * handover inside a route reassigned as a whole has no other route to go back to.
 */
export function HandoverBadge({
  handover,
  onResolved,
}: {
  handover: Handover;
  onResolved: (resolved: Handover) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const guide = formatTrackingNumber(handover.shipment.trackingNumber);

  async function resolve(action: typeof confirmHandover, done: string) {
    setBusy(true);
    try {
      const resolved = await action(handover.id, { actionId: crypto.randomUUID() });
      toast.success(done);
      await onResolved(resolved);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar el cambio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="warning">Traspaso pendiente</Badge>
      <span className="text-body-m text-on-surface">
        {handover.fromCourier.name} → {handover.toCourier.name}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="-my-3"
        disabled={busy}
        aria-label={`Confirmar traspaso de ${guide}`}
        onClick={() =>
          void resolve(confirmHandover, `${handover.toCourier.name} ya tiene ${guide}`)
        }
      >
        Confirmar
      </Button>
      {handover.fromRouteId && handover.fromRouteId !== handover.toRouteId && (
        <Button
          variant="ghost"
          size="sm"
          className="-my-3"
          disabled={busy}
          aria-label={`Cancelar traspaso de ${guide}`}
          onClick={() =>
            void resolve(
              cancelHandover,
              `${guide} vuelve a la ruta de ${handover.fromCourier.name}`,
            )
          }
        >
          Cancelar
        </Button>
      )}
    </span>
  );
}
