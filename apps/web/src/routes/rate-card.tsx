import EventIcon from "@material-symbols/svg-400/rounded/event.svg?react";
import type { RateCardEntry } from "@domy/domain";
import { rateEntryKindLabels } from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { getRateCard, getRateCardHistory } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { DetailSheet, ListSheet, MasterHeader } from "@/features/master-data/master-page";
import { RateEntryDialog } from "@/features/master-data/rate-card/rate-entry-dialog";
import { searchMerchants, type MerchantOption } from "@/features/shipments/api";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatDateTime } from "@/lib/format";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/tarifario")({
  head: () => ({ meta: [{ title: "Tarifario · Domy" }] }),
  component: RateCardPage,
});

function Rate({ entry }: { entry: RateCardEntry | null }) {
  if (!entry) return <span className="text-on-surface-variant">Sin tarifa</span>;
  return (
    <span className="flex flex-col items-end">
      <span className="font-semibold tabular-nums">{formatCop(entry.amount)}</span>
      <span className="text-body-s text-on-surface-variant">
        desde {formatDate(entry.effectiveFrom)}
      </span>
    </span>
  );
}

/** A merchant's special rate, marked so it reads apart from the standard one. */
function Special({ entry, standard }: { entry: RateCardEntry | null; standard: string }) {
  if (!entry) return <span className="text-on-surface-variant">{standard}</span>;
  return (
    <span className="flex flex-col items-end">
      <span className="rounded-xs bg-tertiary-container px-2 font-semibold text-on-tertiary-container tabular-nums">
        {formatCop(entry.amount)}
      </span>
      <span className="text-body-s text-on-surface-variant">
        desde {formatDate(entry.effectiveFrom)}
      </span>
    </span>
  );
}

/**
 * The rate card in force, scheduled changes, and its history (FR-028), changed by the owner,
 * as approved in feature 006 (US5): the zones with a merchant's special rates beside them, and
 * the express surcharge, the scheduled changes, and the latest history on the side.
 */
function RateCardPage() {
  const { user } = panelRoute.useRouteContext();
  const owner = user.role === "owner";
  const [merchant, setMerchant] = useState<MerchantOption | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const card = useQuery({
    queryKey: ["master", "rate-card", merchant?.id ?? null],
    queryFn: () => getRateCard(merchant?.id ?? null),
  });
  const history = useQuery({
    queryKey: ["master", "rate-card", "history", merchant?.id ?? null],
    queryFn: () => getRateCardHistory(merchant?.id ?? null),
    enabled: owner,
  });
  const data = card.data;
  const surcharge = data?.expressSurcharge.standard;
  const specials = data
    ? data.zones.filter((zone) => zone.merchant).length + (data.expressSurcharge.merchant ? 1 : 0)
    : 0;
  const shownHistory = allHistory ? (history.data ?? []) : (history.data ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Tarifario"
        sentence={
          data
            ? [
                { text: "Tarifa estándar de " },
                {
                  text: `${String(data.zones.length)} ${data.zones.length === 1 ? "zona" : "zonas"}`,
                  strong: true,
                },
                ...(surcharge
                  ? [
                      { text: " y recargo exprés de " },
                      { text: formatCop(surcharge.amount), strong: true },
                    ]
                  : []),
                ...(data.scheduled.length > 0
                  ? [
                      {
                        text: `. ${data.scheduled.length === 1 ? "Un cambio entra" : `${String(data.scheduled.length)} cambios entran`} el ${formatDate(data.scheduled[0]?.effectiveFrom ?? "")}.`,
                      },
                    ]
                  : [{ text: "." }]),
              ]
            : null
        }
        actions={
          owner && (
            <>
              <ExportButton dataset="rate-card" />
              <RateEntryDialog merchant={merchant} />
            </>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ListSheet
          id="tarifas-zonas"
          title="Por zona"
          note={merchant ? `Con las tarifas especiales de ${merchant.name}` : undefined}
        >
          <div className="border-t border-outline-variant px-5 py-3.5 max-[820px]:px-4">
            <Field className="max-w-sm">
              <FieldLabel htmlFor="rate-card-merchant">Tarifas especiales de un cliente</FieldLabel>
              <SearchCombobox<MerchantOption>
                id="rate-card-merchant"
                label="Tarifas especiales de un cliente"
                queryKey={["merchants"]}
                search={searchMerchants}
                value={merchant}
                onChange={setMerchant}
                itemKey={(option) => option.id}
                itemLabel={(option) => option.name}
                placeholder="Tarifario estándar"
              />
            </Field>
          </div>
          {!data ? (
            <div className="flex flex-col gap-2 px-5 py-4" role="status" aria-label="Cargando">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <table className="w-full border-collapse text-body-l">
              <thead>
                <tr className="bg-surface-container-low text-left text-label-m text-on-surface-variant">
                  <th scope="col" className="border-y border-outline-variant px-5 py-2.5">
                    Zona
                  </th>
                  <th
                    scope="col"
                    className="border-y border-outline-variant px-5 py-2.5 text-right"
                  >
                    Estándar
                  </th>
                  {merchant && (
                    <th
                      scope="col"
                      className="border-y border-outline-variant px-5 py-2.5 text-right"
                    >
                      {merchant.name}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.zones.map((zone) => (
                  <tr
                    key={zone.rateZone.id}
                    className="border-t border-outline-variant first:border-t-0"
                  >
                    <th scope="row" className="px-5 py-3 text-left font-semibold text-on-surface">
                      {zone.rateZone.name}
                    </th>
                    <td className="px-5 py-3 text-right">
                      <Rate entry={zone.standard} />
                    </td>
                    {merchant && (
                      <td className="px-5 py-3 text-right">
                        <Special entry={zone.merchant} standard="Usa la estándar" />
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t border-outline-variant">
                  <th scope="row" className="px-5 py-3 text-left font-semibold text-on-surface">
                    Recargo exprés
                  </th>
                  <td className="px-5 py-3 text-right">
                    <Rate entry={data.expressSurcharge.standard} />
                  </td>
                  {merchant && (
                    <td className="px-5 py-3 text-right">
                      <Special entry={data.expressSurcharge.merchant} standard="Usa el estándar" />
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          )}
          {merchant && data && (
            <p className="border-t border-outline-variant px-5 py-3 text-body-m text-on-surface-variant">
              {specials === 0
                ? `${merchant.name} usa el tarifario estándar.`
                : `${merchant.name} tiene ${String(specials)} ${specials === 1 ? "tarifa especial" : "tarifas especiales"}.`}
            </p>
          )}
        </ListSheet>

        <div className="flex min-w-0 flex-col gap-5">
          <DetailSheet id="tarifas-programadas" title="Programadas">
            {data && data.scheduled.length > 0 ? (
              <ul className="flex flex-col">
                {data.scheduled.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={cn(
                      "flex items-start gap-3 py-2.5",
                      index > 0 && "border-t border-outline-variant",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-tertiary-container text-on-tertiary-container">
                      <Icon symbol={EventIcon} size={20} />
                    </span>
                    <span className="text-body-l text-on-surface">
                      {formatDate(entry.effectiveFrom)}: {rateEntryKindLabels[entry.kind]}
                      {entry.rateZone && ` ${entry.rateZone.name}`}
                      {entry.merchant && ` para ${entry.merchant.name}`},{" "}
                      <span className="font-semibold tabular-nums">{formatCop(entry.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-m text-on-surface-variant">No hay cambios programados.</p>
            )}
          </DetailSheet>

          {owner && history.data && (
            <DetailSheet id="tarifas-historial" title="Historial">
              {history.data.length === 0 ? (
                <p className="text-body-m text-on-surface-variant">Todavía no hay cambios.</p>
              ) : (
                <ul className="flex flex-col">
                  {shownHistory.map((entry, index) => (
                    <li
                      key={entry.id}
                      className={cn("py-2.5", index > 0 && "border-t border-outline-variant")}
                    >
                      <span className="block font-semibold text-on-surface">
                        {rateEntryKindLabels[entry.kind]}
                        {entry.rateZone && ` · ${entry.rateZone.name}`} ·{" "}
                        {entry.merchant?.name ?? "Estándar"}
                      </span>
                      <span className="block text-body-m text-on-surface-variant">
                        <span className="tabular-nums">{formatCop(entry.amount)}</span> desde{" "}
                        {formatDate(entry.effectiveFrom)} · {entry.createdBy.name},{" "}
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {history.data.length > 5 && (
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() => {
                    setAllHistory((all) => !all);
                  }}
                >
                  {allHistory ? "Ver menos" : `Ver los ${String(history.data.length)} cambios`}
                </Button>
              )}
            </DetailSheet>
          )}
        </div>
      </div>
    </div>
  );
}
