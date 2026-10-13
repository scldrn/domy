import TwoWheelerIcon from "@material-symbols/svg-400/rounded/two_wheeler.svg?react";
import { normalizeText, type Courier } from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/empty-state";
import { SearchCombobox } from "@/components/search-combobox";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { listActiveCouriers } from "./api";

/** Active couriers by name or alias (FR-008), or how to add one when there are none (FR-027). */
export function CourierSelect({
  value,
  onChange,
  disabled,
  id = "route-courier",
  label = "Mensajero",
  invalid,
}: {
  value: { id: string; name: string } | null;
  onChange: (courier: Courier) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  invalid?: boolean;
}) {
  const couriers = useQuery({ queryKey: ["couriers", "active"], queryFn: listActiveCouriers });
  if (couriers.data?.length === 0) {
    return (
      <EmptyState
        className="px-4 py-6"
        icon={TwoWheelerIcon}
        title="No hay mensajeros activos"
        description="Agrega un mensajero o reactiva uno para asignarle la ruta."
        action={
          <Link to="/mensajeros" className={buttonVariants({ variant: "outline" })}>
            Ir a Mensajeros
          </Link>
        }
      />
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
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {disabled ? (
        <p className="text-body-l text-on-surface">{value?.name ?? "Sin mensajero"}</p>
      ) : (
        <SearchCombobox<Courier>
          key={value?.id ?? "none"}
          id={id}
          label={label}
          {...(invalid !== undefined && { invalid })}
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
