import EditIcon from "@material-symbols/svg-400/rounded/edit.svg?react";
import AddIcon from "@material-symbols/svg-400/rounded/add.svg?react";
import BlockIcon from "@material-symbols/svg-400/rounded/block.svg?react";
import RestoreIcon from "@material-symbols/svg-400/rounded/settings_backup_restore.svg?react";
import AutorenewIcon from "@material-symbols/svg-400/rounded/autorenew.svg?react";
import { bogotaToday, type AuditEvent } from "@domy/domain";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Icon, type Symbol } from "@/components/icon";
import { DirectoryEmptyState, QueryErrorAlert, TableSkeleton } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { listAuditEvents } from "@/features/master-data/api";
import { describeAuditEvent } from "@/features/master-data/audit-formatting";
import { MasterHeader } from "@/features/master-data/master-page";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatLongDate, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_panel/auditoria")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "owner") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Auditoría · Domy" }] }),
  component: AuditLogPage,
});

const marks: Record<AuditEvent["action"], { icon: Symbol; tone: string }> = {
  created: { icon: AddIcon, tone: "bg-tertiary-container text-on-tertiary-container" },
  updated: { icon: EditIcon, tone: "bg-secondary-container text-on-secondary-container" },
  deactivated: { icon: BlockIcon, tone: "bg-warning-container text-on-warning-container" },
  reactivated: { icon: RestoreIcon, tone: "bg-success-container text-on-success-container" },
  link_replaced: {
    icon: AutorenewIcon,
    tone: "bg-secondary-container text-on-secondary-container",
  },
};

/** The events of a page grouped by their day in Bogotá, newest first as they arrive. */
function byDay(events: AuditEvent[]): { day: string; events: AuditEvent[] }[] {
  const days: { day: string; events: AuditEvent[] }[] = [];
  for (const event of events) {
    const day = bogotaToday(new Date(event.occurredAt));
    const last = days.at(-1);
    if (last?.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}

/**
 * Who changed which master data, when, and from what to what (FR-036); owner only. As approved
 * in feature 006 (US5): one sentence per change with the names the server resolved, grouped by
 * day, and «Ver más cambios». The proposal's filters by area and author wait for the server to
 * filter the log; until then the page shows every change.
 */
function AuditLogPage() {
  const events = useInfiniteQuery({
    queryKey: ["master", "audit-events"],
    queryFn: ({ pageParam }) => listAuditEvents(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];
  const today = bogotaToday(now());

  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Auditoría"
        sentence={[
          {
            text: "Quién creó o cambió clientes, mensajeros, barrios, tarifas, cuentas y la configuración, y cuándo.",
          },
        ]}
      />
      {events.isPending ? (
        <TableSkeleton columns={3} rows={6} label="Cargando historial de auditoría…" />
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
        <section
          aria-label="Cambios"
          className="flex flex-col rounded-lg border border-outline-variant bg-sheet px-5.5 py-5 max-[820px]:px-4"
        >
          {byDay(items).map(({ day, events: dayEvents }, dayIndex) => (
            <div key={day} className={cn(dayIndex > 0 && "mt-4")}>
              <h2 className="mb-1 text-label-m font-bold tracking-wide text-on-surface-variant uppercase">
                {day === today ? `Hoy, ${formatLongDate(day, today)}` : formatLongDate(day, today)}
              </h2>
              <ol className="flex flex-col">
                {dayEvents.map((event, index) => {
                  const line = describeAuditEvent(event);
                  const mark = marks[event.action];
                  return (
                    <li
                      key={event.id}
                      className={cn(
                        "grid grid-cols-[4.5rem_2rem_minmax(0,1fr)] items-start gap-3 py-2.5 max-[820px]:grid-cols-[2rem_minmax(0,1fr)]",
                        index > 0 && "border-t border-outline-variant",
                      )}
                    >
                      <span className="pt-1 text-body-m whitespace-nowrap text-on-surface-variant max-[820px]:col-start-2 max-[820px]:row-start-1 max-[820px]:pt-0">
                        {formatTime(event.occurredAt)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-8 place-items-center rounded-sm max-[820px]:row-span-2 max-[820px]:row-start-1",
                          mark.tone,
                        )}
                      >
                        <Icon symbol={mark.icon} size={20} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-body-l text-on-surface">
                          <strong className="font-semibold">{line.who}</strong> {line.verb}{" "}
                          <strong className="font-semibold">{line.what}</strong>
                        </p>
                        {line.changes.length > 0 && (
                          <ul className="mt-1 text-body-m wrap-anywhere text-on-surface-variant">
                            {line.changes.map((change) => (
                              <li key={change}>{change}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {events.hasNextPage && (
            <Button
              variant="outline"
              className="mt-4 self-start"
              disabled={events.isFetchingNextPage}
              onClick={() => void events.fetchNextPage()}
            >
              {events.isFetchingNextPage ? "Cargando…" : "Ver más cambios"}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
