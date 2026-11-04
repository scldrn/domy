import DragIcon from "@material-symbols/svg-400/rounded/drag_indicator.svg?react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  formatTrackingNumber,
  stopKindLabels,
  validateStopOrder,
  type RouteStop,
  type RouteStopPlan,
  type RouteTask,
} from "@domy/domain";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { Badge } from "@/components/ui/badge";
import { formatCop, formatWindow } from "@/lib/format";
import type { StopState } from "./route-sentences";

const plan = (stops: RouteStop[]): RouteStopPlan[] =>
  stops.map((stop) => ({
    id: stop.id,
    kind: stop.kind,
    address: stop.address,
    neighborhoodId: stop.neighborhood?.id ?? null,
    tasks: stop.tasks.map((task) => ({
      shipmentId: task.shipmentId,
      kind: task.kind,
      status: task.status,
    })),
  }));

const isPending = (stop: RouteStop) => stop.tasks.some((task) => task.status === "pending");

/** The stop's number in its state's color (approved «Detalle de ruta», feature 006). */
const numberLook: Record<StopState, string> = {
  done: "border-success bg-success text-on-success",
  exception: "rounded-[9px] border-error bg-error text-on-error",
  next: "border-info text-info ring-4 ring-info/22",
  pending: "border-outline-variant text-on-surface",
};

const stateWords: Record<StopState, string> = {
  done: "completada",
  exception: "con novedad",
  next: "próxima",
  pending: "pendiente",
};

function StopItem({
  stop,
  index,
  state,
  locked,
  reorderable,
  taskActions,
}: {
  stop: RouteStop;
  index: number;
  state: StopState;
  locked: boolean;
  reorderable: boolean;
  taskActions: ((task: RouteTask) => ReactNode) | undefined;
}) {
  const disabled = locked || !isPending(stop);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${String(transform.y)}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        "flex gap-2.5 border-t border-outline-variant py-3 first:border-t-0",
        state === "next" && "rounded-md border-transparent bg-info-container/40 px-2",
        isDragging && "relative z-10 rounded-md bg-sheet shadow-md",
      )}
    >
      {reorderable && (
        <button
          type="button"
          className="-ml-2 flex size-12 shrink-0 cursor-grab items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high disabled:cursor-default disabled:opacity-38"
          aria-label={`Mover la parada ${String(index + 1)}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <Icon symbol={DragIcon} />
        </button>
      )}
      <span
        className={cn(
          "mt-2 grid size-8 shrink-0 place-items-center rounded-full border-2 bg-sheet text-label-l font-bold tabular-nums",
          numberLook[state],
        )}
      >
        {index + 1}
        <span className="sr-only">, {stateWords[state]}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-2">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-label-s tracking-wide text-on-surface-variant uppercase">
            {stopKindLabels[stop.kind]}
          </span>
          <span className="text-body-l font-semibold text-on-surface">{stop.address}</span>
          {stop.neighborhood && (
            <span className="text-body-s text-on-surface-variant">{stop.neighborhood.name}</span>
          )}
          {state === "next" && <Badge variant="info">Próxima</Badge>}
        </p>
        <ul className="flex flex-col gap-1">
          {stop.tasks.map((task) => (
            <li
              key={task.id}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_7rem_max-content] items-center gap-x-3 gap-y-1 text-body-m max-[820px]:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Link
                to="/envios/$trackingNumber"
                params={{ trackingNumber: task.shipment.trackingNumber }}
                className="guia w-fit rounded-xs text-title-s text-on-surface underline-offset-4 hover:underline"
              >
                {formatTrackingNumber(task.shipment.trackingNumber)}
              </Link>
              <span className="min-w-0 max-[820px]:col-span-2 max-[820px]:row-start-2">
                <span className="block truncate font-medium text-on-surface">
                  {task.kind === "pickup"
                    ? task.shipment.merchant.name
                    : (task.shipment.recipientName ?? task.shipment.merchant.name)}
                </span>
                {task.kind !== "pickup" && (
                  <span className="block truncate text-body-s text-on-surface-variant">
                    {formatWindow(task.shipment.windowStart, task.shipment.windowEnd) ??
                      "Sin franja"}
                  </span>
                )}
              </span>
              <span className="text-right font-semibold text-on-surface-variant tabular-nums max-[820px]:row-start-3 max-[820px]:text-left">
                {task.kind === "pickup" || task.shipment.codAmount === 0
                  ? "Sin recaudo"
                  : formatCop(task.shipment.codAmount)}
              </span>
              <ShipmentStatusMark
                status={task.shipment.status}
                className="max-[820px]:col-start-2 max-[820px]:row-start-1 max-[820px]:justify-self-end"
              />
              {taskActions && (
                <span className="flex flex-wrap items-center justify-end gap-x-1 max-[820px]:col-span-2 max-[820px]:justify-start">
                  {taskActions(task)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * The stops in order, reordered by dragging or with the keyboard (FR-006). A move is checked
 * with the same rule the server applies before it is sent; completed stops do not move.
 */
export function StopList({
  stops,
  states,
  locked = false,
  reorderable = true,
  onReorder,
  onInvalid,
  taskActions,
}: {
  stops: RouteStop[];
  /** Each stop's state, from `stopStates`; pending when not given. */
  states?: StopState[];
  locked?: boolean;
  /** Without the drag handles, for a route that no longer changes. */
  reorderable?: boolean;
  onReorder: (stopIds: string[]) => void;
  onInvalid: (message: string) => void;
  /** What can be done with each shipment at a stop: remove, reassign, its handover. */
  taskActions?: (task: RouteTask) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // An instant scroll: a smooth one is still moving when the next key computes the stop's
    // place, and the move is lost when the page has to scroll (FR-006).
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "auto",
    }),
  );
  const position = (id: string | number) => String(stops.findIndex((stop) => stop.id === id) + 1);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste la parada ${position(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `La parada ${position(active.id)} pasaría a la posición ${position(over.id)}.`
        : `La parada ${position(active.id)} no está sobre una posición.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Soltaste la parada ${position(active.id)} en la posición ${position(over.id)}.`
        : `Soltaste la parada ${position(active.id)} sin moverla.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de la parada ${position(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((stop) => stop.id === active.id);
    const to = stops.findIndex((stop) => stop.id === over.id);
    const next = arrayMove(stops, from, to);
    const problem = validateStopOrder(plan(stops), plan(next));
    if (problem) onInvalid(problem);
    else onReorder(next.map((stop) => stop.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover la parada, presiona espacio, usa las flechas arriba y abajo, y presiona espacio otra vez para soltarla. Escape cancela.",
        },
      }}
    >
      <SortableContext items={stops.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col" aria-label="Paradas de la ruta">
          {stops.map((stop, index) => (
            <StopItem
              key={stop.id}
              stop={stop}
              index={index}
              state={states?.[index] ?? "pending"}
              locked={locked}
              reorderable={reorderable}
              taskActions={taskActions}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
