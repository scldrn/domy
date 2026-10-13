import {
  bogotaToday,
  largeRouteThreshold,
  needsLargeRouteConfirmation,
  type RouteDetail,
} from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { addRouteShipments, listUnassigned } from "@/features/routes/api";
import { UnassignedList } from "@/features/routes/unassigned-list";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

const shipmentsText = (count: number) => (count === 1 ? "1 envío" : `${String(count)} envíos`);

/**
 * "Agregar envíos": the shipments on no route that this route can take, up to the later of its
 * date and today (FR-003, FR-011). Growing beyond 15 shipments asks first (FR-005), and a
 * refusal keeps the selection while the route reloads (FR-021).
 */
export function AddShipmentsDialog({
  route,
  disabled,
  onAdded,
  onRefused,
}: {
  route: RouteDetail;
  disabled: boolean;
  onAdded: (updated: RouteDetail, count: number) => Promise<void>;
  onRefused: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = bogotaToday(now());
  const date = route.serviceDate > today ? route.serviceDate : today;
  const unassigned = useQuery({
    queryKey: ["unassigned", date],
    queryFn: () => listUnassigned(date),
    enabled: open,
  });
  const onRoute = new Set(route.stops.flatMap((stop) => stop.tasks.map((task) => task.shipmentId)))
    .size;
  const count = selected.length;

  async function add(confirmed: boolean) {
    setProblem(null);
    setBusy(true);
    try {
      const updated = await addRouteShipments(route.id, {
        actionId: crypto.randomUUID(),
        version: route.version,
        shipmentIds: selected,
        confirmed,
      });
      setOpen(false);
      setSelected([]);
      setConfirming(false);
      await onAdded(updated, count);
    } catch (error) {
      if (error instanceof ApiError && error.code === "confirmation_required") {
        setConfirming(true);
        return;
      }
      setConfirming(false);
      setProblem(error instanceof ApiError ? error.message : "No pudimos agregar los envíos.");
      await Promise.all([unassigned.refetch(), onRefused()]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setConfirming(false);
        setProblem(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        Agregar envíos
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-5xl">
        {/* Clear of the close button, which sits in the corner. */}
        <DialogHeader className="pr-8">
          <DialogTitle>Agregar envíos a la Ruta {route.number}</DialogTitle>
          <DialogDescription>
            Envíos registrados hasta el {formatDate(date)} que no están en ninguna ruta.{" "}
            {route.status === "in_progress"
              ? "Quedan «En ruta» de inmediato."
              : "Quedan «Asignado» hasta que despaches la ruta."}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 py-1">
          {unassigned.isPending ? (
            <div className="flex flex-col gap-2" aria-label="Cargando los envíos sin asignar">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : unassigned.isError ? (
            <p
              role="alert"
              className="rounded-sm bg-error-container p-4 text-body-l text-on-error-container"
            >
              {unassigned.error.message}
            </p>
          ) : (
            <UnassignedList
              shipments={unassigned.data}
              date={date}
              now={now()}
              selected={selected}
              onToggle={(ids, checked) => {
                setConfirming(false);
                setSelected((current) =>
                  checked
                    ? [...current, ...ids.filter((id) => !current.includes(id))]
                    : current.filter((id) => !ids.includes(id)),
                );
              }}
            />
          )}
        </div>
        {problem && (
          <p
            role="alert"
            className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
          >
            {problem}
          </p>
        )}
        <DialogFooter className="sm:items-center">
          <p
            aria-live="polite"
            className={cn(
              "text-body-m sm:mr-auto",
              confirming ? "text-on-surface" : "text-on-surface-variant",
            )}
          >
            {confirming
              ? `La ruta quedaría con ${String(onRoute + count)} envíos, más de ${String(largeRouteThreshold)} para un solo mensajero.`
              : count === 0
                ? "Elige los envíos que quieres agregar."
                : `${shipmentsText(count)} ${count === 1 ? "elegido" : "elegidos"}.`}
          </p>
          {confirming ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Revisar
              </Button>
              <Button disabled={busy} onClick={() => void add(true)}>
                Agregar {shipmentsText(count)}
              </Button>
            </>
          ) : (
            <>
              <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
              <Button
                disabled={busy || count === 0}
                onClick={() => {
                  if (needsLargeRouteConfirmation(onRoute + count)) setConfirming(true);
                  else void add(false);
                }}
              >
                {count === 0 ? "Agregar" : `Agregar ${shipmentsText(count)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
