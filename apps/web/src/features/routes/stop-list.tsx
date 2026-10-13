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
import { formatWindow } from "@/lib/format";

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

function StopItem({
  stop,
  index,
  locked,
  taskActions,
}: {
  stop: RouteStop;
  index: number;
  locked: boolean;
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
      className={cn("flex gap-3 px-3 py-3", isDragging && "relative z-10 bg-sheet shadow-md")}
    >
      <button
        type="button"
        className="flex size-12 shrink-0 cursor-grab items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high disabled:cursor-default disabled:opacity-38"
        aria-label={`Mover la parada ${String(index + 1)}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <Icon symbol={DragIcon} />
      </button>
      <span className="w-6 shrink-0 pt-3 text-title-m text-on-surface tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-3">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-label-l text-on-surface-variant">{stopKindLabels[stop.kind]}</span>
          <span className="text-body-l text-on-surface">{stop.address}</span>
          {stop.neighborhood && (
            <span className="text-body-m text-on-surface-variant">{stop.neighborhood.name}</span>
          )}
        </p>
        <ul className="flex flex-col gap-1">
          {stop.tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-m">
              <Link
                to="/envios/$trackingNumber"
                params={{ trackingNumber: task.shipment.trackingNumber }}
                className="guia rounded-xs text-title-s text-on-surface underline-offset-4 hover:underline"
              >
                {formatTrackingNumber(task.shipment.trackingNumber)}
              </Link>
              <span className="text-on-surface">
                {[task.shipment.merchant.name, task.shipment.recipientName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="text-on-surface-variant">
                {formatWindow(task.shipment.windowStart, task.shipment.windowEnd) ?? "Sin franja"}
              </span>
              <ShipmentStatusMark status={task.shipment.status} />
              {taskActions && (
                <span className="ml-auto flex flex-wrap items-center gap-x-1">
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
  locked = false,
  onReorder,
  onInvalid,
  taskActions,
}: {
  stops: RouteStop[];
  locked?: boolean;
  onReorder: (stopIds: string[]) => void;
  onInvalid: (message: string) => void;
  /** What can be done with each shipment at a stop: remove, reassign, its handover. */
  taskActions?: (task: RouteTask) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
        <ol
          className="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant bg-sheet"
          aria-label="Paradas de la ruta"
        >
          {stops.map((stop, index) => (
            <StopItem
              key={stop.id}
              stop={stop}
              index={index}
              locked={locked}
              taskActions={taskActions}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
