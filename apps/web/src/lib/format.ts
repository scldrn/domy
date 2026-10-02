/** Dates and times as users read them: `es-CO`, in America/Bogota (design-system.md §9). */
export { formatCop } from "@domy/domain";

const timeZone = "America/Bogota";
const dateParts = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone,
});
const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone,
});

/** "30 sep 2026". Accepts an instant or a calendar day (YYYY-MM-DD). */
export function formatDate(value: Date | string): string {
  const instant =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00-05:00`)
      : new Date(value);
  const parts = Object.fromEntries(
    dateParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const month = (parts["month"] ?? "").replace(".", "").slice(0, 3);
  return `${parts["day"] ?? ""} ${month} ${parts["year"] ?? ""}`;
}

/** "2:30 p. m." */
export function formatTime(value: Date | string): string {
  return timeFormat.format(new Date(value));
}

const longDateFormat = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone,
});

/** "Jueves 1 de octubre" for a calendar day; the year is added when it is not `today`'s. */
export function formatLongDate(date: string, today: string): string {
  const text = longDateFormat.format(new Date(`${date}T12:00:00-05:00`)).replace(",", "");
  const full = date.slice(0, 4) === today.slice(0, 4) ? text : `${text} de ${date.slice(0, 4)}`;
  return full.charAt(0).toUpperCase() + full.slice(1);
}

/** "30 sep 2026, 2:30 p. m." */
export function formatDateTime(value: Date | string): string {
  return `${formatDate(new Date(value))}, ${formatTime(value)}`;
}

/** "2:30 p. m. – 5:00 p. m.", "Antes de las 5:00 p. m.", or null without a window. */
export function formatWindow(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  if (end) return `Antes de las ${formatTime(end)}`;
  if (start) return `Después de las ${formatTime(start)}`;
  return null;
}
