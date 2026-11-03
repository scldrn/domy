import {
  flagLabel,
  formatDuration,
  formatTrackingNumber,
  shipmentFlag,
  shipmentKindLabels,
  type AttentionItem,
  type BoardEntry,
  type MinorFlag,
} from "@domy/domain";
import ReportIcon from "@material-symbols/svg-400/rounded/report.svg?react";
import ScheduleIcon from "@material-symbols/svg-400/rounded/schedule.svg?react";
import SwapIcon from "@material-symbols/svg-400/rounded/swap_horiz.svg?react";
import WarningIcon from "@material-symbols/svg-400/rounded/warning.svg?react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon, type Symbol } from "@/components/icon";
import { TrackingNumber } from "@/components/tracking-number";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatWindow } from "@/lib/format";

/** What a row of "Por resolver" asks for; the board decides what each one opens. */
export type AttentionIntent = "open" | "decide" | "reassign" | "confirm_handover";

const tones = {
  error: { tile: "bg-error-container text-on-error-container", tag: "text-error" },
  warning: { tile: "bg-warning-container text-on-warning-container", tag: "text-warning" },
  tertiary: { tile: "bg-tertiary-container text-on-tertiary-container", tag: "text-tertiary" },
} as const;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** "Además: 1 recaudo diferente, 2 por revisar…" (design-system.md §8). */
function minorSummary(minor: Record<MinorFlag, number>): string | null {
  const parts: string[] = [];
  const add = (count: number, one: string, many: string) => {
    if (count > 0) parts.push(`${String(count)} ${plural(count, one, many)}`);
  };
  add(minor.collection_differs, "recaudo diferente", "recaudos diferentes");
  add(minor.needs_review, "por revisar", "por revisar");
  add(minor.no_photo, "sin foto", "sin foto");
  add(minor.fee_to_review, "tarifa por revisar", "tarifas por revisar");
  return parts.length > 0 ? `Además: ${parts.join(", ")}` : null;
}

function describe(item: AttentionItem, shipment: BoardEntry, now: Date) {
  const who = shipment.recipientName ?? shipmentKindLabels[shipment.kind];
  const place = shipment.recipientNeighborhood?.name ?? "Sin barrio";
  const window = formatWindow(shipment.windowStart, shipment.windowEnd) ?? "Sin franja";
  const windowEnd = shipment.windowEnd ? new Date(shipment.windowEnd) : null;
  const flag = shipmentFlag({ status: shipment.status, windowEnd }, now);
  const courier = shipment.courier?.name;
  switch (item.kind) {
    case "exception_to_decide":
      return {
        tone: "error" as const,
        icon: ReportIcon,
        tag: "Novedad por decidir",
        title: `${who}, ${place}`,
        detail: courier ? `Lo tiene ${courier}` : shipment.merchant.name,
      };
    case "late":
    case "at_risk":
      return {
        tone: item.kind === "late" ? ("error" as const) : ("warning" as const),
        icon: ScheduleIcon,
        tag: flag ? flagLabel(flag) : item.kind === "late" ? "Atrasado" : "En riesgo",
        title: `${who}, ${place}`,
        detail: `${window} · ${courier ?? "Todavía sin ruta"}`,
      };
    case "pending_handover": {
      const handover = shipment.pendingHandover;
      const waited = handover
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(handover.requestedAt)) / 60_000))
        : 0;
      return {
        tone: "tertiary" as const,
        icon: SwapIcon,
        tag: "Traspaso pendiente",
        title: handover
          ? `${handover.fromCourier.name} a ${handover.toCourier.name}`
          : `${who}, ${place}`,
        detail: `${who}, ${place} · hace ${formatDuration(waited)}`,
      };
    }
    case "pickup_problem":
      return {
        tone: "warning" as const,
        icon: WarningIcon,
        tag: "Problema de recogida",
        title: `${who}, ${place}`,
        detail: `${shipment.merchant.name}${courier ? ` · ${courier}` : ""}`,
      };
  }
}

const actionLabels: Record<AttentionItem["action"], string> = {
  decide: "Decidir",
  reassign: "Reasignar",
  confirm_handover: "Confirmar",
  assign: "Asignar",
};

/**
 * "Por resolver" (FR-018, design-system.md §8): what needs a person now, most urgent first, at
 * most `limit` rows and the rest behind "Ver los N". Each row opens the shipment and has one
 * action; the "Además" line filters the list by alerts.
 */
export function AttentionList({
  items,
  shipments,
  minor,
  now,
  date,
  busy,
  limit = 5,
  onAct,
  onShowAlerts,
}: {
  items: AttentionItem[];
  shipments: Map<string, BoardEntry>;
  minor: Record<MinorFlag, number>;
  now: Date;
  date: string;
  /** The shipment whose action is running, so its button waits. */
  busy: string | null;
  limit?: number;
  onAct: (shipment: BoardEntry, intent: AttentionIntent) => void;
  onShowAlerts: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  const also = minorSummary(minor);
  return (
    <section
      aria-labelledby="por-resolver"
      className="flex flex-col rounded-lg border border-outline-variant bg-sheet px-5 pt-5 max-[820px]:px-4"
    >
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id="por-resolver" className="flex items-baseline gap-2 text-title-l text-on-surface">
          Por resolver{" "}
          <span className="text-body-l text-on-surface-variant tabular-nums">{items.length}</span>
        </h2>
        {items.length > limit && (
          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded);
            }}
            className="min-h-6 cursor-pointer text-label-l whitespace-nowrap text-on-surface underline underline-offset-4"
          >
            {expanded ? "Ver menos" : `Ver los ${String(items.length)}`}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 border-t border-outline-variant px-4 pt-8 pb-10 text-center">
          <p className="text-title-s text-on-surface">Todo bajo control</p>
          <p className="text-body-m text-on-surface-variant">
            Lo urgente aparecerá aquí en menos de 30 segundos.
          </p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col">
          {shown.map((item) => {
            const shipment = shipments.get(item.shipmentId);
            if (!shipment) return null;
            const row = describe(item, shipment, now);
            const tone = tones[row.tone];
            return (
              <li
                key={item.shipmentId}
                className="flex items-center gap-3 border-t border-outline-variant py-3"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-md max-[820px]:hidden",
                    tone.tile,
                  )}
                >
                  <Icon symbol={row.icon as Symbol} size={20} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onAct(shipment, "open");
                  }}
                  className="group min-w-0 flex-1 cursor-pointer rounded-xs text-left"
                >
                  <span className="flex flex-wrap items-baseline gap-x-2 text-label-m">
                    <span className={tone.tag}>{row.tag}</span>
                    <TrackingNumber
                      value={shipment.trackingNumber}
                      className="text-on-surface-variant"
                    />
                  </span>
                  <span className="block truncate text-title-s text-on-surface underline-offset-3 group-hover:underline">
                    {row.title}
                  </span>
                  <span className="block truncate text-body-s text-on-surface-variant">
                    {row.detail}
                  </span>
                </button>
                {item.action === "assign" ? (
                  <Link
                    to="/rutas"
                    search={{ date }}
                    className={buttonVariants({ variant: "outline", className: "h-11" })}
                  >
                    Asignar
                    <span className="sr-only">
                      {" "}
                      {formatTrackingNumber(shipment.trackingNumber)}
                    </span>
                  </Link>
                ) : (
                  <Button
                    variant={item.action === "decide" ? "default" : "outline"}
                    className="h-11 px-4"
                    disabled={busy === shipment.id}
                    onClick={() => {
                      onAct(shipment, item.action === "assign" ? "open" : item.action);
                    }}
                  >
                    {actionLabels[item.action]}
                    <span className="sr-only">
                      {" "}
                      {formatTrackingNumber(shipment.trackingNumber)}
                    </span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {also && (
        <div className="border-t border-outline-variant">
          <button
            type="button"
            onClick={onShowAlerts}
            className="min-h-11 cursor-pointer text-left text-body-m text-on-surface-variant underline decoration-outline-variant underline-offset-4 hover:text-on-surface hover:decoration-current"
          >
            {also}
          </button>
        </div>
      )}
    </section>
  );
}
