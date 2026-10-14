import { createFileRoute } from "@tanstack/react-router";

/** "Mi ruta": the courier's route in progress (feature 003, US1; tasks.md T039). */
export const Route = createFileRoute("/_courier/mensajero")({
  head: () => ({ meta: [{ title: "Mi ruta · Domy" }] }),
  component: CourierRoute,
});

function CourierRoute() {
  return <h1 className="text-headline-s text-on-surface">Mi ruta</h1>;
}
