import {
  exceptionReasonLabels,
  exceptionReasons,
  flagLabel,
  formatCop,
  formatTrackingNumber,
  packageSizeLabels,
  shipmentFlag,
  resolveCourierRecord,
  type CourierSnapshot,
  type CourierTask,
  type ExceptionReason,
} from "@domy/domain";
import { useState } from "react";
import { toast } from "sonner";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Button } from "@/components/ui/button";
import { saveCourierRecord } from "@/features/courier/courier-store";
import { DeliveryForm } from "@/features/courier/delivery-form";
import { DisbursementForm } from "@/features/courier/disbursement-form";
import { ExceptionForm } from "@/features/courier/exception-form";
import { ProblemForm } from "@/features/courier/problem-form";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatWindow } from "@/lib/format";
import { currentLocation } from "@/lib/offline/location";
import { shipmentOnRoute } from "@/lib/offline/outbox";

/**
 * A task of a stop with its main action and forms (feature 003, US1, FR-005–FR-016). It lives
 * outside the route file: a route file that exports anything but `Route` cannot be code-split,
 * and the courier's forms would then load with every page, the public ones included
 * (constitution: public tracking within 3 s).
 */
export function TaskCard({
  task,
  userId,
  view,
}: {
  task: CourierTask;
  userId: string | null;
  view: CourierSnapshot | null;
}) {
  const [form, setForm] = useState<"delivery" | "disbursement" | "exception" | "problem" | null>(
    null,
  );
  const [exceptionReason, setExceptionReason] = useState<ExceptionReason | null>(null);
  const [saving, setSaving] = useState(false);
  if (!userId) return null;
  const pending = task.status === "pending";
  const window = formatWindow(task.windowStart, task.windowEnd);
  const flag = shipmentFlag(
    { status: task.shipmentStatus, windowEnd: task.windowEnd ? new Date(task.windowEnd) : null },
    now(),
  );
  const canDisburse = task.shipmentStatus !== "voided";
  const finishing = task.kind === "delivery" || task.kind === "errand";
  const returning = task.kind === "return";
  const shipmentState = view?.route
    ? shipmentOnRoute(
        view.route,
        view.route.stops
          .flatMap((stop) => stop.tasks)
          .filter((candidate) => candidate.shipmentId === task.shipmentId),
        [],
      )
    : null;
  const canReturn =
    shipmentState &&
    resolveCourierRecord(shipmentState, {
      kind: "return",
      courierId: shipmentState.route?.courierId ?? "",
    }).outcome === "applied";
  const pickedUp = task.shipmentKind === "errand" || task.shipmentStatus === "picked_up";
  const receive = async () => {
    setSaving(true);
    try {
      await saveCourierRecord(userId, {
        id: crypto.randomUUID(),
        shipmentId: task.shipmentId,
        kind: "handover_confirmation",
        occurredAt: new Date().toISOString(),
        location: currentLocation(),
      });
    } catch {
      toast.error("No se pudo guardar la recepción en el teléfono. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  /** A pickup, saved on the phone first and shown at once (FR-006, FR-018). */
  const pickUp = async () => {
    setSaving(true);
    try {
      await saveCourierRecord(userId, {
        id: crypto.randomUUID(),
        shipmentId: task.shipmentId,
        kind: "pickup",
        occurredAt: new Date().toISOString(),
        location: currentLocation(),
      });
      toast.success(`Guía ${formatTrackingNumber(task.trackingNumber)} recogida`);
    } catch {
      toast.error("No se pudo guardar en el teléfono. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-outline-variant p-4",
        pending ? "bg-sheet" : "bg-sheet-alt",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="guia text-title-l text-on-surface">
          {formatTrackingNumber(task.trackingNumber)}
        </span>
        <ShipmentStatusMark status={task.shipmentStatus} />
      </div>
      <dl className="flex flex-col gap-1 text-body-l text-on-surface">
        <div>
          <dt className="sr-only">Cliente</dt>
          <dd>{task.merchant.name}</dd>
        </div>
        {task.recipientName && (
          <div className="-order-1">
            <dt className="sr-only">Destinatario</dt>
            <dd className="text-title-m">{task.recipientName}</dd>
          </div>
        )}
        {task.carrier && (
          <div>
            <dt className="sr-only">Transportadora</dt>
            <dd>
              {task.carrier.name}
              {task.destinationTown ? ` · hacia ${task.destinationTown}` : ""}
            </dd>
          </div>
        )}
        {task.errandDescription && (
          <div>
            <dt className="sr-only">Diligencia</dt>
            <dd>{task.errandDescription}</dd>
          </div>
        )}
        {(task.packageCount ?? task.packageSize) && (
          <div className="text-body-m text-on-surface-variant">
            <dt className="sr-only">Paquetes</dt>
            <dd>
              {[
                task.packageCount &&
                  (task.packageCount === 1 ? "1 paquete" : `${String(task.packageCount)} paquetes`),
                task.packageSize && packageSizeLabels[task.packageSize],
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
        {window && (
          <div className="text-body-m text-on-surface-variant">
            <dt className="sr-only">Ventana de entrega</dt>
            <dd>
              {window}
              {flag && pending && (
                <span className={cn("ml-2", flag.kind === "late" ? "text-error" : "text-warning")}>
                  {flagLabel(flag)}
                </span>
              )}
            </dd>
          </div>
        )}
        {task.codAmount > 0 && finishing && (
          <div className="my-1 rounded-md bg-sheet-alt px-3.5 py-3">
            <dt className="sr-only">Valor a recaudar</dt>
            <dd className="flex items-baseline justify-between gap-3 text-title-m tabular-nums">
              Cobrar <span className="text-headline-s">{formatCop(task.codAmount)}</span>
            </dd>
          </div>
        )}
        {task.instructions && (
          <div className="text-body-m text-on-surface-variant">
            <dt className="sr-only">Instrucciones</dt>
            <dd>{task.instructions}</dd>
          </div>
        )}
        {task.problemNote && (
          <div className="text-body-l text-error">
            <dt className="sr-only">
              {returning ? "Problema de devolución" : "Problema de recogida"}
            </dt>
            <dd>{returning ? task.problemNote : `Problema de recogida: ${task.problemNote}`}</dd>
          </div>
        )}
      </dl>

      {pending && task.kind === "pickup" && (
        <Button variant="accent" size="lg" disabled={saving} onClick={() => void pickUp()}>
          Confirmar recogida
        </Button>
      )}
      {pending && (finishing || returning) && task.blockedByHandover && (
        <div className="flex flex-col gap-2">
          <p className="text-body-l text-on-surface-variant">
            Traspaso pendiente · Espera a que {task.blockedByHandover.fromCourier.name} te entregue
            el paquete.
          </p>
          <Button variant="accent" size="lg" disabled={saving} onClick={() => void receive()}>
            Recibí el paquete
          </Button>
        </div>
      )}
      {pending && returning && !task.blockedByHandover && !canReturn && (
        <p className="text-body-l text-on-surface-variant">
          Primero confirma la recogida en oficina.
        </p>
      )}
      {pending && returning && canReturn && (
        <Button
          variant="accent"
          size="lg"
          onClick={() => {
            setForm("delivery");
          }}
        >
          Confirmar devolución
        </Button>
      )}
      {pending && finishing && !task.blockedByHandover && !pickedUp && (
        <div className="flex flex-col gap-2">
          <p className="text-body-l text-on-surface-variant">
            Primero confirma la recogida de este envío.
          </p>
          <Button variant="accent" size="lg" disabled={saving} onClick={() => void pickUp()}>
            Confirmar recogida
          </Button>
        </div>
      )}
      {pending && finishing && !task.blockedByHandover && pickedUp && (
        <Button
          variant="accent"
          size="lg"
          onClick={() => {
            setForm("delivery");
          }}
        >
          {task.kind === "errand" ? "Completar diligencia" : "Registrar entrega"}
        </Button>
      )}
      {canDisburse && (
        <Button
          variant="ghost"
          className="max-w-full self-start text-left whitespace-normal"
          onClick={() => {
            setForm("disbursement");
          }}
        >
          Registrar pago por cuenta del cliente
        </Button>
      )}

      {pending && task.kind === "delivery" && !task.blockedByHandover && pickedUp && (
        <fieldset className="flex flex-col">
          <legend className="mb-2 text-label-l text-on-surface-variant">Reportar novedad</legend>
          <div className="grid grid-cols-3 gap-2">
            {exceptionReasons.map((reason) => (
              <Button
                key={reason}
                type="button"
                variant="outline"
                className="h-auto min-h-14 w-full px-2 py-1.5 text-center leading-tight whitespace-normal"
                onClick={() => {
                  setExceptionReason(reason);
                  setForm("exception");
                }}
              >
                {exceptionReasonLabels[reason]}
              </Button>
            ))}
          </div>
        </fieldset>
      )}
      {pending && (task.kind === "pickup" || task.kind === "errand" || returning) && (
        <Button
          variant="outline"
          onClick={() => {
            setForm("problem");
          }}
        >
          Reportar problema
        </Button>
      )}
      {form === "exception" && (
        <ExceptionForm
          task={task}
          userId={userId}
          open
          {...(exceptionReason ? { initialReason: exceptionReason } : {})}
          onOpenChange={(open) => {
            if (!open) {
              setForm(null);
              setExceptionReason(null);
            }
          }}
          onSaved={() => {
            setForm(null);
            setExceptionReason(null);
            toast.success("Novedad guardada");
          }}
        />
      )}
      {form === "problem" && (
        <ProblemForm
          task={task}
          userId={userId}
          open
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
          onSaved={() => {
            setForm(null);
            toast.success("Problema guardado");
          }}
        />
      )}

      {form === "delivery" && (
        <DeliveryForm
          task={task}
          userId={userId}
          open
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
          onSaved={() => {
            setForm(null);
            toast.success(
              returning
                ? `Guía ${formatTrackingNumber(task.trackingNumber)} devuelta`
                : task.kind === "errand"
                  ? `Guía ${formatTrackingNumber(task.trackingNumber)}: diligencia completada`
                  : `Guía ${formatTrackingNumber(task.trackingNumber)} entregada`,
            );
          }}
        />
      )}
      {form === "disbursement" && (
        <DisbursementForm
          task={task}
          userId={userId}
          open
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
          onSaved={() => {
            setForm(null);
            toast.success("Pago guardado");
          }}
        />
      )}
    </li>
  );
}
