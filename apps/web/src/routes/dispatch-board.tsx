import { createFileRoute } from "@tanstack/react-router";

// Built in User Story 2 (tasks T065–T070).
export const Route = createFileRoute("/_panel/")({
  component: DispatchBoardPage,
});

function DispatchBoardPage() {
  return <h1 className="text-headline-s text-on-surface">Tablero de despacho</h1>;
}
