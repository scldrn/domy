import { createFileRoute } from "@tanstack/react-router";
import { ShipmentForm } from "@/features/shipments/shipment-form";

export const Route = createFileRoute("/_panel/envios/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo envío · Domy" }] }),
  component: ShipmentNewPage,
});

function ShipmentNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-s text-on-surface">Nuevo envío</h1>
      <ShipmentForm />
    </div>
  );
}
