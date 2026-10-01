import { normalizeText, type Courier } from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SearchCombobox } from "@/components/search-combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { listActiveCouriers } from "./api";

/** Active couriers by name or alias (FR-008), or how to add one when there are none (FR-027). */
export function CourierSelect({
  value,
  onChange,
  disabled,
}: {
  value: { id: string; name: string } | null;
  onChange: (courier: Courier) => void;
  disabled?: boolean;
}) {
  const couriers = useQuery({ queryKey: ["couriers", "active"], queryFn: listActiveCouriers });
  if (couriers.data?.length === 0) {
    return (
      <p className="text-body-m text-on-surface-variant">
        No hay mensajeros activos.{" "}
        <Link to="/mensajeros" className="text-primary underline">
          Agrega uno
        </Link>
      </p>
    );
  }
  const search = async (query: string) => {
    const term = normalizeText(query);
    const list = couriers.data ?? (await listActiveCouriers());
    return list.filter(
      (courier) =>
        !term ||
        [courier.name, ...courier.aliases].some((name) => normalizeText(name).includes(term)),
    );
  };
  const current = couriers.data?.find((courier) => courier.id === value?.id) ?? null;
  return (
    <Field className="w-72">
      <FieldLabel htmlFor="route-courier">Mensajero</FieldLabel>
      {disabled ? (
        <p className="text-body-l text-on-surface">{value?.name ?? "Sin mensajero"}</p>
      ) : (
        <SearchCombobox<Courier>
          key={value?.id ?? "none"}
          id="route-courier"
          label="Mensajero"
          queryKey={["couriers", "search"]}
          search={search}
          value={current}
          onChange={(courier) => {
            if (courier) onChange(courier);
          }}
          itemKey={(courier) => courier.id}
          itemLabel={(courier) => courier.name}
          renderItem={(courier) => (
            <span className="flex flex-col">
              <span>{courier.name}</span>
              {courier.aliases.length > 0 && (
                <span className="text-body-s text-on-surface-variant">
                  {courier.aliases.join(", ")}
                </span>
              )}
            </span>
          )}
          placeholder="Nombre o alias del mensajero"
          emptyText="No hay mensajeros con ese nombre"
        />
      )}
    </Field>
  );
}
