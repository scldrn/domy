import { createFileRoute } from "@tanstack/react-router";
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
      setActive={(courier, isActive) =>
        updateCourier(courier.id, { actionId: crypto.randomUUID(), isActive })
      }
    />
  ),
});
