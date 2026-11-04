import { formatTrackingNumber, type Handover } from "@domy/domain";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { cancelHandover, confirmHandover } from "./api";

/**
 * "Traspaso pendiente": the package stays with the courier who has it until the receiving
 * courier confirms it. Dispatch confirms it on their behalf or cancels it (FR-025); a
 * handover inside a route reassigned as a whole has no other route to go back to. As a `box`
 * it sits under "Ruta y custodia" of the shipment detail (approved "Detalle de envío").
 */
export function HandoverBadge({
  handover,
  onResolved,
  layout = "inline",
}: {
  handover: Handover;
  onResolved: (resolved: Handover) => Promise<void>;
  layout?: "inline" | "box";
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

  const cancellable = handover.fromRouteId !== null && handover.fromRouteId !== handover.toRouteId;
  if (layout === "box")
    return (
      <div className="flex flex-col gap-2 rounded-md bg-tertiary-container px-3.5 py-3 text-body-m text-on-tertiary-container">
        <p>
          <strong className="font-bold">Traspaso pendiente</strong> de {handover.fromCourier.name} a{" "}
          {handover.toCourier.name}, desde el {formatDateTime(handover.requestedAt)}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            aria-label={`Confirmar traspaso de ${guide}`}
            onClick={() =>
              void resolve(confirmHandover, `${handover.toCourier.name} ya tiene ${guide}`)
            }
          >
            Confirmar
          </Button>
          {cancellable && (
            <Button
              variant="ghost"
              className="text-on-tertiary-container"
              disabled={busy}
              aria-label={`Cancelar traspaso de ${guide}`}
              onClick={() =>
                void resolve(
                  cancelHandover,
                  `${guide} vuelve a la ruta de ${handover.fromCourier.name}`,
                )
              }
            >
              Cancelar traspaso
            </Button>
          )}
        </div>
      </div>
    );
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
      {cancellable && (
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
