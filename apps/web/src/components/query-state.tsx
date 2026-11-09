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

/**
 * A list that failed to load: the empty state's pattern with the error tone, what happened,
 * and «Reintentar» (design-system.md §8, "Error and not-found screens"; feature 006, T018).
 */
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
      className="flex flex-col items-center gap-2 rounded-lg border border-outline-variant bg-sheet px-6 py-11 text-center"
    >
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <Icon symbol={ErrorIcon} className="size-7" />
      </span>
      <p className="text-title-l font-semibold text-on-surface">{title}</p>
      <p className="max-w-[46ch] text-body-m text-on-surface-variant">{message}</p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
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
