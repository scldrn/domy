import {
  boardListRank,
  boardQuery,
  boardStageLabels,
  boardStageStatuses,
  boardStages,
  bogotaToday,
  buildAttention,
  exceptionsToDecide,
  filterBoard,
  flagLabel,
  formatTrackingNumber,
  hasAlert,
  recordFlagLabels,
  shipmentFlag,
  shipmentKindLabels,
  stageOf,
  type BoardEntry,
  type BoardStage,
  type RouteSummary,
  type ShipmentStatus,
} from "@domy/domain";
import ArrowIcon from "@material-symbols/svg-400/rounded/arrow_forward.svg?react";
import CampaignIcon from "@material-symbols/svg-400/rounded/campaign.svg?react";
import FilterOffIcon from "@material-symbols/svg-400/rounded/filter_alt_off.svg?react";
import InboxIcon from "@material-symbols/svg-400/rounded/inbox.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DataList, type DataColumn } from "@/components/data-list";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Icon, type Symbol } from "@/components/icon";
import { Money } from "@/components/money";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { StageCounts } from "@/components/stage-counts";
import { SummarySentence } from "@/components/summary-sentence";
import { TrackingNumber } from "@/components/tracking-number";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionList, type AttentionIntent } from "@/features/board/attention-list";
import { boardQueryOptions } from "@/features/board/board-query";
import { CourierProgress } from "@/features/board/courier-progress";
import { daySentence } from "@/features/board/day-sentence";
import { DayStepper } from "@/components/day-stepper";
import { ShipmentPanel, type OpenShipment } from "@/features/board/shipment-panel";
import { listCouriers } from "@/features/master-data/api";
import { notificationListQueryOptions } from "@/features/notifications/api";
import { confirmHandover, dispatchRoute, getRoute, getRoutesBoard } from "@/features/routes/api";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatDate, formatLongDate, formatWindow } from "@/lib/format";

/** Changes by any user appear within 30 seconds (FR-023, research R9). */
const pollMs = 20_000;
const flagRefreshMs = 30_000;

const panelRoute = getRouteApi("/_panel");

/** Re-renders every `ms` so time-based flags stay current between polls. */
function useTicker(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((tick) => tick + 1);
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [ms]);
}

function distinctById(items: ({ id: string; name: string } | null)[]) {
  const byId = new Map(items.filter((item) => item !== null).map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Lowercase status names for the stage breakdowns ("5 registrados · 3 asignados"). */
const statusCounts: Record<ShipmentStatus, [string, string]> = {
  registered: ["registrado", "registrados"],
  assigned: ["asignado", "asignados"],
  dispatched: ["en ruta", "en ruta"],
  picked_up: ["recogido", "recogidos"],
  delivered: ["entregado", "entregados"],
  exception: ["novedad", "novedades"],
  returned: ["devuelto", "devueltos"],
  voided: ["anulado", "anulados"],
};

/** Each stage's square and bar segment on pizarra (design-system.md §8, "Stage counts"). */
const stageTones: Record<BoardStage, string> = {
  open: "bg-on-rail-variant",
  street: "bg-rail-info",
  delivered: "bg-rail-success",
  exception: "bg-rail-error",
  closed: "bg-on-rail-variant/35",
};

/** The board's own filters on top of the board query: a stage, and "Con alerta". */
const boardSearch = boardQuery.extend({
  stage: z.enum(boardStages).optional(),
  alert: z.enum(["1"]).optional(),
});
type BoardSearch = z.infer<typeof boardSearch>;

export const Route = createFileRoute("/_panel/")({
  validateSearch: boardSearch,
  head: () => ({ meta: [{ title: "Tablero · Domy" }] }),
  component: DispatchBoardPage,
});

/** The shipment list's anchor, where the stages and "Además" take the dispatcher. */
const listId = "envios";

function scrollToList() {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(listId)
    ?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
}

/**
 * The dispatch board (feature 006, FR-018): the day in one sentence with its stages and the
 * two shortcuts, then "Por resolver" beside the couriers' progress, then the shipment list.
 * A shipment opens in the side panel with its actions (FR-019).
 */
function DispatchBoardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = panelRoute.useRouteContext();
  const queryClient = useQueryClient();
  const currentTime = now();
  const today = bogotaToday(currentTime);
  const date = search.date ?? today;
  const board = useQuery({ ...boardQueryOptions(search.date), refetchInterval: pollMs });
  const routes = useQuery({
    queryKey: ["routes-board", date],
    queryFn: () => getRoutesBoard(date),
    refetchInterval: pollMs,
  });
  const couriers = useQuery({
    queryKey: ["couriers", "board-phones"],
    queryFn: () => listCouriers(""),
    staleTime: 5 * 60_000,
  });
  const notifications = useQuery({
    ...notificationListQueryOptions(user.id, date),
    enabled: date <= today,
    refetchInterval: pollMs,
  });
  useTicker(flagRefreshMs);
  const [open, setOpen] = useState<OpenShipment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Filters keep the page where it is; the stages and "Además" then take it to the list.
  const setFilters = (next: Partial<BoardSearch>, then?: () => void) => {
    void navigate({
      search: (previous) => ({ ...previous, ...next }),
      replace: true,
      resetScroll: false,
    }).then(then);
  };

  const refreshBoard = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["board"] }),
      queryClient.invalidateQueries({ queryKey: ["routes-board"] }),
    ]);

  const data = board.data;
  const isToday = date === today;
  const all: BoardEntry[] = data ? [...data.pendingFromPreviousDays, ...data.shipments] : [];
  const byId = new Map(all.map((shipment) => [shipment.id, shipment]));
  const attention = buildAttention({ shipments: all, role: user.role, now: currentTime });

  const act = async (shipment: BoardEntry, intent: AttentionIntent) => {
    if (intent === "confirm_handover" && shipment.pendingHandover) {
      const handover = shipment.pendingHandover;
      setBusy(shipment.id);
      try {
        await confirmHandover(handover.id, { actionId: crypto.randomUUID() });
        await refreshBoard();
        toast.success(
          `${formatTrackingNumber(shipment.trackingNumber)}: ahora lo tiene ${handover.toCourier.name}`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No pudimos confirmar el traspaso.");
      } finally {
        setBusy(null);
      }
      return;
    }
    setOpen({
      trackingNumber: shipment.trackingNumber,
      ...(intent === "reassign" && { action: "reassign" as const }),
    });
  };

  const dispatch = async (route: RouteSummary) => {
    setBusy(route.id);
    try {
      const current = await getRoute(route.id);
      await dispatchRoute(route.id, { actionId: crypto.randomUUID(), version: current.version });
      await refreshBoard();
      toast.success(
        `Ruta ${String(route.number)} despachada${route.courier ? ` a ${route.courier.name}` : ""}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos despachar la ruta.");
    } finally {
      setBusy(null);
    }
  };

  // The list: the board's filters, then "Con alerta", then the stage (or a legacy status).
  const scope = data
    ? filterBoard(data.date, all, { ...search, status: undefined }, currentTime)
    : null;
  const scoped = scope ? [...scope.pendingFromPreviousDays, ...scope.shipments] : [];
  const alerted = search.alert
    ? scoped.filter((shipment) => hasAlert(shipment, currentTime))
    : scoped;
  const listed = alerted
    .filter((shipment) => !search.stage || stageOf(shipment.status) === search.stage)
    .filter((shipment) => !search.status || shipment.status === search.status)
    .sort(
      (a, b) =>
        boardListRank(a, date, currentTime) - boardListRank(b, date, currentTime) ||
        windowEnd(a) - windowEnd(b),
    );
  const filtered = Boolean(
    search.merchantId ??
    search.courierId ??
    search.rateZoneId ??
    search.flag ??
    search.status ??
    search.stage ??
    search.alert,
  );
  const clearFilters = () => {
    setFilters({
      merchantId: undefined,
      courierId: undefined,
      rateZoneId: undefined,
      flag: undefined,
      status: undefined,
      stage: undefined,
      alert: undefined,
    });
  };

  const live = data?.shipments.filter((shipment) => shipment.status !== "voided") ?? [];
  const count = (status: ShipmentStatus) =>
    all.filter((shipment) => shipment.status === status).length;
  const stages = boardStages.map((stage) => {
    const statuses = boardStageStatuses[stage];
    const total = statuses.reduce((sum, status) => sum + count(status), 0);
    let sub = statuses
      .map((status) => {
        const [one, many] = statusCounts[status];
        return `${String(count(status))} ${plural(count(status), one, many)}`;
      })
      .join(" · ");
    if (stage === "delivered") {
      const share = live.length > 0 ? Math.round((count("delivered") / live.length) * 100) : 0;
      sub = `${String(share)} % ${isToday ? "de hoy" : "del día"}`;
    }
    if (stage === "exception") sub = `${String(exceptionsToDecide(all).length)} por decidir`;
    return {
      key: stage,
      label: boardStageLabels[stage],
      count: total,
      sub,
      tone: stageTones[stage],
    };
  });

  const unassigned = routes.data?.unassignedCount;
  const toNotify = notifications.data?.merchants
    .map((merchant) => merchant.shipments.filter((shipment) => shipment.notifiedAt === null).length)
    .filter((pending) => pending > 0);

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="dia"
        className="on-rail flex flex-col gap-5 rounded-xl bg-rail p-[clamp(1.25rem,2.2vw,1.75rem)] text-on-rail"
      >
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <div className="min-w-0 flex-[1_1_28rem]">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <h1
                id="dia"
                className="text-[clamp(1.625rem,2.6vw,2.125rem)] leading-[1.1] font-[650] tracking-[-0.02em] [font-stretch:114%]"
              >
                <span className="sr-only">Tablero de despacho, </span>
                {formatLongDate(date, today)}
              </h1>
              <DayStepper
                date={date}
                today={today}
                onChange={(next) => {
                  setFilters({ date: next === today ? undefined : next });
                }}
              />
            </div>
            {data ? (
              <SummarySentence
                surface="rail"
                className="mt-3"
                parts={daySentence({
                  isToday,
                  shipments: data.shipments,
                  pending: isToday ? data.pendingFromPreviousDays : [],
                  now: currentTime,
                })}
              />
            ) : (
              <Skeleton className="mt-3 h-7 w-full max-w-2xl bg-rail-raised" />
            )}
          </div>
          <nav
            aria-label="Atajos del día"
            className="flex min-w-60 flex-[0_1_20rem] flex-col gap-2"
          >
            <Shortcut
              to="/rutas"
              date={date}
              icon={RouteIcon}
              title={
                unassigned === undefined
                  ? "Rutas"
                  : unassigned === 0
                    ? "Todo está asignado"
                    : `${String(unassigned)} ${plural(unassigned, "envío sin asignar", "envíos sin asignar")}`
              }
              hint="Crear la siguiente ruta"
            />
            {date <= today && (
              <Shortcut
                to="/notificar"
                date={date}
                icon={CampaignIcon}
                title={
                  toNotify === undefined
                    ? "Notificar clientes"
                    : toNotify.length === 0
                      ? "Ningún cliente por notificar"
                      : `${String(toNotify.length)} ${plural(toNotify.length, "cliente por notificar", "clientes por notificar")}`
                }
                hint={
                  toNotify && toNotify.length > 0
                    ? (() => {
                        const pending = toNotify.reduce((sum, next) => sum + next, 0);
                        return `${String(pending)} ${plural(pending, "envío sin enlace enviado", "envíos sin enlace enviado")}`;
                      })()
                    : "Todos los enlaces están enviados"
                }
              />
            )}
          </nav>
        </div>
        {data && (
          <StageCounts
            stages={stages}
            selected={search.stage}
            onSelect={(stage) => {
              setFilters({ stage, status: undefined }, stage ? scrollToList : undefined);
            }}
          />
        )}
      </section>

      {board.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Cargando el tablero">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : board.isError && !data ? (
        <p
          role="alert"
          className="rounded-sm bg-error-container p-4 text-body-l text-on-error-container"
        >
          {board.error.message}
        </p>
      ) : data ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(25rem,100%),1fr))] items-stretch gap-5">
            <AttentionList
              items={attention.items}
              shipments={byId}
              minor={attention.minor}
              now={currentTime}
              date={date}
              busy={busy}
              onAct={(shipment, intent) => {
                void act(shipment, intent);
              }}
              onShowAlerts={() => {
                setFilters({ alert: "1", stage: undefined, status: undefined }, scrollToList);
              }}
            />
            <CourierProgress
              routes={routes.data?.routes ?? []}
              phones={new Map((couriers.data ?? []).map((courier) => [courier.id, courier.phone]))}
              now={currentTime}
              date={date}
              selectedCourierId={search.courierId}
              dispatching={busy}
              onSelectCourier={(courierId) => {
                setFilters({ courierId }, courierId ? scrollToList : undefined);
              }}
              onDispatch={(route) => {
                void dispatch(route);
              }}
            />
          </div>

          <section
            id={listId}
            aria-labelledby="envios-titulo"
            className="scroll-mt-3 rounded-lg border border-outline-variant bg-sheet pt-4 pb-1"
          >
            <FilterBar
              title={
                <h2
                  id="envios-titulo"
                  className="flex items-baseline gap-2 text-title-l text-on-surface"
                >
                  Envíos{" "}
                  <span className="text-body-l text-on-surface-variant tabular-nums">
                    {listed.length}
                  </span>
                </h2>
              }
              tabs={[
                { key: undefined, label: "Todos", count: alerted.length },
                ...boardStages.map((stage) => ({
                  key: stage,
                  label: boardStageLabels[stage],
                  count: alerted.filter((shipment) => stageOf(shipment.status) === stage).length,
                })),
              ]}
              selectedTab={search.stage}
              onTab={(stage) => {
                setFilters({ stage, status: undefined });
              }}
              alert={{
                label: "Con alerta",
                count: scoped.filter((shipment) => hasAlert(shipment, currentTime)).length,
                pressed: Boolean(search.alert),
                onToggle: () => {
                  setFilters({ alert: search.alert ? undefined : "1" });
                },
              }}
              selects={[
                {
                  label: "Cliente",
                  allLabel: "Todos los clientes",
                  value: search.merchantId,
                  options: distinctById(all.map((shipment) => shipment.merchant)),
                  onChange: (merchantId) => {
                    setFilters({ merchantId });
                  },
                },
                {
                  label: "Mensajero",
                  allLabel: "Todos los mensajeros",
                  value: search.courierId,
                  options: distinctById(all.map((shipment) => shipment.courier)),
                  onChange: (courierId) => {
                    setFilters({ courierId });
                  },
                },
              ]}
              {...(filtered && { onClear: clearFilters })}
            />
            <DataList
              key={`${date}-${search.stage ?? ""}-${search.alert ?? ""}`}
              label="Envíos del día"
              columns={columns(date, currentTime, (shipment) => {
                setOpen({ trackingNumber: shipment.trackingNumber });
              })}
              template="6.75rem minmax(8rem,1fr) minmax(10rem,1.2fr) minmax(9.5rem,1.05fr) minmax(10.5rem,1.15fr) 6rem 10rem"
              rows={listed}
              rowKey={(shipment) => shipment.id}
              rowId={(shipment) => `envio-${shipment.trackingNumber}`}
              isActive={(shipment) => open?.trackingNumber === shipment.trackingNumber}
              onOpen={(shipment) => {
                setOpen({ trackingNumber: shipment.trackingNumber });
              }}
              moreLabel={(total) => `Ver los ${String(total)} envíos`}
              empty={
                filtered ? (
                  <EmptyState
                    icon={FilterOffIcon}
                    className="mx-5 mb-4 border-0"
                    title="Ningún envío de este día coincide con los filtros"
                    action={
                      <Button variant="outline" onClick={clearFilters}>
                        Quitar filtros
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={InboxIcon}
                    className="mx-5 mb-4 border-0"
                    title={
                      isToday
                        ? "Todavía no hay envíos para hoy"
                        : "No hay envíos registrados para este día"
                    }
                    description="Los envíos que registres para esta fecha aparecerán aquí."
                    action={
                      <Link to="/envios/nuevo" className={buttonVariants()}>
                        Registrar un envío
                      </Link>
                    }
                  />
                )
              }
            />
          </section>
        </>
      ) : null}

      <ShipmentPanel
        open={open}
        onClose={() => {
          setOpen(null);
        }}
      />
    </div>
  );
}

/** A shortcut to the screen that owns a job (design-system.md §8, "Day summary"). */
function Shortcut({
  to,
  date,
  icon,
  title,
  hint,
}: {
  to: "/rutas" | "/notificar";
  date: string;
  icon: Symbol;
  title: ReactNode;
  hint: ReactNode;
}) {
  return (
    <Link
      to={to}
      search={{ date }}
      className="group flex min-h-16 items-center gap-3 rounded-lg border border-rail-line px-3.5 py-2.5 text-on-rail transition-colors hover:border-on-rail-variant/60 hover:bg-rail-raised"
    >
      <Icon symbol={icon} size={20} className="text-accent" />
      <span className="min-w-0">
        <strong className="block text-title-s">{title}</strong>
        <span className="block text-body-s text-on-rail-variant">{hint}</span>
      </span>
      <Icon
        symbol={ArrowIcon}
        size={20}
        className="ml-auto text-accent transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** Windows that close first come first; shipments without a window go last. */
function windowEnd(shipment: BoardEntry): number {
  return shipment.windowEnd ? Date.parse(shipment.windowEnd) : Number.POSITIVE_INFINITY;
}

/** The notes under a shipment's state: its record flags, a handover, a return, a fee. */
function notesOf(shipment: BoardEntry): string[] {
  const notes: string[] = shipment.recordFlags.map((flag) => recordFlagLabels[flag]);
  if (shipment.status === "exception" && shipment.returnDecided) notes.push("Devolución en curso");
  if (shipment.pendingHandover) notes.push("Traspaso pendiente");
  if (shipment.feeNeedsReview) notes.push("Tarifa por revisar");
  return notes;
}

/** The board list's columns (design-system.md §8, "Shipment list"). */
function columns(
  date: string,
  currentTime: Date,
  onOpen: (shipment: BoardEntry) => void,
): DataColumn<BoardEntry>[] {
  return [
    {
      key: "guia",
      header: "Guía",
      card: { order: 1, place: "start" },
      cell: (shipment) => (
        <>
          <button
            type="button"
            onClick={() => {
              onOpen(shipment);
            }}
            className="cursor-pointer rounded-xs text-left text-on-surface underline-offset-4 hover:underline"
          >
            <TrackingNumber value={shipment.trackingNumber} className="text-title-m" />
          </button>
          {shipment.serviceDate < date ? (
            <span className="block text-body-s text-on-surface-variant">
              {formatDate(shipment.serviceDate)}, pendiente
            </span>
          ) : (
            shipment.kind !== "delivery" && (
              <span className="block text-body-s text-on-surface-variant">
                {shipmentKindLabels[shipment.kind]}
              </span>
            )
          )}
        </>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      card: { order: 6, place: "start" },
      cell: (shipment) => (
        <span className="line-clamp-2 max-[820px]:text-body-s max-[820px]:text-on-surface-variant">
          {shipment.merchant.name}
        </span>
      ),
    },
    {
      key: "destinatario",
      header: "Destinatario",
      card: { order: 3, place: "start" },
      cell: (shipment) => (
        <>
          <span className="block truncate">
            {shipment.recipientName ?? shipmentKindLabels[shipment.kind]}
          </span>
          <span className="line-clamp-2 text-body-s text-on-surface-variant">
            {shipment.recipientNeighborhood?.name ?? "Sin barrio"}
          </span>
        </>
      ),
    },
    {
      key: "mensajero",
      header: "Mensajero",
      card: { order: 7, place: "end" },
      cell: (shipment) => (
        <>
          <span className={cn("block truncate", !shipment.courier && "text-on-surface-variant")}>
            {shipment.courier?.name ?? "Sin asignar"}
          </span>
          <span className="block truncate text-body-s text-on-surface-variant max-[820px]:hidden">
            {shipment.routeNumber !== null ? `Ruta ${String(shipment.routeNumber)}` : "Sin ruta"}
          </span>
        </>
      ),
    },
    {
      key: "franja",
      header: "Franja",
      card: { order: 5, place: "full" },
      cell: (shipment) => {
        const flag = shipmentFlag(
          {
            status: shipment.status,
            windowEnd: shipment.windowEnd ? new Date(shipment.windowEnd) : null,
          },
          currentTime,
        );
        const window = formatWindow(shipment.windowStart, shipment.windowEnd);
        return (
          <>
            <span className={cn("block", !window && "text-on-surface-variant")}>
              {window ?? "Sin franja"}
            </span>
            {flag && (
              <span
                className={cn(
                  "block text-label-m",
                  flag.kind === "late" ? "text-error" : "text-warning",
                )}
              >
                {flagLabel(flag)}
              </span>
            )}
          </>
        );
      },
    },
    {
      key: "recaudo",
      header: "Recaudo",
      align: "end",
      card: { order: 4, place: "end" },
      cell: (shipment) => (
        <Money amount={shipment.codAmount} emptyLabel="Sin recaudo" className="font-semibold" />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      card: { order: 2, place: "end" },
      cell: (shipment) => (
        <>
          <ShipmentStatusMark status={shipment.status} />
          {notesOf(shipment).map((note) => (
            <span
              key={note}
              className={cn(
                "block truncate text-label-m",
                note === "Foto pendiente" ? "text-on-surface-variant" : "text-warning",
              )}
            >
              {note}
            </span>
          ))}
        </>
      ),
    },
  ];
}
