import { formatCop as cop, type DaySummary } from "@domy/domain";

/** An amount that never wraps between the sign and the figure. */
const formatCop = (amount: number) => cop(amount).replace(" ", "\u00a0");

export type SentencePart = { text: string; strong?: boolean };

const counted = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/**
 * The lede of «Mi día» (approved app del mensajero): what the courier has done today, then
 * what is left on the route, with the figures in bold.
 */
export function daySentence(summary: DaySummary): SentencePart[] {
  const done = [
    summary.deliveries > 0 && counted(summary.deliveries, "entrega", "entregas"),
    summary.exceptions > 0 && counted(summary.exceptions, "novedad", "novedades"),
    summary.returns > 0 && counted(summary.returns, "devolución", "devoluciones"),
  ].filter((part): part is string => part !== false);
  const parts: SentencePart[] = [];
  if (done.length === 0) parts.push({ text: "Aún no registras entregas hoy." });
  else {
    parts.push({ text: "Llevas " });
    done.forEach((part, index) => {
      if (index > 0) parts.push({ text: index === done.length - 1 ? " y " : ", " });
      parts.push({ text: part, strong: true });
    });
    parts.push({ text: "." });
  }
  if (summary.pendingStops === 0) parts.push({ text: " No te quedan paradas pendientes." });
  else {
    parts.push({ text: summary.pendingStops === 1 ? " Te queda " : " Te quedan " });
    parts.push({ text: counted(summary.pendingStops, "parada", "paradas"), strong: true });
    parts.push({ text: " en la ruta." });
  }
  return parts;
}

/** How «Efectivo por entregar» is reached: cash collected minus disbursements (FR-037). */
export function cashExplanation(summary: DaySummary): string | null {
  const { cash, disbursements, cashToHandOver } = summary;
  if (cash === 0 && disbursements === 0) return null;
  if (cashToHandOver < 0)
    return `Pagaste ${formatCop(disbursements)} por cuenta del cliente y recibiste ${formatCop(cash)} en efectivo: la empresa te debe ${formatCop(-cashToHandOver)}.`;
  if (disbursements === 0) return `${formatCop(cash)} recibidos en efectivo.`;
  return `${formatCop(cash)} recibidos en efectivo, menos ${formatCop(disbursements)} que pagaste por cuenta del cliente.`;
}
