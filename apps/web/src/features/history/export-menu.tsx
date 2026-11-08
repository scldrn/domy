import ArrowDownIcon from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?react";
import DownloadIcon from "@material-symbols/svg-400/rounded/download.svg?react";
import { Menu } from "@base-ui/react/menu";
import { Icon } from "@/components/icon";
import { buttonVariants } from "@/components/ui/button";
import { exportUrl, type HistoryFilters } from "./api";

/**
 * «Exportar» (approved «Historial»): the five exports in one menu instead of five buttons;
 * the shipments follow the search on screen (FR-025), the others are whole tables. Owner only,
 * as before.
 */
export function ExportMenu({ filters }: { filters: HistoryFilters }) {
  const files = [
    { label: "Envíos en Excel", href: exportUrl(filters, "xlsx") },
    { label: "Envíos en CSV", href: exportUrl(filters, "csv") },
    { label: "Registros de mensajero (CSV)", href: "/api/export/courier-records?format=csv" },
    { label: "Rutas (CSV)", href: "/api/export/routes?format=csv" },
    { label: "Traspasos (CSV)", href: "/api/export/handovers?format=csv" },
  ];
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={buttonVariants({ variant: "outline", className: "group pr-4" })}>
        Exportar
        <Icon
          symbol={ArrowDownIcon}
          className="transition-transform duration-(--duration-short) group-data-popup-open:rotate-180"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="isolate z-50">
          <Menu.Popup className="min-w-68 origin-(--transform-origin) rounded-md border border-outline-variant bg-sheet p-1.5 text-on-surface shadow-lg outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            {files.map((file) => (
              <Menu.LinkItem
                key={file.label}
                href={file.href}
                download
                closeOnClick
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-label-l outline-none data-highlighted:bg-sheet-alt"
              >
                <Icon symbol={DownloadIcon} size={20} className="text-on-surface-variant" />
                {file.label}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
