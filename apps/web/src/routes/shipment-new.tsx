import { createFileRoute } from "@tanstack/react-router";
import { ShipmentForm } from "@/features/shipments/shipment-form";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_panel/envios/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo envío · Domy" }] }),
  component: ShipmentNewPage,
});

function ShipmentNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nuevo envío" />
      <ShipmentForm />
    </div>
  );
}
