import { createContext, useContext } from "react";

/** The fields changed while editing; their labels carry "Cambiado" (approved "Editar envío"). */
export const ChangedFields = createContext<ReadonlySet<string>>(new Set());

export function ChangedMark({ name }: { name: string }) {
  const changed = useContext(ChangedFields);
  if (!changed.has(name)) return null;
  return (
    <span className="ml-auto rounded-xs bg-tertiary-container px-1.5 text-label-s text-on-tertiary-container">
      Cambiado
    </span>
  );
}
