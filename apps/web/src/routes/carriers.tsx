import { createFileRoute } from "@tanstack/react-router";
import { listAllCarriers, updateCarrier } from "@/features/master-data/api";
import { CarrierDialog } from "@/features/master-data/carriers/carrier-dialog";
import { DirectoryPage } from "@/features/master-data/directory-page";

export const Route = createFileRoute("/_panel/transportadoras")({
  head: () => ({ meta: [{ title: "Transportadoras · Domy" }] }),
  component: () => (
    <DirectoryPage
      title="Transportadoras"
      dataset="carriers"
      queryKey="carriers"
      list={listAllCarriers}
      columns={[{ header: "Transportadora", cell: (carrier) => carrier.name }]}
      create={<CarrierDialog />}
      edit={(carrier) => <CarrierDialog carrier={carrier} />}
      setActive={(carrier, isActive) =>
        updateCarrier(carrier.id, { actionId: crypto.randomUUID(), isActive })
      }
    />
  ),
});
