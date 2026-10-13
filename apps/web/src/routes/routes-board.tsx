import { bogotaToday, largeRouteThreshold, needsLargeRouteConfirmation } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createRoute, listUnassigned } from "@/features/routes/api";
import { UnassignedList } from "@/features/routes/unassigned-list";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatDate, formatLongDate } from "@/lib/format";

export const Route = createFileRoute("/_panel/rutas")({
  validateSearch: z.object({ date: z.iso.date().optional() }),
  head: () => ({ meta: [{ title: "Rutas · Domy" }] }),
  component: RoutesBoardPage,
});

/** The routes of a date and the shipments still without a route (feature 002). */
function RoutesBoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = bogotaToday(now());
  const date = search.date ?? today;
  const unassigned = useQuery({
    queryKey: ["unassigned", date],
    queryFn: () => listUnassigned(date),
    refetchInterval: 20_000,
  });
  const [selected, setSelected] = useState<string[]>([]);
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
      setSelected([]);
      setDraftId(crypto.randomUUID());
      await queryClient.invalidateQueries({ queryKey: ["unassigned"] });
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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rutas"
        description={formatLongDate(date, today)}
        actions={
          <Field className="w-44">
            <FieldLabel htmlFor="routes-date">Fecha</FieldLabel>
            <Input
              id="routes-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => {
                if (event.target.value) {
                  void navigate({
                    to: "/rutas",
                    search: { date: event.target.value },
                    replace: true,
                  });
                }
              }}
            />
          </Field>
        }
      />

      {/* Route building in the supporting pane layout (design-system.md §5); when the panes
          stack, the new route stays in view at the bottom. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="unassigned-title" className="flex min-w-0 flex-col gap-4">
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
              Envíos registrados hasta el {formatDate(date)} que no están en ninguna ruta.
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
                setSelected((current) =>
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
          className="sticky bottom-4 z-10 flex flex-col gap-4 rounded-md border border-outline-variant bg-sheet p-6 shadow-md xl:top-6 xl:bottom-auto xl:shadow-none"
        >
          <h2 id="new-route-title" className="text-title-l text-on-surface">
            Nueva ruta
          </h2>
          <p className="text-body-l text-on-surface-variant" aria-live="polite">
            {count === 0
              ? "Elige en la lista los envíos de la ruta."
              : `${count === 1 ? "1 envío elegido" : `${String(count)} envíos elegidos`} para el ${formatDate(date)}.`}
          </p>
          {problem && (
            <p
              role="alert"
              className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
            >
              {problem}
            </p>
          )}
          <Button
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
