import { createFileRoute } from "@tanstack/react-router";

/** A stop of the courier's route and its tasks (feature 003, US1; tasks.md T039). */
export const Route = createFileRoute("/_courier/mensajero/parada/$stopId")({
  head: () => ({ meta: [{ title: "Parada · Domy" }] }),
  component: CourierStop,
});

function CourierStop() {
  return <h1 className="text-headline-s text-on-surface">Parada</h1>;
}
