import {
  bogotaToday,
  formatTrackingNumber,
  reason as reasonSchema,
  routeStatusLabels,
  type Handover,
  type RouteDetail,
  type RouteSummary,
  type Shipment,
  type ShipmentStatus,
} from "@domy/domain";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/format";
import { CourierSelect } from "./courier-select";
import { getRoutesBoard, reassignRoute, reassignShipment } from "./api";

/** Every reassignment states why, in 5 to 200 characters (FR-016). */
function ReasonField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>Motivo</FieldLabel>
      <Textarea
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function reasonError(reason: string): string | undefined {
  const parsed = reasonSchema.safeParse(reason);
  return parsed.success ? undefined : (parsed.error.issues[0]?.message ?? "Escribe el motivo.");
}

/** A refusal, with a link to the route it names (a courier's route in progress, FR-009). */
function Problem({ error }: { error: { message: string; routeId?: string } | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
    >
      {error.message}{" "}
      {error.routeId && (
        <Link to="/rutas/$routeId" params={{ routeId: error.routeId }} className="underline">
          Ver esa ruta
        </Link>
      )}
    </p>
  );
}

const problemOf = (error: unknown, fallback: string) => ({
  message: error instanceof ApiError ? error.message : fallback,
  ...(error instanceof ApiError &&
    typeof error.details["routeId"] === "string" && { routeId: error.details["routeId"] }),
});

const routeLabel = (route: RouteSummary, today: string) =>
  [
    `Ruta ${String(route.number)}`,
    route.courier?.name ?? "Sin mensajero",
    routeStatusLabels[route.status],
    ...(route.serviceDate === today ? [] : [formatDate(route.serviceDate)]),
  ].join(" · ");

/**
 * Moves one shipment to another route with a reason (FR-014). A shipment not picked up moves
 * with both stops to a route in preparation or in progress; a picked-up one only to a route
 * in progress, and to another courier through a pending handover (FR-025).
 */
export function ReassignShipmentDialog({
  shipment,
  fromRoute,
  onClose,
  onReassigned,
}: {
  shipment: { id: string; trackingNumber: string; status: ShipmentStatus };
  fromRoute: { id: string; serviceDate: string };
  onClose: () => void;
  onReassigned: (
    result: { shipment: Shipment; handover: Handover | null },
    target: RouteSummary,
  ) => Promise<void>;
}) {
  const today = bogotaToday(now());
  const pickedUp = shipment.status === "picked_up";
  const boards = useQueries({
    queries: [...new Set([today, fromRoute.serviceDate])].map((date) => ({
      queryKey: ["routes-board", date],
      queryFn: () => getRoutesBoard(date),
    })),
  });
  const targets = [
    ...new Map(
      boards
        .flatMap((board) => [
          ...(board.data?.routes ?? []),
          ...(board.data?.routesFromPreviousDays ?? []),
        ])
        .map((route) => [route.id, route]),
    ).values(),
  ]
    .filter(
      (route) =>
        route.id !== fromRoute.id &&
        (route.status === "in_progress" || (!pickedUp && route.status === "draft")),
    )
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.number - b.number);
  // Kept for the dialog's life, so a retry after a lost answer acts once (FR-020).
  const [actionId] = useState(() => crypto.randomUUID());
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    target?: string | undefined;
    reason?: string | undefined;
  }>({});
  const [problem, setProblem] = useState<{ message: string; routeId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const guide = formatTrackingNumber(shipment.trackingNumber);

  async function submit() {
    const target = targets.find((route) => route.id === targetId);
    const next = {
      ...(!target && { target: "Elige la ruta de destino." }),
      reason: reasonError(reason),
    };
    setErrors(next);
    setProblem(null);
    if (!target || next.reason) return;
    setBusy(true);
    try {
      const result = await reassignShipment(shipment.id, {
        actionId,
        toRouteId: target.id,
        reason,
      });
      await onReassigned(result, target);
    } catch (error) {
      setProblem(problemOf(error, "No pudimos reasignar el envío."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Reasignar {guide}</DialogTitle>
          <DialogDescription>
            {pickedUp
              ? "Ya fue recogido: pasa con su entrega a una ruta en curso. Si es de otro mensajero, queda «Traspaso pendiente» hasta que lo reciba."
              : "Pasa con su recogida y su entrega a otra ruta en preparación o en curso."}
          </DialogDescription>
        </DialogHeader>
        <Field data-invalid={Boolean(errors.target)}>
          <OptionSelect
            label="Ruta de destino"
            value={targetId}
            onChange={setTargetId}
            placeholder={targets.length === 0 ? "No hay otra ruta disponible" : "Elige una ruta"}
            options={targets.map((route) => ({ value: route.id, label: routeLabel(route, today) }))}
            invalid={Boolean(errors.target)}
            disabled={targets.length === 0}
          />
          <FieldError>{errors.target}</FieldError>
        </Field>
        <ReasonField value={reason} onChange={setReason} error={errors.reason} />
        <Problem error={problem} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button disabled={busy} onClick={() => void submit()}>
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Passes a route in progress to another courier with a reason (FR-015): its pending stops go
 * with it, and packages the previous courier holds wait for their handovers (FR-025).
 */
export function ReassignRouteDialog({
  route,
  disabled,
  onReassigned,
}: {
  route: RouteDetail;
  disabled: boolean;
  onReassigned: (updated: RouteDetail) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [courier, setCourier] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    courier?: string | undefined;
    reason?: string | undefined;
  }>({});
  const [problem, setProblem] = useState<{ message: string; routeId?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next = {
      ...(!courier && { courier: "Elige el nuevo mensajero." }),
      reason: reasonError(reason),
    };
    setErrors(next);
    setProblem(null);
    if (!courier || next.reason) return;
    setBusy(true);
    try {
      const updated = await reassignRoute(route.id, {
        actionId,
        version: route.version,
        courierId: courier.id,
        reason,
      });
      setOpen(false);
      await onReassigned(updated);
    } catch (error) {
      const field = error instanceof ApiError ? error.fields["courierId"] : undefined;
      if (field) setErrors({ courier: field });
      else setProblem(problemOf(error, "No pudimos reasignar la ruta."));
      setActionId(crypto.randomUUID());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setActionId(crypto.randomUUID());
          setCourier(null);
          setReason("");
          setErrors({});
          setProblem(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        Reasignar ruta
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Reasignar la Ruta {route.number}</DialogTitle>
          <DialogDescription>
            Sus paradas pendientes pasan al nuevo mensajero; las completadas quedan a nombre de
            quien las hizo. Los paquetes que ya recogió otro mensajero quedan «Traspaso pendiente»
            hasta que el nuevo los reciba.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <CourierSelect
            id="reassign-courier"
            label="Nuevo mensajero"
            value={courier}
            onChange={setCourier}
            invalid={Boolean(errors.courier)}
          />
          {errors.courier && (
            <p className="text-body-s text-error" role="alert">
              {errors.courier}
            </p>
          )}
        </div>
        <ReasonField value={reason} onChange={setReason} error={errors.reason} />
        <Problem error={problem} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button disabled={busy} onClick={() => void submit()}>
            Reasignar ruta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
