import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditEvents } from "@/features/master-data/api";
import {
  actionLabels,
  entityLabels,
  formatAuditField,
  formatAuditValue,
} from "@/features/master-data/audit-formatting";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_panel/auditoria")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "owner") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Auditoría · Domy" }] }),
  component: AuditLogPage,
});

/** Who changed which master data, when, and from what to what (FR-036); owner only. */
function AuditLogPage() {
  const events = useInfiniteQuery({
    queryKey: ["master", "audit-events"],
    queryFn: ({ pageParam }) => listAuditEvents(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoría de datos maestros"
        description="Quién creó o cambió clientes, mensajeros, barrios, tarifas y cuentas, y cuándo."
      />
      {events.isPending ? (
        <TableSkeleton columns={5} rows={6} label="Cargando historial de auditoría…" />
      ) : events.isError ? (
        <QueryErrorAlert
          title="No pudimos cargar el historial de auditoría"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void events.refetch()}
        />
      ) : items.length === 0 ? (
        <DirectoryEmptyState
          title="Todavía no hay registros de auditoría"
          description="Los cambios en datos maestros aparecerán aquí automáticamente."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Cambios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((event) => (
                <TableRow key={event.id} className="align-top">
                  <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                  <TableCell>{event.actor.name}</TableCell>
                  <TableCell>{entityLabels[event.entityType] ?? event.entityType}</TableCell>
                  <TableCell>{actionLabels[event.action]}</TableCell>
                  <TableCell className="whitespace-normal">
                    <ul className="text-body-m">
                      {Object.entries(event.changes ?? {}).map(([field, [before, after]]) => (
                        <li key={field}>
                          {formatAuditField(field)}:{" "}
                          {event.action === "created"
                            ? formatAuditValue(field, after)
                            : `${formatAuditValue(field, before)} → ${formatAuditValue(field, after)}`}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {events.hasNextPage && (
            <Button
              variant="outline"
              className="self-start"
              disabled={events.isFetchingNextPage}
              onClick={() => void events.fetchNextPage()}
            >
              Ver más cambios
            </Button>
          )}
        </>
      )}
    </div>
  );
}
