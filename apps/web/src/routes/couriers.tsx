import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { listCouriers, updateCourier } from "@/features/master-data/api";
import { CourierDialog } from "@/features/master-data/couriers/courier-dialog";
import { DirectoryPage } from "@/features/master-data/directory-page";

export const Route = createFileRoute("/_panel/mensajeros")({
  head: () => ({ meta: [{ title: "Mensajeros · Domy" }] }),
  component: () => (
    <DirectoryPage
      title="Mensajeros"
      dataset="couriers"
      queryKey="couriers"
      list={(q) => listCouriers(q)}
      columns={[
        { header: "Mensajero", cell: (courier) => courier.name },
        { header: "Alias", cell: (courier) => courier.aliases.join(", ") },
        { header: "Teléfono", cell: (courier) => courier.phone },
      ]}
      create={<CourierDialog />}
      edit={(courier) => <CourierDialog courier={courier} />}
      setActive={async (courier, isActive) => {
        const { openRoutes } = await updateCourier(courier.id, {
          actionId: crypto.randomUUID(),
          isActive,
        });
        // Their routes stay with them until the dispatcher reassigns them (feature 002, FR-010).
        if (!isActive && openRoutes > 0) {
          toast.warning(
            openRoutes === 1
              ? `${courier.name} tiene 1 ruta abierta; sigue a su nombre hasta que la reasignes.`
              : `${courier.name} tiene ${String(openRoutes)} rutas abiertas; siguen a su nombre hasta que las reasignes.`,
          );
        }
      }}
    />
  ),
});
