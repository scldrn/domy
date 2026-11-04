import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import {
  bogotaToday,
  largeRouteThreshold,
  needsLargeRouteConfirmation,
  type RouteSummary,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import { DayStepper } from "@/components/day-stepper";
import { SummarySentence } from "@/components/summary-sentence";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createRoute, getRoutesBoard, listUnassigned } from "@/features/routes/api";
import { routesDaySentence } from "@/features/routes/route-sentences";
import { RouteSummaryCard } from "@/features/routes/route-summary-card";
import { UnassignedList } from "@/features/routes/unassigned-list";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatCop, formatDate, formatLongDate } from "@/lib/format";

export const Route = createFileRoute("/_panel/rutas")({
  validateSearch: z.object({ date: z.iso.date().optional() }),
  head: () => ({ meta: [{ title: "Rutas · Domy" }] }),
  component: RoutesBoardPage,
});

/** A titled group of route cards; `empty` shows when the group has none. */
function RoutesSection({
  title,
  hint,
  routes,
  now,
  empty,
}: {
  title: string;
  hint?: string;
  routes: RouteSummary[];
  now: Date;
  empty?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="flex items-baseline gap-2 text-title-l text-on-surface">
          {title}
          <span className="text-body-l text-on-surface-variant tabular-nums">{routes.length}</span>
        </h2>
        {hint && <p className="text-body-m text-on-surface-variant">{hint}</p>}
      </div>
      {routes.length === 0 ? (
        empty
      ) : (
        <ul
          aria-labelledby={headingId}
          className="grid grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-3.5"
        >
          {routes.map((route) => (
            <li key={route.id}>
              <RouteSummaryCard route={route} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The routes of a date and the shipments still without a route (feature 002), as the owner
 * approved «Rutas» (feature 006): a sentence of the day, the route cards, and «Sin asignar»
 * beside «Nueva ruta», which on a phone stays at the bottom while the list scrolls.
 */
function RoutesBoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = bogotaToday(now());
  const date = search.date ?? today;
  // Changes by any user appear within 30 seconds (FR-018, SC-003).
  const board = useQuery({
    queryKey: ["routes-board", date],
    queryFn: () => getRoutesBoard(date),
    refetchInterval: 20_000,
  });
  const unassigned = useQuery({
    queryKey: ["unassigned", date],
    queryFn: () => listUnassigned(date),
    refetchInterval: 20_000,
  });
  const [picked, setPicked] = useState<string[]>([]);
  // Only what is still "Sin asignar": a shipment another dispatcher took leaves the selection
  // and the rest stays (FR-021).
  const selected = unassigned.data
    ? picked.filter((id) => unassigned.data.some((shipment) => shipment.id === id))
    : picked;
  // Kept across retries of the same creation so it happens once (FR-020).
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(confirmed: boolean) {
    setProblem(null);
    setBusy(true);
    try {
      const route = await createRoute({
        id: draftId,
        actionId: draftId,
        serviceDate: date,
        shipmentIds: selected,
        confirmed,
      });
      setPicked([]);
      setDraftId(crypto.randomUUID());
      // The new route opens at once; the lists reload behind it.
      void queryClient.invalidateQueries({ queryKey: ["unassigned"] });
      void queryClient.invalidateQueries({ queryKey: ["routes-board"] });
      await navigate({ to: "/rutas/$routeId", params: { routeId: route.id } });
    } catch (error) {
      // The selection stays, so the dispatcher can adjust it and try again (FR-021).
      setProblem(error instanceof ApiError ? error.message : "No pudimos crear la ruta.");
      setDraftId(crypto.randomUUID());
      await unassigned.refetch();
    } finally {
      setBusy(false);
    }
  }

  const count = selected.length;
  const chosen = (unassigned.data ?? []).filter((shipment) => selected.includes(shipment.id));
  const pickups = new Set(
    chosen.map(
      (shipment) =>
        `${shipment.merchant.id}|${shipment.pickupAddress}|${shipment.pickupNeighborhood.id}`,
    ),
  ).size;
  const toCollect = chosen.reduce((sum, shipment) => sum + shipment.codAmount, 0);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-1.5">
          <h1 className="text-headline-l text-on-surface">Rutas</h1>
          {board.data && (
            <SummarySentence
              parts={routesDaySentence({
                date,
                today,
                routes: board.data.routes,
                unassigned: unassigned.data,
                now: now(),
              })}
            />
          )}
        </div>
        <DayStepper
          date={date}
          today={today}
          min={today}
          surface="sheet"
          label="Fecha de las rutas"
          onChange={(next) => {
            void navigate({
              to: "/rutas",
              search: next === today ? {} : { date: next },
              replace: true,
            });
          }}
        />
      </header>

      {board.isPending ? (
        <div className="grid gap-3 md:grid-cols-2" aria-label="Cargando las rutas">
          <Skeleton className="h-44 w-full rounded-md" />
          <Skeleton className="h-44 w-full rounded-md" />
        </div>
      ) : board.isError ? (
        <p
          role="alert"
          className="rounded-sm bg-error-container p-4 text-body-l text-on-error-container"
        >
          {board.error.message}
        </p>
      ) : (
        <>
          <RoutesSection
            title="Rutas del día"
            routes={board.data.routes}
            now={now()}
            empty={
              <EmptyState
                icon={RouteIcon}
                title="No hay rutas para este día"
                description="Elige envíos en «Sin asignar» y crea la primera ruta."
              />
            }
          />
          {board.data.routesFromPreviousDays.length > 0 && (
            <RoutesSection
              title="Rutas de días anteriores"
              hint="Siguen en curso hasta que se resuelvan todos sus envíos."
              routes={board.data.routesFromPreviousDays}
              now={now()}
            />
          )}
        </>
      )}

      {/* Route building beside the list (design-system.md §5); on a phone «Nueva ruta» stays
          at the bottom of the screen while the list scrolls. */}
      <div className="flex flex-wrap items-start gap-5 max-[820px]:flex-col max-[820px]:items-stretch">
        <section
          aria-labelledby="unassigned-title"
          className="flex min-w-0 flex-[999_1_36rem] flex-col gap-3 rounded-lg border border-outline-variant bg-sheet px-5 py-4.5 max-[820px]:px-4"
        >
          <div>
            <h2
              id="unassigned-title"
              className="flex items-baseline gap-2 text-title-l text-on-surface"
            >
              Sin asignar
              {unassigned.data && (
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {unassigned.data.length}
                </span>
              )}
            </h2>
            <p className="text-body-m text-on-surface-variant">
              Registrados hasta el {formatDate(date)} y en ninguna ruta, agrupados por dónde se
              recogen.
            </p>
          </div>
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
                setPicked((current) =>
                  checked
                    ? [...current, ...ids.filter((id) => !current.includes(id))]
                    : current.filter((id) => !ids.includes(id)),
                );
              }}
            />
          )}
        </section>

        <section
          aria-labelledby="new-route-title"
          className="sticky top-4 z-10 flex max-w-95 min-w-0 flex-[1_1_18.75rem] flex-col gap-3 rounded-lg border border-outline-variant bg-sheet px-5 py-4 max-[820px]:top-auto max-[820px]:bottom-0 max-[820px]:-mx-4 max-[820px]:max-w-none max-[820px]:gap-2 max-[820px]:rounded-b-none max-[820px]:px-4 max-[820px]:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-[820px]:shadow-[0_-10px_24px_-18px] max-[820px]:shadow-scrim/45"
        >
          <h2 id="new-route-title" className="text-title-l text-on-surface max-[820px]:sr-only">
            Nueva ruta
          </h2>
          <p className="text-body-m text-on-surface-variant" aria-live="polite">
            {count === 0
              ? "Elige en «Sin asignar» los envíos de la ruta."
              : `${count === 1 ? "1 envío elegido" : `${String(count)} envíos elegidos`} para el ${formatLongDate(date, today).toLowerCase()}.`}
          </p>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t border-outline-variant pt-3 text-body-m max-[820px]:hidden">
            <dt className="text-on-surface-variant">Envíos</dt>
            <dd className="text-right font-semibold tabular-nums">{count}</dd>
            <dt className="text-on-surface-variant">Recogidas</dt>
            <dd className="text-right font-semibold tabular-nums">{pickups}</dd>
            <dt className="text-body-l font-bold text-on-surface">Por recaudar</dt>
            <dd className="text-right text-body-l font-bold tabular-nums">
              {formatCop(toCollect)}
            </dd>
          </dl>
          {problem && (
            <p
              role="alert"
              className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
            >
              {problem}
            </p>
          )}
          <Button
            variant="accent"
            className="w-full"
            disabled={busy || count === 0}
            onClick={() => {
              if (needsLargeRouteConfirmation(count)) setConfirming(true);
              else void create(false);
            }}
          >
            {count === 0
              ? "Crear ruta"
              : count === 1
                ? "Crear ruta con 1 envío"
                : `Crear ruta con ${String(count)} envíos`}
          </Button>
          <p className="text-center text-body-s text-on-surface-variant max-[820px]:hidden">
            El mensajero y el orden se eligen en la ruta. Con más de {largeRouteThreshold} envíos te
            pediremos confirmarla.
          </p>
        </section>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Crear una ruta con {count} envíos?</AlertDialogTitle>
            <AlertDialogDescription>
              Es una ruta grande: más de {largeRouteThreshold} envíos para un solo mensajero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <Button
              onClick={() => {
                setConfirming(false);
                void create(true);
              }}
            >
              Crear ruta
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
