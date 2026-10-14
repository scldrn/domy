import { createFileRoute } from "@tanstack/react-router";

/** "Mi día": the courier's summary of the day (feature 003, US7, FR-037). */
export const Route = createFileRoute("/_courier/mensajero/mi-dia")({
  head: () => ({ meta: [{ title: "Mi día · Domy" }] }),
  component: CourierDay,
});

function CourierDay() {
  return <h1 className="text-headline-s text-on-surface">Mi día</h1>;
}
