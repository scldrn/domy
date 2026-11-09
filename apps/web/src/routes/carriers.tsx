import { createFileRoute } from "@tanstack/react-router";
import type { Carrier } from "@domy/domain";
import { listAllCarriers, updateCarrier } from "@/features/master-data/api";
import { CarrierDialog } from "@/features/master-data/carriers/carrier-dialog";
import { DirectoryPage } from "@/features/master-data/directory-page";

export const Route = createFileRoute("/_panel/transportadoras")({
  head: () => ({ meta: [{ title: "Transportadoras · Domy" }] }),
  component: () => (
    <DirectoryPage<Carrier>
      title="Transportadoras"
      dataset="carriers"
      queryKey="carriers"
      list={listAllCarriers}
      feminine
      sentence={(carriers) => {
        const active = carriers.filter((carrier) => carrier.isActive).length;
        if (active === 0) return [{ text: "Todavía no hay transportadoras activas." }];
        return [
          {
            text: `${String(active)} ${active === 1 ? "transportadora" : "transportadoras"}`,
            strong: true,
          },
          {
            text:
              active === 1
                ? " recibe los envíos que salen del Valle de Aburrá."
                : " reciben los envíos que salen del Valle de Aburrá.",
          },
        ];
      }}
      template="minmax(14rem,1fr)"
      columns={[
        {
          key: "name",
          header: "Transportadora",
          card: { order: 1, place: "start" },
          cell: (carrier) => <span className="font-semibold text-on-surface">{carrier.name}</span>,
        },
      ]}
      create={<CarrierDialog />}
      edit={(carrier) => <CarrierDialog carrier={carrier} />}
      setActive={async (carrier, isActive) => {
        await updateCarrier(carrier.id, { actionId: crypto.randomUUID(), isActive });
        return undefined;
      }}
    />
  ),
});
