import { useState } from "react";

/** Installation guidance never interrupts a route (FR-001, research R2; US2 T047). */
export function InstallHint() {
  const [installed] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true),
  );
  if (installed) return null;
  return (
    <details className="rounded-md border border-outline-variant bg-surface-container-low text-body-l text-on-surface">
      <summary className="min-h-12 cursor-pointer px-4 py-3 font-medium">
        Instala Domy en tu teléfono
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <p>
          Abre el menú del navegador y elige «Instalar aplicación» o «Agregar a pantalla de inicio».
        </p>
        <p>En iPhone, abre Compartir y elige «Agregar a pantalla de inicio».</p>
        <p>
          Instalarla ayuda a conservar tus registros. No borres los datos del navegador mientras
          tengas pendientes.
        </p>
      </div>
    </details>
  );
}
