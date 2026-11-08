import type { SentencePart } from "@/components/summary-sentence";
import { formatLongDate } from "@/lib/format";

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * The sentence of «Notificar clientes» (FR-007; approved «Notificar clientes»): the day, how
 * many merchants still have shipments without their links, how many shipments, and how many
 * merchants are up to date. A merchant waiting to record a notification counts as pending.
 */
export function notifySentence({
  date,
  today,
  merchants,
}: {
  date: string;
  today: string;
  merchants: { pending: number; upToDate: boolean }[];
}): SentencePart[] {
  const day = formatLongDate(date, today);
  const toDo = merchants.filter((merchant) => !merchant.upToDate);
  const done = merchants.length - toDo.length;
  if (merchants.length === 0) return [{ text: `${day}: ningún envío por notificar.` }];
  if (toDo.length === 0) {
    return [{ text: `${day}: todos los clientes ya recibieron sus enlaces.` }];
  }
  const shipments = toDo.reduce((sum, merchant) => sum + merchant.pending, 0);
  return [
    { text: `${day}: ` },
    { text: count(toDo.length, "cliente", "clientes"), strong: true },
    { text: toDo.length === 1 ? " tiene " : " tienen " },
    { text: count(shipments, "envío", "envíos"), strong: true },
    {
      text:
        done === 0
          ? " sin notificar."
          : ` sin notificar; ${count(done, "cliente ya está", "clientes ya están")} al día.`,
    },
  ];
}
