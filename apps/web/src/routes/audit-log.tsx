import type { AuditEvent } from "@domy/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_panel/auditoria")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "owner") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Auditoría · Domy" }] }),
  component: AuditLogPage,
});

const entityLabels: Record<string, string> = {
  user: "Usuario",
  merchant: "Cliente",
  pickup_point: "Punto de recogida",
  courier: "Mensajero",
  carrier: "Transportadora",
  neighborhood: "Barrio",
  rate_zone: "Zona tarifaria",
  rate_card_entry: "Tarifa",
};
const actionLabels: Record<AuditEvent["action"], string> = {
  created: "Creado",
  updated: "Editado",
  deactivated: "Desactivado",
  reactivated: "Reactivado",
};

function value(item: unknown): string {
  if (item === null || item === undefined || item === "") return "—";
  if (Array.isArray(item)) return item.map(value).join(", ") || "—";
  if (typeof item === "boolean") return item ? "Sí" : "No";
  return typeof item === "string" || typeof item === "number" ? String(item) : JSON.stringify(item);
}

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
                      {field}:{" "}
                      {event.action === "created"
                        ? value(after)
                        : `${value(before)} → ${value(after)}`}
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
    </div>
  );
}
