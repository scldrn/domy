import type { ShipmentSearchCounts } from "@domy/domain";
import type { SentencePart } from "@/components/summary-sentence";
import type { HistoryFilters } from "./api";

const number = new Intl.NumberFormat("es-CO");
const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

const shipments = (n: number) => `${number.format(n)} ${n === 1 ? "envío" : "envíos"}`;

/** "3 de noviembre", with the year when it is not `today`'s; `withMonth` false gives "3". */
function day(date: string, today: string, withMonth = true): string {
  const [year = "", , dayOfMonth = ""] = date.split("-");
  const text = String(Number(dayOfMonth));
  if (!withMonth) return text;
  const name = monthName.format(new Date(`${date}T12:00:00Z`));
  return `${text} de ${name}${year === today.slice(0, 4) ? "" : ` de ${year}`}`;
}

/** " del 1 al 3 de noviembre", " desde el 1 de noviembre", or "" without dates. */
function range(from: string | undefined, to: string | undefined, today: string): string {
  if (from && to) {
    if (from === to) return ` del ${day(from, today)}`;
    const sameMonth = from.slice(0, 7) === to.slice(0, 7) && from.slice(0, 4) === today.slice(0, 4);
    return ` del ${day(from, today, !sameMonth)} al ${day(to, today)}`;
  }
  if (from) return ` desde el ${day(from, today)}`;
  if (to) return ` hasta el ${day(to, today)}`;
  return "";
}

/**
 * The sentence of «Historial» (FR-007; approved «Historial»): how many shipments the search
 * finds, over which days, and how many of them have their fee to review.
 */
export function historySentence({
  filters,
  counts,
  today,
}: {
  filters: HistoryFilters;
  counts: ShipmentSearchCounts;
  today: string;
}): SentencePart[] {
  const narrowed = Boolean(
    filters.q || filters.status || filters.neighborhoodId || filters.merchantId,
  );
  const reviewOnly = filters.feeReview === "true";
  const days = range(filters.from, filters.to, today);

  if (counts.total === 0) {
    return narrowed || reviewOnly || days
      ? [{ text: "Ningún envío", strong: true }, { text: " coincide con la búsqueda." }]
      : [{ text: "Todavía no hay envíos registrados." }];
  }

  const parts: SentencePart[] = [{ text: shipments(counts.total), strong: true }];
  let rest = days;
  if (reviewOnly) rest += " con la tarifa por revisar";
  if (narrowed)
    rest += counts.total === 1 ? " coincide con la búsqueda" : " coinciden con la búsqueda";
  if (!rest) rest = counts.total === 1 ? " registrado" : " registrados";
  if (reviewOnly || counts.feeReview === 0) {
    parts.push({ text: `${rest}.` });
    return parts;
  }
  parts.push(
    { text: `${rest}; ` },
    {
      text: `${number.format(counts.feeReview)} ${counts.feeReview === 1 ? "tiene" : "tienen"} la tarifa por revisar`,
      strong: true,
      tone: "warning",
    },
    { text: "." },
  );
  return parts;
}

/** "Mostrando 50 de 1.240 envíos", under the results. */
export function shownLine(shown: number, total: number): string {
  return `Mostrando ${number.format(shown)} de ${shipments(total)}`;
}
