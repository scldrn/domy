import ArrowBackIcon from "@material-symbols/svg-400/rounded/arrow_back.svg?react";
import CallIcon from "@material-symbols/svg-400/rounded/call.svg?react";
import ChatIcon from "@material-symbols/svg-400/rounded/chat.svg?react";
import DirectionsIcon from "@material-symbols/svg-400/rounded/directions.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import {
  flagLabel,
  formatCop,
  formatTrackingNumber,
  packageSizeLabels,
  shipmentFlag,
  stopKindLabels,
  resolveCourierRecord,
  type CourierStop,
  type CourierTask,
} from "@domy/domain";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Icon, type Symbol } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { saveCourierRecord, useCourierState } from "@/features/courier/courier-store";
import { DeliveryForm } from "@/features/courier/delivery-form";
import { DisbursementForm } from "@/features/courier/disbursement-form";
import { ExceptionForm } from "@/features/courier/exception-form";
import { ProblemForm } from "@/features/courier/problem-form";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatWindow } from "@/lib/format";
import { currentLocation, watchLocation } from "@/lib/offline/location";
import { shipmentOnRoute } from "@/lib/offline/outbox";

/** A stop of the courier's route and its tasks (feature 003, US1, FR-005–FR-016). */
export const Route = createFileRoute("/_courier/mensajero/parada/$stopId")({
  head: () => ({ meta: [{ title: "Parada · Domy" }] }),
  component: CourierStopPage,
});

/** Colombian mobile numbers are dialed and messaged with the country code. */
function internationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `57${digits}` : digits;
}

function CourierStopPage() {
  const { stopId } = Route.useParams();
  const { view } = useCourierState();
  // The position while the stop is open, attached to its records when fresh (FR-015).
  useEffect(() => watchLocation(), []);

  const stops = view?.route?.stops ?? [];
  const index = stops.findIndex((stop) => stop.id === stopId);
  const stop = stops[index];
  if (!stop) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <EmptyState
          icon={RouteIcon}
          title="Esta parada ya no está en tu ruta"
          description="El coordinador pudo haberla cambiado, o tu ruta terminó."
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <header className="flex flex-col gap-1">
        <p className="text-label-l text-on-surface-variant">Parada {index + 1}</p>
        <h1 className="text-headline-s text-on-surface">{stopKindLabels[stop.kind]}</h1>
        <p className="text-body-l text-on-surface">{stop.address}</p>
        {stop.neighborhood && (
          <p className="text-body-m text-on-surface-variant">{stop.neighborhood.name}</p>
        )}
      </header>
      <Shortcuts stop={stop} />
      <ul className="flex flex-col gap-3" aria-label="Envíos de la parada">
        {stop.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </ul>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/mensajero"
      className={cn(buttonVariants({ variant: "ghost" }), "-ml-4 self-start text-on-surface")}
    >
      <Icon symbol={ArrowBackIcon} />
      Mi ruta
    </Link>
  );
}

/** Call, WhatsApp, and map, each only when its data exists (FR-016). */
function Shortcuts({ stop }: { stop: CourierStop }) {
  const place = [stop.address, stop.neighborhood?.name, "Antioquia"].filter(Boolean).join(", ");
  const links: { href: string; label: string; icon: Symbol; external?: boolean }[] = [
    ...(stop.contactPhone
      ? [
          {
            href: `tel:+${internationalPhone(stop.contactPhone)}`,
            label: "Llamar",
            icon: CallIcon,
          },
          {
            href: `https://wa.me/${internationalPhone(stop.contactPhone)}`,
            label: "WhatsApp",
            icon: ChatIcon,
            external: true,
          },
        ]
      : []),
    {
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`,
      label: "Mapa",
      icon: DirectionsIcon,
      external: true,
    },
  ];
  return (
    <nav aria-label="Atajos de la parada" className="grid grid-cols-3 gap-2">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          {...(link.external && { target: "_blank", rel: "noreferrer" })}
          className={cn(buttonVariants({ variant: "outline" }), "px-2 has-[svg]:pl-2")}
        >
          <Icon symbol={link.icon} />
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function TaskCard({ task }: { task: CourierTask }) {
  const { user } = Route.useRouteContext();
  const { view } = useCourierState();
  const [form, setForm] = useState<"delivery" | "disbursement" | "exception" | "problem" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  if (!user) return null;
  const pending = task.status === "pending";
  const window = formatWindow(task.windowStart, task.windowEnd);
  const flag = shipmentFlag(
    { status: task.shipmentStatus, windowEnd: task.windowEnd ? new Date(task.windowEnd) : null },
    now(),
  );
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
      await saveCourierRecord(user.id, {
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
      await saveCourierRecord(user.id, {
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
        "flex flex-col gap-3 rounded-md border border-outline-variant p-4",
        pending ? "bg-sheet" : "bg-surface-container-low",
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
          <div>
            <dt className="sr-only">Destinatario</dt>
            <dd>{task.recipientName}</dd>
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
          <div>
            <dt className="sr-only">Valor a recaudar</dt>
            <dd className="text-title-m tabular-nums">Cobrar {formatCop(task.codAmount)}</dd>
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
        <Button variant="secondary" disabled={saving} onClick={() => void pickUp()}>
          Confirmar recogida
        </Button>
      )}
      {pending && (finishing || returning) && task.blockedByHandover && (
        <div className="flex flex-col gap-2">
          <p className="text-body-l text-on-surface-variant">
            Traspaso pendiente · Espera a que {task.blockedByHandover.fromCourier.name} te entregue
            el paquete.
          </p>
          <Button disabled={saving} onClick={() => void receive()}>
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
          variant="secondary"
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
          <Button variant="secondary" disabled={saving} onClick={() => void pickUp()}>
            Confirmar recogida
          </Button>
        </div>
      )}
      {pending && finishing && !task.blockedByHandover && pickedUp && (
        <Button
          variant="secondary"
          onClick={() => {
            setForm("delivery");
          }}
        >
          {task.kind === "errand" ? "Completar diligencia" : "Registrar entrega"}
        </Button>
      )}
      {finishing && (
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
        <Button
          variant="outline"
          onClick={() => {
            setForm("exception");
          }}
        >
          Reportar novedad
        </Button>
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
          userId={user.id}
          open
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
          onSaved={() => {
            setForm(null);
            toast.success("Novedad guardada");
          }}
        />
      )}
      {form === "problem" && (
        <ProblemForm
          task={task}
          userId={user.id}
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
          userId={user.id}
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
          userId={user.id}
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
