import { bogotaToday } from "@domy/domain";
import { createFileRoute } from "@tanstack/react-router";
import { ShipmentForm } from "@/features/shipments/shipment-form";
import { PageHeader } from "@/components/page-header";
import { now } from "@/lib/clock";
import { formatLongDate } from "@/lib/format";

export const Route = createFileRoute("/_panel/envios/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo envío · Domy" }] }),
  component: ShipmentNewPage,
});

/** "Nuevo envío" as the owner approved it (feature 006, FR-007): what to know, then the form. */
function ShipmentNewPage() {
  const today = bogotaToday(now());
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Nuevo envío"
        sentence={
          <p className="max-w-[72ch] text-pretty">
            Para{" "}
            <strong className="font-semibold text-on-surface">
              hoy, {formatLongDate(today, today).toLowerCase()}
            </strong>
            . La tarifa sale del barrio y del cliente; si la zona no tiene tarifa, la escribes y el
            envío queda «Tarifa por revisar».
          </p>
        }
      />
      <ShipmentForm />
    </div>
  );
}
