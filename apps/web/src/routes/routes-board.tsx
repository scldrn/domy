import { bogotaToday } from "@domy/domain";
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
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createRoute, listUnassigned } from "@/features/routes/api";
import { UnassignedList } from "@/features/routes/unassigned-list";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";

export const Route = createFileRoute("/_panel/rutas")({
  validateSearch: z.object({ date: z.iso.date().optional() }),
  head: () => ({ meta: [{ title: "Rutas · Domy" }] }),
  component: RoutesBoardPage,
});

/** Routes beyond this many shipments need an explicit confirmation (FR-005). */
const largeRoute = 15;

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

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-headline-s text-on-surface">Rutas</h1>
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
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="unassigned-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="unassigned-title" className="text-title-l text-on-surface">
            Sin asignar
            {unassigned.data && (
              <span className="ml-2 text-body-l text-on-surface-variant">
                ({unassigned.data.length})
              </span>
            )}
          </h2>
          <Button
            disabled={busy || selected.length === 0}
            onClick={() => {
              if (selected.length > largeRoute) setConfirming(true);
              else void create(false);
            }}
          >
            {selected.length === 1
              ? "Crear ruta con 1 envío"
              : `Crear ruta con ${String(selected.length)} envíos`}
          </Button>
        </div>
        {problem && (
          <p
            role="alert"
            className="rounded-sm bg-error-container p-3 text-body-m text-on-error-container"
          >
            {problem}
          </p>
        )}
        {unassigned.data && (
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

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Crear una ruta con {selected.length} envíos?</AlertDialogTitle>
            <AlertDialogDescription>
              Es una ruta grande: más de {largeRoute} envíos para un solo mensajero.
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
