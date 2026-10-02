import type { RateCardEntry } from "@domy/domain";
import { rateEntryKindLabels } from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { SearchCombobox } from "@/components/search-combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRateCard, getRateCardHistory } from "@/features/master-data/api";
import { ExportButton } from "@/features/master-data/export-button";
import { RateEntryDialog } from "@/features/master-data/rate-card/rate-entry-dialog";
import { searchMerchants, type MerchantOption } from "@/features/shipments/api";
import { formatCop, formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

const panelRoute = getRouteApi("/_panel");

export const Route = createFileRoute("/_panel/tarifario")({
  head: () => ({ meta: [{ title: "Tarifario · Domy" }] }),
  component: RateCardPage,
});

function Rate({ entry }: { entry: RateCardEntry | null }) {
  if (!entry) return <span className="text-on-surface-variant">Sin tarifa</span>;
  return (
    <span>
      <span className="tabular-nums">{formatCop(entry.amount)}</span>
      <span className="block text-body-s text-on-surface-variant">
        desde {formatDate(entry.effectiveFrom)}
      </span>
    </span>
  );
}

/** The rate card in force, scheduled changes, and its history (FR-028); changed by the owner. */
function RateCardPage() {
  const { user } = panelRoute.useRouteContext();
  const owner = user.role === "owner";
  const [merchant, setMerchant] = useState<MerchantOption | null>(null);
  const card = useQuery({
    queryKey: ["master", "rate-card", merchant?.id ?? null],
    queryFn: () => getRateCard(merchant?.id ?? null),
  });
  const history = useQuery({
    queryKey: ["master", "rate-card", "history", merchant?.id ?? null],
    queryFn: () => getRateCardHistory(merchant?.id ?? null),
    enabled: owner,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tarifario"
        actions={
          <>
            {owner && (
              <div className="flex gap-2">
                <ExportButton dataset="rate-card" />
                <RateEntryDialog merchant={merchant} />
              </div>
            )}
          </>
        }
      />
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

      {card.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zona</TableHead>
                <TableHead>Estándar</TableHead>
                {merchant && <TableHead>{merchant.name}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.data.zones.map((zone) => (
                <TableRow key={zone.rateZone.id}>
                  <TableCell>{zone.rateZone.name}</TableCell>
                  <TableCell>
                    <Rate entry={zone.standard} />
                  </TableCell>
                  {merchant && (
                    <TableCell>
                      {zone.merchant ? <Rate entry={zone.merchant} /> : "Usa la estándar"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Recargo exprés</TableCell>
                <TableCell>
                  <Rate entry={card.data.expressSurcharge.standard} />
                </TableCell>
                {merchant && (
                  <TableCell>
                    {card.data.expressSurcharge.merchant ? (
                      <Rate entry={card.data.expressSurcharge.merchant} />
                    ) : (
                      "Usa el estándar"
                    )}
                  </TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>

          {card.data.scheduled.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-title-m text-on-surface">Programadas</h2>
              <ul className="flex flex-col gap-1 text-body-l">
                {card.data.scheduled.map((entry) => (
                  <li key={entry.id}>
                    {formatDate(entry.effectiveFrom)}: {rateEntryKindLabels[entry.kind]}
                    {entry.rateZone && ` ${entry.rateZone.name}`}
                    {entry.merchant && ` para ${entry.merchant.name}`},{" "}
                    <span className="tabular-nums">{formatCop(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {owner && history.data && (
        <section className="flex flex-col gap-2">
          <h2 className="text-title-m text-on-surface">Historial</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vigente desde</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Registrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.effectiveFrom)}</TableCell>
                  <TableCell>{rateEntryKindLabels[entry.kind]}</TableCell>
                  <TableCell>{entry.rateZone?.name}</TableCell>
                  <TableCell>{entry.merchant?.name ?? "Estándar"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCop(entry.amount)}
                  </TableCell>
                  <TableCell>
                    {entry.createdBy.name} · {formatDateTime(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
