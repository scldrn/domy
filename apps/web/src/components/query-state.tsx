import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import SearchOffIcon from "@material-symbols/svg-400/rounded/search_off.svg?react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { Icon } from "./icon";

export function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Cargando registros…",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-2 py-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-outline-variant py-3">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function QueryErrorAlert({
  title = "No pudimos cargar la información",
  message = "Revisa tu conexión e inténtalo de nuevo. Si el problema continúa, avísale al administrador.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-error/30 bg-error/5 p-6 text-on-surface"
    >
      <div className="flex items-center gap-2 text-title-s text-error">
        <Icon symbol={ErrorIcon} />
        <p className="font-semibold">{title}</p>
      </div>
      <p className="text-body-m text-on-surface-variant">{message}</p>
      <Button variant="outline" onClick={onRetry} className="mt-1">
        Reintentar
      </Button>
    </div>
  );
}

export function DirectoryEmptyState({
  title = "Todavía no hay registros",
  description = "No se encontraron elementos disponibles.",
  icon = SearchOffIcon,
}: {
  title?: string;
  description?: string;
  icon?: typeof SearchOffIcon;
}) {
  return <EmptyState icon={icon} title={title} description={description} />;
}
