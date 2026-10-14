import { createFileRoute } from "@tanstack/react-router";

/** The records still to synchronize, oldest first (feature 003, US2, FR-020). */
export const Route = createFileRoute("/_courier/mensajero/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes · Domy" }] }),
  component: CourierPending,
});

function CourierPending() {
  return <h1 className="text-headline-s text-on-surface">Pendientes por sincronizar</h1>;
}
